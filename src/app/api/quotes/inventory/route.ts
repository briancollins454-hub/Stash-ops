import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const sku = searchParams.get("sku") ?? "";
  const productId = searchParams.get("productId") ?? "";

  try {
    const params = new URLSearchParams();
    if (sku) params.set("sku", sku);
    if (productId) params.set("productId", productId);
    params.set("limit", "200");

    const payload = await fetchBackendJson<{ total: number; items: unknown[] }>(
      `/api/v1/quotes/inventory?${params.toString()}`,
    );
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch inventory." },
      { status: 502 },
    );
  }
}
