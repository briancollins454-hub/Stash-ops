import { MatchStatus, type Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { createManualJob } from "../services/order-service";
import { fetchDecoProductDetail } from "../services/deco-api-service";
import { catalogLookup, catalogImages } from "../services/catalog-service";
import { normalizeMatchToken } from "../services/shopify-order-context";
import { emailQuote } from "../services/quote-email-service";

// ── Size range parser ──

const SIZE_ORDER = [
  "XXS", "XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL", "XXXL", "4XL", "XXXXL", "5XL", "6XL",
  "3-4", "5-6", "7-8", "9-10", "11-12", "13",
  "ONE SIZE",
];

function parseSizeRange(range: string): string[] {
  if (!range) return ["ONE SIZE"];
  // Handle "S to 3XL" or "S - 3XL" patterns
  const toMatch = range.match(/^(\S+)\s+(?:to|-)\s+(\S+)$/i);
  if (toMatch) {
    const startIdx = SIZE_ORDER.findIndex((s) => s.toLowerCase() === toMatch[1].toLowerCase());
    const endIdx = SIZE_ORDER.findIndex((s) => s.toLowerCase() === toMatch[2].toLowerCase());
    if (startIdx >= 0 && endIdx >= 0 && endIdx >= startIdx) {
      return SIZE_ORDER.slice(startIdx, endIdx + 1);
    }
  }
  // Handle comma-separated "S, M, L, XL"
  const parts = range.split(/[,/]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  // Single value
  return [range.trim()];
}

// ── Schemas ──

const quoteCreateSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerCompany: z.string().optional(),
  customerPhone: z.string().optional(),
  accountId: z.string().optional(),
  shippingAddress: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postcode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  note: z.string().optional(),
  dueAt: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        sku: z.string().optional(),
        productTitle: z.string().min(1),
        variantTitle: z.string().optional(),
        quantity: z.coerce.number().int().min(1),
        decorationMethod: z.string().optional(),
        placement: z.string().optional(),
        unitPricePounds: z.coerce.number().min(0).optional(),
        decoProductId: z.string().optional(),
        designs: z.array(z.record(z.string(), z.unknown())).optional(),
        selectedColorId: z.number().optional(),
        sizeBreakdown: z.record(z.string(), z.number()).optional(),
      }),
    )
    .min(1),
});

export async function registerQuoteRoutes(app: FastifyInstance): Promise<void> {
  // ── Account / customer search ──
  app.get("/v1/quotes/accounts", async (request) => {
    const query = z
      .object({ q: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).optional() })
      .parse(request.query);

    const searchTerm = query.q?.trim() ?? "";
    const limit = query.limit ?? 30;

    if (!searchTerm) {
      const accounts = await prisma.account.findMany({
        where: { active: true },
        include: { aliases: { where: { active: true }, select: { aliasRaw: true } } },
        orderBy: { name: "asc" },
        take: limit,
      });
      return { total: accounts.length, items: accounts };
    }

    const normalized = normalizeMatchToken(searchTerm);

    const accounts = await prisma.account.findMany({
      where: {
        active: true,
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { key: { contains: searchTerm, mode: "insensitive" } },
          { aliases: { some: { aliasNormalized: { contains: normalized, mode: "insensitive" }, active: true } } },
        ],
      },
      include: {
        aliases: { where: { active: true }, select: { aliasRaw: true } },
      },
      orderBy: { name: "asc" },
      take: limit,
    });

    return { total: accounts.length, items: accounts };
  });

  // ── Deco products (from DB, synced via /sync/deco/products) ──
  app.get("/v1/quotes/products", async (request) => {
    const query = z
      .object({
        q: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(500).optional(),
      })
      .parse(request.query);

    const limit = query.limit ?? 200;
    const searchTerm = query.q?.trim() ?? "";

    const where = searchTerm
      ? {
          active: true,
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" as const } },
            { sku: { contains: searchTerm, mode: "insensitive" as const } },
            { category: { contains: searchTerm, mode: "insensitive" as const } },
          ],
        }
      : { active: true };

    const dbProducts = await prisma.decoProduct.findMany({
      where,
      include: { inventory: true },
      orderBy: { name: "asc" },
      take: limit,
    });

    const products = dbProducts.map((p) => ({
      decoProductId: p.decoProductId,
      name: p.name,
      sku: p.sku ?? "",
      category: p.category ?? "",
      price: p.price,
      sizes: p.sizes ?? "",
      colors: p.colors ?? "",
      available: p.inventory[0]?.quantityAvailable ?? null,
      onHand: p.inventory[0]?.quantityOnHand ?? null,
    }));

    return { total: products.length, items: products };
  });

  // ── Deco inventory (from DB, synced via /sync/deco/inventory) ──
  app.get("/v1/quotes/inventory", async (request) => {
    const query = z
      .object({
        sku: z.string().optional(),
        productId: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(500).optional(),
      })
      .parse(request.query);

    const limit = query.limit ?? 200;

    const where: Record<string, unknown> = {};
    if (query.sku) where.sku = { contains: query.sku, mode: "insensitive" };
    if (query.productId) where.decoProductId = query.productId;

    const dbInventory = await prisma.decoInventory.findMany({
      where,
      orderBy: { productName: "asc" },
      take: limit,
    });

    const items = dbInventory.map((i) => ({
      decoProductId: i.decoProductId,
      sku: i.sku ?? "",
      name: i.productName ?? "",
      onHand: i.quantityOnHand,
      available: i.quantityAvailable,
      onOrder: i.quantityOnOrder,
    }));

    return { total: items.length, items };
  });

  // ── Deco customers (from DB, synced via /sync/deco/customers) ──
  app.get("/v1/quotes/customers", async (request) => {
    const query = z
      .object({
        q: z.string().optional(),
        decoCustomerId: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      })
      .parse(request.query);

    // Look up a single customer by decoCustomerId
    if (query.decoCustomerId) {
      const customer = await prisma.decoCustomer.findUnique({
        where: { decoCustomerId: query.decoCustomerId },
      });
      return { total: customer ? 1 : 0, items: customer ? [customer] : [] };
    }

    const limit = query.limit ?? 50;
    const searchTerm = query.q?.trim() ?? "";

    const where = searchTerm
      ? {
          active: true,
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" as const } },
            { email: { contains: searchTerm, mode: "insensitive" as const } },
            { company: { contains: searchTerm, mode: "insensitive" as const } },
          ],
        }
      : { active: true };

    const customers = await prisma.decoCustomer.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
    });

    return { total: customers.length, items: customers };
  });

  // ── Create quote (as a manual job) ──
  app.post("/v1/quotes", async (request, reply) => {
    const body = quoteCreateSchema.parse(request.body);

    const addressJson = body.shippingAddress
      ? {
          line1: body.shippingAddress.line1 ?? "",
          line2: body.shippingAddress.line2 ?? "",
          city: body.shippingAddress.city ?? "",
          state: body.shippingAddress.state ?? "",
          postcode: body.shippingAddress.postcode ?? "",
          country: body.shippingAddress.country ?? "GB",
        }
      : undefined;

    const manualInput = {
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      sourceGroupLabel: body.customerCompany,
      note: [
        body.note ?? "",
        addressJson ? `Ship to: ${addressJson.line1}, ${addressJson.city} ${addressJson.postcode}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      lineItems: body.lineItems.map((item) => ({
        sku: item.sku,
        productTitle: item.productTitle,
        variantTitle: item.variantTitle,
        quantity: item.quantity,
        decorationMethod: item.decorationMethod,
        decorationPlacement: item.placement,
        requiresArtwork:
          !!item.decorationMethod && item.decorationMethod !== "other",
        unitPriceMinor:
          item.unitPricePounds !== undefined
            ? Math.round(item.unitPricePounds * 100)
            : undefined,
        decoProductId: item.decoProductId,
        designs: item.designs,
        selectedColorId: item.selectedColorId,
        sizeBreakdown: item.sizeBreakdown,
      })),
    };

    const created = await createManualJob(manualInput);

    // If an accountId was selected, link it
    if (body.accountId) {
      await prisma.job.update({
        where: { id: created.jobId },
        data: {
          accountId: body.accountId,
          accountMatchStatus: MatchStatus.MANUAL_MATCHED,
          requiresReview: false,
          reviewReason: null,
          customerCompany: body.customerCompany ?? undefined,
          customerPhone: body.customerPhone ?? undefined,
        },
      });
    }

    // Store shipping address + quote metadata
    const metadata: Record<string, unknown> = { note: body.note ?? null };
    if (addressJson) metadata.shippingAddress = addressJson;
    if (body.dueAt) metadata.requestedDueAt = body.dueAt;

    await prisma.job.update({
      where: { id: created.jobId },
      data: {
        metadata: metadata as Prisma.InputJsonValue,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        customerCompany: body.customerCompany ?? undefined,
      },
    });

    reply.status(201);
    return {
      ok: true,
      jobId: created.jobId,
      internalJobId: created.internalJobId,
    };
  });

  // ── Update existing quote ──
  app.put("/v1/quotes/:jobId", async (request, reply) => {
    const { jobId } = z.object({ jobId: z.string() }).parse(request.params);
    const body = quoteCreateSchema.parse(request.body);

    const job = await prisma.job.findFirst({
      where: { OR: [{ id: jobId }, { internalJobId: jobId }] },
      select: { id: true, internalJobId: true, lifecycle: true },
    });

    if (!job) {
      reply.status(404);
      return { error: "Quote not found" };
    }

    // Build address
    const addressJson = body.shippingAddress
      ? {
          line1: body.shippingAddress.line1 ?? "",
          line2: body.shippingAddress.line2 ?? "",
          city: body.shippingAddress.city ?? "",
          state: body.shippingAddress.state ?? "",
          postcode: body.shippingAddress.postcode ?? "",
          country: body.shippingAddress.country ?? "GB",
        }
      : undefined;

    // Update the job record
    const metadata: Record<string, unknown> = { note: body.note ?? null };
    if (addressJson) metadata.shippingAddress = addressJson;
    if (body.dueAt) metadata.requestedDueAt = body.dueAt;

    const totalMinor = body.lineItems.reduce((sum, item) => {
      return sum + (item.unitPricePounds !== undefined ? Math.round(item.unitPricePounds * 100) * item.quantity : 0);
    }, 0);

    await prisma.job.update({
      where: { id: job.id },
      data: {
        customerName: body.customerName,
        customerEmail: body.customerEmail ?? undefined,
        customerPhone: body.customerPhone ?? undefined,
        customerCompany: body.customerCompany ?? undefined,
        sourceGroupLabel: body.customerCompany ?? undefined,
        metadata: metadata as Prisma.InputJsonValue,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        accountId: body.accountId ?? undefined,
        totalMinor,
        subtotalMinor: totalMinor,
        orderNotes: body.note ?? undefined,
      },
    });

    // Delete old items and create new ones
    await prisma.jobItem.deleteMany({ where: { jobId: job.id } });

    await prisma.jobItem.createMany({
      data: body.lineItems.map((item) => ({
        jobId: job.id,
        sku: item.sku ?? null,
        productTitle: item.productTitle,
        variantTitle: item.variantTitle ?? null,
        quantity: item.quantity,
        decorationMethod: item.decorationMethod ?? null,
        decorationPlacement: item.placement ?? null,
        unitPriceMinor: item.unitPricePounds !== undefined
          ? Math.round(item.unitPricePounds * 100)
          : undefined,
        totalPriceMinor: item.unitPricePounds !== undefined
          ? Math.round(item.unitPricePounds * 100) * item.quantity
          : undefined,
        customOptions: item.designs && item.designs.length > 0
          ? { designs: item.designs } as Prisma.InputJsonValue
          : undefined,
        metadata: (item.decoProductId || item.selectedColorId || item.sizeBreakdown)
          ? {
              decoProductId: item.decoProductId ?? null,
              selectedColorId: item.selectedColorId ?? null,
              sizeBreakdown: item.sizeBreakdown ?? null,
            } as Prisma.InputJsonValue
          : undefined,
      })),
    });

    await prisma.activityLog.create({
      data: {
        jobId: job.id,
        eventType: "quote.updated",
        message: `Quote updated — ${body.lineItems.length} line item(s)`,
      },
    });

    return {
      ok: true,
      jobId: job.id,
      internalJobId: job.internalJobId,
    };
  });

  // ── Product detail (DB-first, Deco API fallback) ──
  app.get("/v1/quotes/products/:decoProductId/detail", async (request, reply) => {
    const { decoProductId } = z.object({ decoProductId: z.string() }).parse(request.params);
    const { sku: querySku } = z.object({ sku: z.string().optional() }).parse(request.query);

    // Step 1: Look up the DecoProduct in our DB to get the SKU / product code
    const decoProduct = await prisma.decoProduct.findUnique({
      where: { decoProductId },
    });

    const productCode = querySku || decoProduct?.sku || "";

    // Step 2: Try to build detail from local CatalogProduct + CatalogColour
    if (productCode) {
      try {
        const catalog = await catalogLookup(productCode);
        if (catalog && catalog.colours.length > 0) {
          // Deduplicate colours: prefer "Live" status, then first occurrence
          const seenNames = new Map<string, typeof catalog.colours[0]>();
          for (const c of catalog.colours) {
            if (c.skuStatus === "Discontinued") continue;
            const cleanName = c.colourName.replace(/[*†]+$/g, "").trim();
            const existing = seenNames.get(cleanName);
            if (!existing || (c.skuStatus === "Live" && existing.skuStatus !== "Live")) {
              seenNames.set(cleanName, c);
            }
          }
          const uniqueColours = Array.from(seenNames.values());

          // Build colors array from deduplicated colours
          const colors = uniqueColours.map((c, i) => ({
            id: i + 1,
            name: c.colourName.replace(/[*†]+$/g, "").trim(),
          }));

          // Parse sizes from catalog sizeRange (e.g. "S to 3XL")
          const sizeNames = parseSizeRange(catalog.sizeRange ?? "");
          const sizes = sizeNames.map((s, i) => ({ id: i + 1, name: s, code: s }));

          // Build SKU grid (color × size) with pricing from catalog
          const skus: Array<{ sizeId: number; colorId: number; price: number; cost: number; sku: string; dnSkuId: string }> = [];
          for (const [ci, colour] of uniqueColours.entries()) {
            const price = colour.singlePrice ? parseFloat(colour.singlePrice) : 0;
            for (const [si] of sizes.entries()) {
              skus.push({
                sizeId: si + 1,
                colorId: ci + 1,
                price,
                cost: 0,
                sku: `${productCode}-${colour.colourCode}-${sizes[si].code}`,
                dnSkuId: "",
              });
            }
          }

          // Get images from catalog
          const images = await catalogImages(productCode);

          logger.info({ decoProductId, productCode, colors: colors.length, sizes: sizes.length, images: images.length }, "Product detail served from local catalog");

          return {
            productId: parseInt(decoProductId) || 0,
            productCode: catalog.styleCode,
            productName: catalog.name,
            supplier: catalog.brand,
            brand: catalog.brand,
            category: catalog.productType ?? decoProduct?.category ?? "",
            colors,
            sizes,
            skus,
            images,
          };
        }
      } catch (err) {
        logger.warn({ err, productCode }, "Catalog lookup failed, falling back to Deco API");
      }
    }

    // Step 3: Fallback to live Deco API
    try {
      const detail = await fetchDecoProductDetail(decoProductId, querySku);
      return detail;
    } catch (err) {
      reply.status(502);
      return { error: err instanceof Error ? err.message : "Failed to fetch product detail" };
    }
  });

  // ── Decoration methods reference ──
  app.get("/v1/quotes/decoration-methods", async () => {
    return {
      items: [
        { key: "dtf", label: "DTF Transfer", description: "Direct to Film" },
        { key: "embroidery", label: "Embroidery", description: "Thread embroidery" },
        { key: "dtg", label: "DTG Print", description: "Direct to Garment" },
        { key: "screen_print", label: "Screen Print", description: "Traditional screen printing" },
        { key: "sublimation", label: "Sublimation", description: "Dye sublimation" },
        { key: "vinyl", label: "Vinyl / HTV", description: "Heat transfer vinyl" },
        { key: "other", label: "Other", description: "Custom method" },
      ],
    };
  });

  // ── Email quote to customer ──
  app.post("/v1/quotes/:jobId/email", async (request) => {
    const { jobId } = request.params as { jobId: string };
    return emailQuote(jobId);
  });

  // ── Enriched quote detail (job + Deco product details per item) ──
  app.get("/v1/quote-detail/:jobId", async (request, reply) => {
    const { jobId } = z.object({ jobId: z.string() }).parse(request.params);

    const job = await prisma.job.findFirst({
      where: {
        OR: [{ id: jobId }, { internalJobId: jobId }],
      },
      include: {
        items: true,
        account: { include: { aliases: true } },
      },
    });

    if (!job) {
      reply.status(404);
      return { error: "Quote not found" };
    }

    // Enrich each item with Deco product details
    const enrichedItems = await Promise.all(
      job.items.map(async (item) => {
        const itemMeta = (item.metadata ?? {}) as Record<string, unknown>;
        let decoProductId = itemMeta.decoProductId as string | undefined;

        // Fallback: look up product by SKU from local DB if decoProductId wasn't saved
        if (!decoProductId && item.sku) {
          const localProduct = await prisma.decoProduct.findFirst({
            where: { sku: { equals: item.sku, mode: "insensitive" }, active: true },
            select: { decoProductId: true },
          });
          if (localProduct) {
            decoProductId = localProduct.decoProductId;
          }
        }

        let productDetail = null;
        if (decoProductId) {
          try {
            productDetail = await fetchDecoProductDetail(decoProductId, item.sku ?? undefined);
          } catch (err) {
            logger.warn({ err, decoProductId, itemId: item.id }, "Failed to fetch Deco product detail for enrichment");
          }
        }

        return {
          ...item,
          productDetail,
        };
      }),
    );

    return {
      ...job,
      items: enrichedItems,
    };
  });
}
