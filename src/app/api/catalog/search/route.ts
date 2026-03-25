import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json([], { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = searchParams.get("limit") ?? "20";

  try {
    const payload = await fetchBackendJson<unknown[]>(
      `/api/v1/catalog/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`,
    );
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}
