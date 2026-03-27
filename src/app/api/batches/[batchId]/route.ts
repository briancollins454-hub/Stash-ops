import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }

  const { batchId } = await params;

  try {
    const payload = await fetchBackendJson(`/api/v1/batches/${encodeURIComponent(batchId)}`);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Failed to load batch" }, { status: 502 });
  }
}
