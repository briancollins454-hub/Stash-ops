import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function POST(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API is not configured." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const result = await fetchBackendJson<{ ok: boolean; jobId: string; internalJobId: string }>(
      "/api/v1/quotes",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create quote." },
      { status: 502 },
    );
  }
}
