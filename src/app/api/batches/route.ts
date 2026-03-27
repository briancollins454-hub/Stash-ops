import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ items: [], total: 0 }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();

  try {
    const payload = await fetchBackendJson(`/api/v1/batches${qs ? `?${qs}` : ""}`, { timeoutMs: 30_000 });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ items: [], total: 0 }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { action } = body as { action?: string };

    if (action === "batch-all") {
      const payload = await fetchBackendJson("/api/v1/batches/batch-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        timeoutMs: 120_000,
      });
      return NextResponse.json(payload);
    }

    if (action === "batch-job") {
      const payload = await fetchBackendJson("/api/v1/batches/batch-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: body.jobId }),
      });
      return NextResponse.json(payload);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
