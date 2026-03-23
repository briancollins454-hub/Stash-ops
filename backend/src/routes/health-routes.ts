import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { redisHealthClient } from "../queue/connection";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return {
      ok: true,
      service: "stash-ops-backend",
      timestamp: new Date().toISOString(),
    };
  });

  // Temporary debug endpoint for Ralawise scraping
  app.get("/debug/ralawise-search", async (request) => {
    const { q } = request.query as { q?: string };
    const code = q ?? "JH030";
    try {
      const searchRes = await fetch(
        `https://shop.ralawise.com/search?q=${encodeURIComponent(code)}`,
        { headers: { "User-Agent": "StashOps/1.0", "Accept": "application/json" }, signal: AbortSignal.timeout(10_000) },
      );
      const searchText = await searchRes.text();
      const contentType = searchRes.headers.get("content-type") ?? "unknown";
      const isJson = searchText.trim().startsWith("{") || searchText.trim().startsWith("[");

      // Just return raw diagnostic info, don't try to fetch the page
      if (!isJson) {
        return {
          code,
          contentType,
          format: "non-json",
          length: searchText.length,
          preview: searchText.substring(0, 300),
        };
      }

      const searchData = JSON.parse(searchText);
      const keys = Object.keys(searchData);
      const hasSuccess = "Success" in searchData;
      const hasData = "Data" in searchData;
      const hasEntries = "Entries" in searchData;

      let pageUrl: string | null = null;
      if (hasSuccess && searchData.Success && hasData) {
        pageUrl = typeof searchData.Data === "string" ? searchData.Data : `[non-string: ${typeof searchData.Data}]`;
      }
      if (!pageUrl && hasEntries && Array.isArray(searchData.Entries) && searchData.Entries.length > 0) {
        const entry = searchData.Entries.find((e: Record<string, unknown>) =>
          typeof e.EntryCode === "string" && e.EntryCode.toUpperCase() === code.toUpperCase()
        ) ?? searchData.Entries[0];
        const detailUrl = entry?.DetailUrl;
        pageUrl = typeof detailUrl === "string" ? detailUrl : `[non-string: ${typeof detailUrl}]`;
      }

      return {
        code,
        contentType,
        format: "json",
        keys,
        hasSuccess,
        successValue: searchData.Success,
        hasData,
        dataType: typeof searchData.Data,
        hasEntries,
        entriesCount: Array.isArray(searchData.Entries) ? searchData.Entries.length : "not-array",
        pageUrl,
      };
    } catch (err) {
      return { error: String(err), code };
    }
  });

  app.get("/ready", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redisHealthClient.ping();
      return {
        ok: true,
        dependencies: {
          postgres: "ok",
          redis: "ok",
        },
      };
    } catch (error) {
      app.log.error({ err: error }, "Readiness check failed");
      reply.status(503);
      return {
        ok: false,
        dependencies: {
          postgres: "error",
          redis: "error",
        },
      };
    }
  });
}
