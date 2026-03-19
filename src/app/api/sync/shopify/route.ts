import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";
import { enqueueSyncJob, getSyncEngineStatus } from "@/server/sync/auto-sync-engine";

export async function POST() {
  if (isBackendApiConfigured()) {
    try {
      const payload = await fetchBackendJson<{
        ok: boolean;
        provider: "shopify";
        queued: number;
        pages: number;
      }>("/api/sync/shopify/backfill", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          maxPages: 1,
        }),
      });

      return NextResponse.json({
        accepted: true,
        status: "queued",
        provider: "shopify",
        generatedAt: new Date().toISOString(),
        note: `Queued ${payload.queued} order event(s) from ${payload.pages} page(s).`,
        backend: true,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to queue Shopify sync on backend.",
        },
        { status: 502 },
      );
    }
  }

  const job = enqueueSyncJob("shopify", "manual", "Manual Shopify sync requested from UI.");
  const status = getSyncEngineStatus();

  return NextResponse.json({
    accepted: true,
    status: "queued",
    generatedAt: status.generatedAt,
    job,
    provider: status.providers.find((provider) => provider.provider === "shopify"),
  });
}
