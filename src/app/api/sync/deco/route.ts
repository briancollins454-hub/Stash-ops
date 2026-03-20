import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function POST() {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({
      accepted: false,
      error: "Backend API is not configured. Set BACKEND_API_URL.",
    }, { status: 503 });
  }

  try {
    const result = await fetchBackendJson<{
      ok: boolean;
      customers?: { synced: number; total: number };
      products?: { synced: number; total: number };
      inventory?: { synced: number; total: number };
      orders?: { synced: number; total: number };
    }>("/api/sync/deco/all", {
      method: "POST",
    });

    return NextResponse.json({
      accepted: true,
      status: "completed",
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      accepted: false,
      error: error instanceof Error ? error.message : "Deco sync failed.",
    }, { status: 502 });
  }
}
