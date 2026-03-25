import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import {
  catalogLookup,
  catalogSearch,
  catalogStats,
  importCatalogFromRows,
} from "../services/catalog-service";

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
}
