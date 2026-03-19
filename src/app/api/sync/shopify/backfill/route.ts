import { NextResponse } from "next/server";
import { enqueueSyncJob, getSyncEngineStatus } from "@/server/sync/auto-sync-engine";

export async function POST() {
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
