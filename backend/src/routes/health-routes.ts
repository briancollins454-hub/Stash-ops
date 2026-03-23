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
      const isJson = searchText.trim().startsWith("{") || searchText.trim().startsWith("[");
      let pageUrl: string | null = null;
      let searchFormat = "unknown";

      if (isJson) {
        const searchData = JSON.parse(searchText);
        if (searchData.Success && searchData.Data) {
          pageUrl = searchData.Data;
          searchFormat = "redirect";
        } else if (searchData.Entries?.length) {
          const exact = searchData.Entries.find((e: { EntryCode?: string }) => e.EntryCode?.toUpperCase() === code.toUpperCase());
          const entry = exact ?? searchData.Entries[0];
          if (entry?.DetailUrl) pageUrl = entry.DetailUrl;
          searchFormat = `entries(${searchData.Entries.length})`;
        }
      }

      if (!pageUrl) {
        return { code, searchFormat, pageUrl: null, searchTextLength: searchText.length, searchTextPreview: searchText.substring(0, 200) };
      }

      const pageRes = await fetch(pageUrl, { headers: { "User-Agent": "StashOps/1.0" }, signal: AbortSignal.timeout(15_000) });
      const html = await pageRes.text();
      const coloursMatch = html.match(/Colours:\s*'(\[.*?\])'/s);
      let colorCount = 0;
      if (coloursMatch) {
        const groups = JSON.parse(coloursMatch[1]);
        for (const g of groups) colorCount += (g.Colours ?? []).length;
      }

      return {
        code,
        searchFormat,
        pageUrl,
        htmlLength: html.length,
        hasColoursJson: !!coloursMatch,
        colorCount,
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
