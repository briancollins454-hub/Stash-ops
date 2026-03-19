import { NextResponse } from "next/server";
import { getCommandCenterData } from "@/lib/data-repository";
import { runAutoSyncIfStale } from "@/server/sync/auto-sync-engine";

export async function GET() {
  const scheduledProviders = runAutoSyncIfStale();
  const data = await getCommandCenterData();

  return NextResponse.json({
    data,
    scheduledProviders,
    generatedAt: new Date().toISOString(),
  });
}
