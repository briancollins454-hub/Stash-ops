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
        body: JSON.stringify({}),
      });

      return NextResponse.json({
        accepted: true,
        status: "queued",
        provider: "shopify",
        queued: payload.queued,
        pages: payload.pages,
        generatedAt: new Date().toISOString(),
        backend: true,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to trigger Shopify backfill on backend.",
        },
        { status: 502 },
      );
    }
  }

  const job = enqueueSyncJob(
    "shopify",
    "manual",
    "backfill-unfulfilled",
  );
  const status = getSyncEngineStatus();

  return NextResponse.json({
    accepted: true,
    status: "queued",
    generatedAt: status.generatedAt,
    job,
    provider: status.providers.find((provider) => provider.provider === "shopify"),
  });
}
