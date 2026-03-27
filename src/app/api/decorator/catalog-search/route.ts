import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

/** Search the supplier catalog for garments. Used by the batch decorator garment picker. */
export async function GET(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = searchParams.get("limit") ?? "20";

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  try {
    const results = await fetchBackendJson<
      Array<{ styleCode: string; brand: string; name: string; productType: string | null; colourCount: number }>
    >(`/api/v1/catalog/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`);

    return NextResponse.json({ items: results ?? [] });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
