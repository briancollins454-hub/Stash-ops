import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ items: [], brands: [], productTypes: [], total: 0 }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand") ?? "";
  const productType = searchParams.get("productType") ?? "";

  let qs = "";
  if (brand) qs += `&brand=${encodeURIComponent(brand)}`;
  if (productType) qs += `&productType=${encodeURIComponent(productType)}`;
  if (qs) qs = "?" + qs.slice(1);

  try {
    const data = await fetchBackendJson(`/api/v1/catalog/browse${qs}`);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ items: [], brands: [], productTypes: [], total: 0 }, { status: 502 });
  }
}
