"use client";

import { useState, useEffect, useCallback } from "react";
import { Decorator } from "@/components/decorator/decorator";
import { CatalogGarmentPicker } from "@/components/production/catalog-garment-picker";
import type { DesignerProductDetail, DesignConfig } from "@/components/decorator/types";
import type { ProductionBatchDetail } from "@/lib/types";

// ── Garment keyword extraction ──

const GARMENT_KEYWORDS = [
  "hoody", "hoodie", "hood", "sweatshirt", "polo", "t-shirt", "tee",
  "jersey", "vest", "fleece", "jacket", "shorts", "short", "pant",
  "tracksuit", "bottoms", "skirt", "shirt", "1/4 zip", "quarter zip",
  "1/2 zip", "half zip", "full zip", "gilet", "coat", "softshell",
  "baselayer", "base layer", "snood", "beanie", "cap", "socks", "bag",
];

/** Pull garment-type keyword from a product title, e.g. "Ballyclare High School Leavers 2026 - Premium Hoody - Grey" → "hoody" */
function extractGarmentKeyword(title: string): string | null {
  const lower = title.toLowerCase();
  for (const kw of GARMENT_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

/** Extract the vendor name from the first source line's metadata */
function extractVendor(batch: ProductionBatchDetail): string | null {
  for (const item of batch.items) {
    for (const sl of item.sourceLines) {
      if (sl.jobItem?.productTitle) {
        // Vendor isn't directly on the type — but we can infer from the batch
        // The batch already stores the account relationship
      }
    }
  }
  return null;
}

// ── localStorage cache for style code mappings ──

const MAPPING_KEY = "stash-garment-mapping";

function getSavedMapping(productKey: string): string | null {
  try {
    const data = JSON.parse(localStorage.getItem(MAPPING_KEY) || "{}");
    return data[productKey] || null;
  } catch {
    return null;
  }
}

function saveMapping(productKey: string, styleCode: string) {
  try {
    const data = JSON.parse(localStorage.getItem(MAPPING_KEY) || "{}");
    data[productKey] = styleCode;
    localStorage.setItem(MAPPING_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

/** Build a stable key for a batch's product — account + normalised product title */
function mappingKey(batch: ProductionBatchDetail): string {
  return `${batch.accountId}::${batch.normalizedProduct}`;
}

// ── Component ──

interface Props {
  batch: ProductionBatchDetail;
}

export function BatchDecoratorButton({ batch }: Props) {
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState<DesignConfig[]>([]);
  const [productDetail, setProductDetail] = useState<DesignerProductDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [matchStatus, setMatchStatus] = useState<"loading" | "matched" | "unmatched">("loading");

  /** Fetch the catalog product by style code and set it as the active garment */
  const loadCatalogProduct = useCallback(async (styleCode: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/decorator/products/${encodeURIComponent(styleCode)}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setProductDetail(data);
      setMatchStatus("matched");
    } catch {
      setMatchStatus("unmatched");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const key = mappingKey(batch);

    // 1. Check saved mapping first
    const savedStyleCode = getSavedMapping(key);
    if (savedStyleCode) {
      loadCatalogProduct(savedStyleCode);
      return;
    }

    // 2. Try auto-match: extract garment keyword from title and search catalog
    const garmentType = extractGarmentKeyword(batch.displayTitle);
    if (!garmentType) {
      setMatchStatus("unmatched");
      setLoading(false);
      return;
    }

    setLoading(true);
    // Search catalog by garment keyword
    fetch(`/api/decorator/catalog-search?q=${encodeURIComponent(garmentType)}&limit=20`)
      .then((res) => res.json())
      .then((data: { items?: Array<{ styleCode: string; brand: string; name: string; productType: string | null }> }) => {
        const items = data.items ?? [];
        if (items.length === 0) {
          setMatchStatus("unmatched");
          return;
        }

        // Score results: prefer matching brand/vendor keywords from the batch title
        const titleLower = batch.displayTitle.toLowerCase();
        type Scored = typeof items[0] & { score: number };
        const scored: Scored[] = items.map((item) => {
          let score = 0;
          const brandLower = item.brand.toLowerCase();

          // Brand match — e.g. "Canterbury" appears in title or batch data
          if (titleLower.includes(brandLower)) score += 50;

          // Product type match — "hood" in a "Hood" productType
          if (item.productType && garmentType && item.productType.toLowerCase().includes(garmentType)) score += 30;

          // Name similarity — words from the catalog product name in the batch title
          const nameWords = item.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          for (const w of nameWords) {
            if (titleLower.includes(w)) score += 10;
          }

          return { ...item, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];

        // Only auto-select if we have a reasonable confidence (brand matched)
        if (best.score >= 50) {
          saveMapping(key, best.styleCode);
          return loadCatalogProduct(best.styleCode);
        }

        // Otherwise leave it unmatched so the user can manually pick
        setMatchStatus("unmatched");
      })
      .catch(() => {
        setMatchStatus("unmatched");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [batch, loadCatalogProduct]);

  // Fallback product detail (no images — just text)
  const fallbackProductDetail: DesignerProductDetail = {
    productName: batch.displayTitle,
    productCode: batch.normalizedProduct || "BATCH-CUSTOM",
    supplier: "Unknown",
    brand: batch.accountName,
    colors: batch.colour ? [{ id: 1, name: batch.colour }] : [{ id: 1, name: "Default" }],
    sizes: batch.items.map((item, i) => ({ id: i + 1, code: item.size })),
    images: [],
  };

  const finalProductDetail = productDetail || fallbackProductDetail;

  const handleApply = (newDesigns: DesignConfig[]) => {
    setDesigns(newDesigns);
    setOpen(false);
  };

  const handlePickGarment = (styleCode: string) => {
    saveMapping(mappingKey(batch), styleCode);
    setShowPicker(false);
    loadCatalogProduct(styleCode);
  };

  const garmentKeyword = extractGarmentKeyword(batch.displayTitle) || "";

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          disabled={loading}
          className="inline-block rounded-md px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "#6366f1", color: "#fff" }}
        >
          {loading ? "Loading..." : designs.length > 0 ? `Edit Placements (${designs.length})` : "Open Decorator"}
        </button>

        {/* Show garment match status + change button */}
        {matchStatus === "matched" && productDetail && (
          <button
            onClick={() => setShowPicker(true)}
            className="rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border, #334155)", color: "var(--text-secondary, #94a3b8)" }}
            title="Change the blank garment used in the decorator"
          >
            Garment: {productDetail.productCode} ✓
          </button>
        )}
        {matchStatus === "unmatched" && !loading && (
          <button
            onClick={() => setShowPicker(true)}
            className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
            style={{ borderColor: "#f59e0b", color: "#f59e0b" }}
          >
            Select Garment
          </button>
        )}
      </div>

      {/* Garment picker modal */}
      {showPicker && (
        <CatalogGarmentPicker
          initialQuery={garmentKeyword}
          onSelect={handlePickGarment}
          onCancel={() => setShowPicker(false)}
        />
      )}

      {/* Decorator modal */}
      {open && (
        <Decorator
          open={open}
          onClose={() => setOpen(false)}
          onApply={handleApply}
          productDetail={finalProductDetail}
          selectedColorId={finalProductDetail.colors.find(c => c.name.toLowerCase() === batch.colour?.toLowerCase() || c.name === batch.colour)?.id || 1}
          initialDesigns={designs}
          accountId={batch.accountId}
        />
      )}
    </>
  );
}
