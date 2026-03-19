import { NextResponse } from "next/server";
import { isBackendApiConfigured } from "@/lib/backend-api";
import { listOrders } from "@/lib/data-repository";
import { runAutoSyncIfStale } from "@/server/sync/auto-sync-engine";

export async function GET() {
  const scheduledProviders = isBackendApiConfigured() ? [] : runAutoSyncIfStale();
  const data = await listOrders();

  return NextResponse.json({
    data,
    count: data.length,
    scheduledProviders,
    generatedAt: new Date().toISOString(),
  });
}
