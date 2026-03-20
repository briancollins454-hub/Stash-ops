import { MatchStatus, type Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { createManualJob } from "../services/order-service";
import { fetchDecoProductDetail } from "../services/deco-api-service";
import { normalizeMatchToken } from "../services/shopify-order-context";

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
        requiresArtwork:
          !!item.decorationMethod && item.decorationMethod !== "other",
        unitPriceMinor:
          item.unitPricePounds !== undefined
            ? Math.round(item.unitPricePounds * 100)
            : undefined,
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

  // ── Product detail (live from Deco API — colors, sizes, per-SKU pricing) ──
  app.get("/v1/quotes/products/:decoProductId/detail", async (request, reply) => {
    const { decoProductId } = z.object({ decoProductId: z.string() }).parse(request.params);

    try {
      const detail = await fetchDecoProductDetail(decoProductId);
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
}
