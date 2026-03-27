import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
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

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }

  const { batchId } = await params;
  const body = await request.json();

  try {
    const payload = await fetchBackendJson(`/api/v1/batches/${encodeURIComponent(batchId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }

  const { batchId } = await params;
  const body = await request.json();
  const { action, ...rest } = body as { action: string; [key: string]: unknown };

  const routeMap: Record<string, string> = {
    transition: "transition",
    "match-template": "match-template",
    snapshot: "snapshot",
  };

  const subRoute = routeMap[action];
  if (!subRoute) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  try {
    const payload = await fetchBackendJson(
      `/api/v1/batches/${encodeURIComponent(batchId)}/${subRoute}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest),
      }
    );
    return NextResponse.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
