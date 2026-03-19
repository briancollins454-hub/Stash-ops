import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

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

  return NextResponse.json({
    accepted: false,
    error: "Backend API is not configured. Set BACKEND_API_URL.",
  }, { status: 503 });
}
