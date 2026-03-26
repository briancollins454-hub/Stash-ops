import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import {
  catalogLookup,
  catalogSearch,
  catalogStats,
  importCatalogFromRows,
} from "../services/catalog-service";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export async function registerCatalogRoutes(app: FastifyInstance): Promise<void> {
  // ── Stats ──
  app.get("/v1/catalog/stats", async () => {
    return catalogStats();
  });

  // ── Search products ──
  app.get("/v1/catalog/search", async (request) => {
    const { q, limit } = z
      .object({ q: z.string(), limit: z.coerce.number().int().min(1).max(100).default(20) })
      .parse(request.query);
    return catalogSearch(q, limit);
  });

  // ── Product detail ──
  app.get("/v1/catalog/products/:styleCode", async (request, reply) => {
    const { styleCode } = z.object({ styleCode: z.string() }).parse(request.params);
    const product = await catalogLookup(styleCode);
    if (!product) {
      reply.status(404);
      return { error: `Product ${styleCode} not found in catalog` };
    }
    return product;
  });

  // ── CSV Import (upload) ──
  app.post("/v1/catalog/import", { bodyLimit: 250 * 1024 * 1024 }, async (request, reply) => {
    const body = request.body as string;
    if (!body || typeof body !== "string") {
      reply.status(400);
      return { error: "Request body must be CSV text (Content-Type: text/csv or text/plain)" };
    }

    try {
      const rows = parse(body, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as Record<string, string>[];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await importCatalogFromRows(rows as any);
      return { ok: true, ...result };
    } catch (err) {
      reply.status(500);
      return { error: err instanceof Error ? err.message : "Import failed" };
    }
  });

  // ── Browse products grouped by brand ──
  app.get("/v1/catalog/browse", async (request) => {
    const { brand, productType } = z
      .object({
        brand: z.string().optional(),
        productType: z.string().optional(),
      })
      .parse(request.query);

    const where: Record<string, unknown> = {};
    if (brand) where.brand = brand;
    if (productType) where.productType = productType;

    const [products, brands, productTypes] = await Promise.all([
      prisma.catalogProduct.findMany({
        where,
        include: { _count: { select: { colours: true } } },
        orderBy: [{ brand: "asc" }, { name: "asc" }],
      }),
      prisma.catalogProduct.groupBy({
        by: ["brand"],
        _count: true,
        orderBy: { brand: "asc" },
      }),
      prisma.catalogProduct.groupBy({
        by: ["productType"],
        _count: true,
        orderBy: { productType: "asc" },
      }),
    ]);

    return {
      total: products.length,
      brands: brands.map((b) => ({ name: b.brand, count: b._count })),
      productTypes: productTypes
        .filter((t) => t.productType)
        .map((t) => ({ name: t.productType!, count: t._count })),
      items: products.map((p) => ({
        id: p.id,
        styleCode: p.styleCode,
        brand: p.brand,
        name: p.name,
        productType: p.productType,
        gender: p.gender,
        primaryImageUrl: p.primaryImageUrl,
        colourCount: p._count.colours,
        updatedAt: p.updatedAt,
      })),
    };
  });

  // ── Delete a single product ──
  app.delete("/v1/catalog/products/:styleCode", async (request, reply) => {
    const { styleCode } = z.object({ styleCode: z.string() }).parse(request.params);
    try {
      await prisma.catalogProduct.delete({ where: { styleCode: styleCode.toUpperCase() } });
      return { ok: true, deleted: styleCode.toUpperCase() };
    } catch {
      reply.status(404);
      return { error: `Product ${styleCode} not found` };
    }
  });

  // ── Delete all products for a brand ──
  app.delete("/v1/catalog/brands/:brand", async (request) => {
    const { brand } = z.object({ brand: z.string() }).parse(request.params);
    const decoded = decodeURIComponent(brand);
    const result = await prisma.catalogProduct.deleteMany({ where: { brand: decoded } });
    logger.info(`[Catalog] Deleted ${result.count} products for brand "${decoded}"`);
    return { ok: true, deleted: result.count, brand: decoded };
  });
}
