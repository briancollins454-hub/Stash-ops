/**
 * Ralawise Product Catalog Service
 *
 * Provides fast, reliable product lookups from the imported Ralawise CSV feed.
 * Replaces fragile web scraping with DB-backed queries.
 */
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

// ── Types ──

export interface CatalogProductResult {
  styleCode: string;
  brand: string;
  name: string;
  productType: string | null;
  gender: string | null;
  ageGroup: string | null;
  fabric: string | null;
  weight: string | null;
  sizeRange: string | null;
  specification: string | null;
  primaryImageUrl: string | null;
  colours: CatalogColourResult[];
}

export interface CatalogColourResult {
  colourCode: string;
  colourName: string;
  imageUrl: string | null;
  rgb: string | null;
  pantone: string | null;
  cmyk: string | null;
  primaryColour: string | null;
  singlePrice: string | null;
  skuStatus: string | null;
}

// ── Lookups ──

/** Look up a product by style code (e.g. "JH030") */
export async function catalogLookup(styleCode: string): Promise<CatalogProductResult | null> {
  const product = await prisma.catalogProduct.findUnique({
    where: { styleCode: styleCode.toUpperCase() },
    include: { colours: { orderBy: { colourName: "asc" } } },
  });

  if (!product) return null;

  return {
    styleCode: product.styleCode,
    brand: product.brand,
    name: product.name,
    productType: product.productType,
    gender: product.gender,
    ageGroup: product.ageGroup,
    fabric: product.fabric,
    weight: product.weight,
    sizeRange: product.sizeRange,
    specification: product.specification,
    primaryImageUrl: product.primaryImageUrl,
    colours: product.colours.map((c) => ({
      colourCode: c.colourCode,
      colourName: c.colourName,
      imageUrl: c.imageUrl,
      backImageUrl: c.backImageUrl,
      sideImageUrl: c.sideImageUrl,
      modelImageUrl: c.modelImageUrl,
      detailImageUrl: c.detailImageUrl,
      rgb: c.rgb,
      pantone: c.pantone,
      cmyk: c.cmyk,
      primaryColour: c.primaryColour,
      singlePrice: c.singlePrice,
      skuStatus: c.skuStatus,
    })),
  };
}

/** Get colour-specific images for a style code — used by the image pipeline */
export async function catalogImages(
  styleCode: string,
): Promise<Array<{ url: string; type: "front" | "back" | "side" | "gallery"; color?: string; rgb?: string }>> {
  const product = await prisma.catalogProduct.findUnique({
    where: { styleCode: styleCode.toUpperCase() },
    include: { colours: true },
  });

  if (!product) return [];

  const images: Array<{ url: string; type: "front" | "back" | "side" | "gallery"; color?: string; rgb?: string }> = [];

  // Primary lifestyle image (no colour association)
  if (product.primaryImageUrl) {
    images.push({ url: product.primaryImageUrl, type: "front" });
  }

  // Per-colour images: front, back, side
  for (const colour of product.colours) {
    if (colour.skuStatus === "Discontinued") continue;
    const cleanName = colour.colourName.replace(/[*†]+$/g, "").trim();
    const rgbVal = colour.rgb ?? undefined;

    if (colour.imageUrl) {
      images.push({ url: colour.imageUrl, type: "front", color: cleanName, rgb: rgbVal });
    }
    if (colour.backImageUrl) {
      images.push({ url: colour.backImageUrl, type: "back", color: cleanName, rgb: rgbVal });
    }
    if (colour.sideImageUrl) {
      images.push({ url: colour.sideImageUrl, type: "side", color: cleanName, rgb: rgbVal });
    }
  }

  return images;
}

/** Search catalog products by name/code/brand */
export async function catalogSearch(
  query: string,
  limit = 20,
): Promise<Array<{ styleCode: string; brand: string; name: string; productType: string | null; colourCount: number }>> {
  const q = query.trim();
  if (!q) return [];

  const products = await prisma.catalogProduct.findMany({
    where: {
      OR: [
        { styleCode: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { _count: { select: { colours: true } } },
    take: limit,
    orderBy: { styleCode: "asc" },
  });

  return products.map((p) => ({
    styleCode: p.styleCode,
    brand: p.brand,
    name: p.name,
    productType: p.productType,
    colourCount: p._count.colours,
  }));
}

// ── CSV Import ──

// Supports both the old Ralawise CSV and the new PenCarrie/FullCollection CSV
interface CsvRow {
  "Style Code": string;
  "Manufacturer Style Code"?: string;
  "Supplier Code"?: string;
  Brand: string;
  "Style Name"?: string;
  Title?: string;
  "Colour Code"?: string;
  "Colourway Code"?: string;
  "Colour Name"?: string;
  "Colourway Name"?: string;
  "Colour Group"?: string;
  "Product Type"?: string;
  Type?: string;
  Gender?: string;
  "Age Group"?: string;
  Fabric?: string;
  Material?: string;
  "Weight (GSM)"?: string;
  Weight?: string;
  "Size Range"?: string;
  Specification?: string;
  "Retail Description"?: string;
  Body?: string;
  "Primary Product Image URL"?: string;
  "Model Image"?: string;
  "Front Image"?: string;
  "Back Image"?: string;
  "Side Image"?: string;
  "Detail Image"?: string;
  "Colour Image"?: string;
  RGB?: string;
  Pantone?: string;
  CMYK?: string;
  "Primary Colour"?: string;
  "Colour Shade"?: string;
  Categorisation?: string;
  "Suggested Categories"?: string;
  Accreditations?: string;
  Certifications?: string;
  Features?: string;
  Tag?: string;
  "Sustainable/Organic"?: string;
  "Print Area"?: string;
  "Embroidery Information"?: string;
  "Size Guide"?: string;
  "Spec Sheet"?: string;
  "Carton Price"?: string;
  "Carton List Price"?: string;
  "Pack Price"?: string;
  "Pack List Price"?: string;
  "Single Price"?: string;
  "Single List Price"?: string;
  "Carton Quantity"?: string;
  "Pack Quantity"?: string;
  "Sku Status"?: string;
  Discontinued?: string;
  [key: string]: string | undefined;
}

/** Import catalog data from parsed CSV rows */
export async function importCatalogFromRows(rows: CsvRow[]): Promise<{ products: number; colours: number }> {
  // Group rows by style code (many sizes map to same style+colour)
  const styleMap = new Map<string, { product: Partial<CsvRow>; colours: Map<string, CsvRow> }>();

  for (const row of rows) {
    const styleCode = (row["Style Code"] ?? "").trim().toUpperCase();
    if (!styleCode) continue;

    if (!styleMap.has(styleCode)) {
      styleMap.set(styleCode, { product: row, colours: new Map() });
    }

    // Support both old "Colour Code" and new "Colourway Code"
    const colourCode = (row["Colour Code"] ?? row["Colourway Code"] ?? "").trim();
    if (colourCode) {
      const entry = styleMap.get(styleCode)!;
      if (!entry.colours.has(colourCode)) {
        entry.colours.set(colourCode, row);
      }
    }
  }

  let productCount = 0;
  let colourCount = 0;

  // Process in batches of 100 styles
  const styleEntries = [...styleMap.entries()];
  const batchSize = 100;

  for (let i = 0; i < styleEntries.length; i += batchSize) {
    const batch = styleEntries.slice(i, i + batchSize);

    await prisma.$transaction(async (tx) => {
      for (const [styleCode, data] of batch) {
        const row = data.product;

        // Support both old (Ralawise) and new (PenCarrie/FullCollection) CSV column names
        const productData = {
          manufacturerCode: s(row["Manufacturer Style Code"] ?? row["Supplier Code"]),
          brand: s(row.Brand) ?? "Unknown",
          name: s(row["Style Name"] ?? row.Title) ?? styleCode,
          productType: s(row["Product Type"] ?? row.Type),
          gender: s(row.Gender),
          ageGroup: s(row["Age Group"]),
          fabric: s(row.Fabric ?? row.Material),
          weight: s(row["Weight (GSM)"] ?? row.Weight),
          sizeRange: s(row["Size Range"]),
          specification: s(row.Specification),
          retailDescription: s(row["Retail Description"] ?? row.Body),
          primaryImageUrl: s(row["Primary Product Image URL"] ?? row["Model Image"]),
          categorisation: s(row.Categorisation ?? row["Suggested Categories"]),
          accreditations: s(row.Accreditations ?? row.Certifications),
          tag: s(row.Tag ?? row.Features),
          sustainable: s(row["Sustainable/Organic"]),
          printArea: s(row["Print Area"]),
          embroideryInfo: s(row["Embroidery Information"]),
          sizeGuideUrl: s(row["Size Guide"]),
          specSheetUrl: s(row["Spec Sheet"]),
        };

        await tx.catalogProduct.upsert({
          where: { styleCode },
          create: { styleCode, ...productData },
          update: productData,
        });
        productCount++;

        // Upsert colours
        for (const [colourCode, cRow] of data.colours) {
          const colourData = {
            colourName: s(cRow["Colour Name"] ?? cRow["Colourway Name"]) ?? colourCode,
            imageUrl: s(cRow["Colour Image"] ?? cRow["Front Image"]),
            backImageUrl: s(cRow["Back Image"]),
            sideImageUrl: s(cRow["Side Image"]),
            modelImageUrl: s(cRow["Model Image"]),
            detailImageUrl: s(cRow["Detail Image"]),
            rgb: s(cRow.RGB),
            pantone: s(cRow.Pantone),
            cmyk: s(cRow.CMYK),
            primaryColour: s(cRow["Primary Colour"]),
            colourShade: s(cRow["Colour Shade"] ?? cRow["Colour Group"]),
            cartonPrice: s(cRow["Carton Price"] ?? cRow["Carton List Price"]),
            packPrice: s(cRow["Pack Price"] ?? cRow["Pack List Price"]),
            singlePrice: s(cRow["Single Price"] ?? cRow["Single List Price"]),
            cartonQty: s(cRow["Carton Quantity"]),
            packQty: s(cRow["Pack Quantity"]),
            skuStatus: cRow.Discontinued === "TRUE" ? "Discontinued" : s(cRow["Sku Status"]),
          };

          await tx.catalogColour.upsert({
            where: { styleCode_colourCode: { styleCode, colourCode } },
            create: { styleCode, colourCode, ...colourData },
            update: colourData,
          });
          colourCount++;
        }
      }
    });

    logger.info(`[Catalog] Imported batch ${i / batchSize + 1}/${Math.ceil(styleEntries.length / batchSize)} (${productCount} products, ${colourCount} colours)`);
  }

  logger.info({ productCount, colourCount }, "[Catalog] Import complete");
  return { products: productCount, colours: colourCount };
}

/** Trim empty strings to null */
function s(val: string | undefined | null): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  return trimmed || null;
}

/** Get catalog stats */
export async function catalogStats(): Promise<{ products: number; colours: number; lastUpdated: Date | null }> {
  const [products, colours, latest] = await Promise.all([
    prisma.catalogProduct.count(),
    prisma.catalogColour.count(),
    prisma.catalogProduct.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  return { products, colours, lastUpdated: latest?.updatedAt ?? null };
}
