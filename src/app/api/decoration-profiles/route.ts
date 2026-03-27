import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json([], { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId") ?? "";
  const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";

  try {
    const payload = await fetchBackendJson(`/api/v1/decoration-profiles${qs}`);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const payload = await fetchBackendJson("/api/v1/decoration-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(payload, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create decoration profile" }, { status: 502 });
  }
}
