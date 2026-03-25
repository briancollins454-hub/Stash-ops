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

  // Per-colour front images
  for (const colour of product.colours) {
    if (colour.imageUrl && colour.skuStatus !== "Discontinued") {
      const cleanName = colour.colourName.replace(/[*†]+$/g, "").trim();
      images.push({
        url: colour.imageUrl,
        type: "front",
        color: cleanName,
        rgb: colour.rgb ?? undefined,
      });
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

interface CsvRow {
  "Style Code": string;
  "Manufacturer Style Code"?: string;
  Brand: string;
  "Style Name": string;
  "Colour Code": string;
  "Colour Name": string;
  "Product Type"?: string;
  Gender?: string;
  "Age Group"?: string;
  Fabric?: string;
  "Weight (GSM)"?: string;
  "Size Range"?: string;
  Specification?: string;
  "Retail Description"?: string;
  "Primary Product Image URL"?: string;
  "Colour Image"?: string;
  RGB?: string;
  Pantone?: string;
  CMYK?: string;
  "Primary Colour"?: string;
  "Colour Shade"?: string;
  Categorisation?: string;
  Accreditations?: string;
  Tag?: string;
  "Sustainable/Organic"?: string;
  "Print Area"?: string;
  "Embroidery Information"?: string;
  "Size Guide"?: string;
  "Spec Sheet"?: string;
  "Carton Price"?: string;
  "Pack Price"?: string;
  "Single Price"?: string;
  "Carton Quantity"?: string;
  "Pack Quantity"?: string;
  "Sku Status"?: string;
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

    const colourCode = (row["Colour Code"] ?? "").trim();
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

        // Upsert the product
        await tx.catalogProduct.upsert({
          where: { styleCode },
          create: {
            styleCode,
            manufacturerCode: s(row["Manufacturer Style Code"]),
            brand: s(row.Brand) ?? "Unknown",
            name: s(row["Style Name"]) ?? styleCode,
            productType: s(row["Product Type"]),
            gender: s(row.Gender),
            ageGroup: s(row["Age Group"]),
            fabric: s(row.Fabric),
            weight: s(row["Weight (GSM)"]),
            sizeRange: s(row["Size Range"]),
            specification: s(row.Specification),
            retailDescription: s(row["Retail Description"]),
            primaryImageUrl: s(row["Primary Product Image URL"]),
            categorisation: s(row.Categorisation),
            accreditations: s(row.Accreditations),
            tag: s(row.Tag),
            sustainable: s(row["Sustainable/Organic"]),
            printArea: s(row["Print Area"]),
            embroideryInfo: s(row["Embroidery Information"]),
            sizeGuideUrl: s(row["Size Guide"]),
            specSheetUrl: s(row["Spec Sheet"]),
          },
          update: {
            manufacturerCode: s(row["Manufacturer Style Code"]),
            brand: s(row.Brand) ?? "Unknown",
            name: s(row["Style Name"]) ?? styleCode,
            productType: s(row["Product Type"]),
            gender: s(row.Gender),
            ageGroup: s(row["Age Group"]),
            fabric: s(row.Fabric),
            weight: s(row["Weight (GSM)"]),
            sizeRange: s(row["Size Range"]),
            specification: s(row.Specification),
            retailDescription: s(row["Retail Description"]),
            primaryImageUrl: s(row["Primary Product Image URL"]),
            categorisation: s(row.Categorisation),
            accreditations: s(row.Accreditations),
            tag: s(row.Tag),
            sustainable: s(row["Sustainable/Organic"]),
            printArea: s(row["Print Area"]),
            embroideryInfo: s(row["Embroidery Information"]),
            sizeGuideUrl: s(row["Size Guide"]),
            specSheetUrl: s(row["Spec Sheet"]),
          },
        });
        productCount++;

        // Upsert colours
        for (const [colourCode, cRow] of data.colours) {
          await tx.catalogColour.upsert({
            where: { styleCode_colourCode: { styleCode, colourCode } },
            create: {
              styleCode,
              colourCode,
              colourName: s(cRow["Colour Name"]) ?? colourCode,
              imageUrl: s(cRow["Colour Image"]),
              rgb: s(cRow.RGB),
              pantone: s(cRow.Pantone),
              cmyk: s(cRow.CMYK),
              primaryColour: s(cRow["Primary Colour"]),
              colourShade: s(cRow["Colour Shade"]),
              cartonPrice: s(cRow["Carton Price"]),
              packPrice: s(cRow["Pack Price"]),
              singlePrice: s(cRow["Single Price"]),
              cartonQty: s(cRow["Carton Quantity"]),
              packQty: s(cRow["Pack Quantity"]),
              skuStatus: s(cRow["Sku Status"]),
            },
            update: {
              colourName: s(cRow["Colour Name"]) ?? colourCode,
              imageUrl: s(cRow["Colour Image"]),
              rgb: s(cRow.RGB),
              pantone: s(cRow.Pantone),
              cmyk: s(cRow.CMYK),
              primaryColour: s(cRow["Primary Colour"]),
              colourShade: s(cRow["Colour Shade"]),
              cartonPrice: s(cRow["Carton Price"]),
              packPrice: s(cRow["Pack Price"]),
              singlePrice: s(cRow["Single Price"]),
              cartonQty: s(cRow["Carton Quantity"]),
              packQty: s(cRow["Pack Quantity"]),
              skuStatus: s(cRow["Sku Status"]),
            },
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
