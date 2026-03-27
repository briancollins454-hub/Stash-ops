import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }
  const { id } = await params;
  try {
    const payload = await fetchBackendJson(`/api/v1/decoration-profiles/${encodeURIComponent(id)}`);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Decoration profile not found" }, { status: 502 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }
  const { id } = await params;
  try {
    const body = await request.json();
    const payload = await fetchBackendJson(`/api/v1/decoration-profiles/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Failed to update decoration profile" }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }
  const { id } = await params;
  try {
    const payload = await fetchBackendJson(`/api/v1/decoration-profiles/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Failed to delete decoration profile" }, { status: 502 });
  }
}
