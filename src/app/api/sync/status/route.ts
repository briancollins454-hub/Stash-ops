import { NextResponse } from "next/server";
import { getSyncEngineStatus, runAutoSyncIfStale } from "@/server/sync/auto-sync-engine";

export async function GET() {
  const scheduledProviders = runAutoSyncIfStale();
  const status = getSyncEngineStatus();

  return NextResponse.json({
    data: status,
    scheduledProviders,
    generatedAt: status.generatedAt,
  });
}
