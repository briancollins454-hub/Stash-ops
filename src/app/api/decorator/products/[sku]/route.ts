import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

/**
 * Fetch a supplier catalog product by style code and map it into the
 * DesignerProductDetail shape used by the Decorator component.
 *
 * GET /api/decorator/products/:sku
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sku: string }> }
) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API not configured" }, { status: 503 });
  }

  const { sku } = await params;

  try {
    const catalogData = await fetchBackendJson<any>(
      `/api/v1/catalog/products/${encodeURIComponent(sku)}`
    );

    if (!catalogData) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Deduplicate colours
    const seenNames = new Map<string, any>();
    for (const c of (catalogData.colours || [])) {
      if (c.skuStatus === "Discontinued") continue;
      const cleanName = c.colourName.replace(/[*\u2020]+$/g, "").trim();
      const existing = seenNames.get(cleanName);
      if (!existing || (c.skuStatus === "Live" && existing.skuStatus !== "Live")) {
        seenNames.set(cleanName, c);
      }
    }
    const uniqueColours = Array.from(seenNames.values());

    const colors = uniqueColours.map((c, i) => ({
      id: i + 1,
      name: c.colourName.replace(/[*\u2020]+$/g, "").trim(),
    }));

    // Sizes
    let sizeNames: string[] = [];
    if (catalogData.sizeRange) {
      sizeNames = catalogData.sizeRange.split(/[,/]+/).map((s: string) => s.trim()).filter(Boolean);
    }
    if (sizeNames.length === 0) {
      sizeNames = ["S", "M", "L", "XL"];
    }
    const sizes = sizeNames.map((s, i) => ({ id: i + 1, code: s, name: s }));

    // Images — front, back, side per colour
    const images: Array<{ url: string; type: string; color?: string }> = [];

    if (catalogData.primaryImageUrl) {
      images.push({ url: catalogData.primaryImageUrl, type: "front" });
    }

    for (const c of uniqueColours) {
      const colorName = c.colourName.replace(/[*\u2020]+$/g, "").trim();
      if (c.imageUrl) images.push({ url: c.imageUrl, type: "front", color: colorName });
      if (c.backImageUrl) images.push({ url: c.backImageUrl, type: "back", color: colorName });
      if (c.sideImageUrl) images.push({ url: c.sideImageUrl, type: "side", color: colorName });
    }

    return NextResponse.json({
      productCode: catalogData.styleCode,
      productName: catalogData.name,
      supplier: catalogData.brand,
      brand: catalogData.brand,
      category: catalogData.productType || "",
      colors,
      sizes,
      images,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch and map product" }, { status: 500 });
  }
}
