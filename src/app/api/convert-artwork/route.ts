import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function POST(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Backend API is not configured." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const result = await fetchBackendJson<{ ok: boolean; previewUrl?: string; error?: string }>(
      "/api/convert",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        timeoutMs: 60_000,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Conversion failed" },
      { status: 502 },
    );
  }
}
