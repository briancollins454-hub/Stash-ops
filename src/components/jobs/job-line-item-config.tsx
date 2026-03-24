"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DesignerModal, type DesignConfig, type DesignerProductDetail } from "@/components/quotes/designer-modal";
import type { JobLineItem } from "@/lib/types";

/* ── Decoration methods ── */
const METHODS = [
  { key: "Embroidery", label: "Embroidery", icon: "🧵" },
  { key: "DTF", label: "DTF", icon: "🖨️" },
  { key: "DTG", label: "DTG", icon: "🎯" },
  { key: "Transfer", label: "Transfer", icon: "♨️" },
  { key: "Screen Print", label: "Screen Print", icon: "🖼️" },
  { key: "Sublimation", label: "Sublimation", icon: "🌈" },
] as const;

const PLACEMENTS = [
  "Left Chest", "Right Chest", "Centre Chest", "Full Front",
  "Full Back", "Left Sleeve", "Right Sleeve", "Collar", "Hem", "Pocket",
] as const;

interface Props {
  jobId: string;
  items: JobLineItem[];
}

/* ── Helpers ── */

function existingDesigns(item: JobLineItem): DesignConfig[] {
  if (!item.metadata || typeof item.metadata !== "object") return [];
  const md = item.metadata as Record<string, unknown>;
  if (Array.isArray(md.designs)) return md.designs as DesignConfig[];
  return [];
}

function buildProductDetail(item: JobLineItem): DesignerProductDetail {
  return {
    productName: item.productTitle,
    productCode: item.sku || "UNKNOWN",
    supplier: "Unknown",
    category: guessCategory(item.productTitle),
    colors: [],
    sizes: [],
  };
}

function guessCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("hood") || t.includes("hoodie")) return "Hoodies";
  if (t.includes("polo")) return "Polos";
  if (t.includes("jacket") || t.includes("soft shell") || t.includes("fleece")) return "Jackets";
  if (t.includes("trouser") || t.includes("jogger")) return "Trousers";
  if (t.includes("cap") || t.includes("hat") || t.includes("beanie")) return "Headwear";
  if (t.includes("bag") || t.includes("tote")) return "Bags";
  return "T-shirts";
}

function designSummary(designs: DesignConfig[]): string {
  if (designs.length === 0) return "";
  return designs.map((d) => `${d.placement} → ${d.decorationMethod}`).join(", ");
}

/* ── Product lookup types ── */

interface DecoSearchResult {
  decoProductId: string;
  name: string;
  sku: string;
  category: string;
}

type ProductLookupState = "idle" | "searching" | "loading" | "loaded" | "not_found" | "error";

/* ── Product lookup helper ── */

/**
 * Extract likely base product codes from SKU or title.
 * Deco variant SKUs look like "BC686-M-BLU" → base "BC686"
 * Titles look like "JH030 - AWDis sweatshirt" → code "JH030"
 * Also handles "56000 - SOL'S Ness Zip Neck Fleece" → code "56000"
 */
/** Keywords that identify the garment type for search + cross-checking */
const GARMENT_KEYWORDS = [
  "hoodie", "hoody", "hood", "sweatshirt", "sweater", "jumper",
  "polo", "t-shirt", "tee", "shirt", "vest", "tank",
  "jacket", "fleece", "soft shell", "softshell", "bodywarmer", "gilet",
  "trouser", "jogger", "pant", "short",
  "cap", "hat", "beanie", "snapback", "bucket",
  "bag", "tote", "backpack", "rucksack",
  "apron", "tabard", "overall",
] as const;

function extractGarmentType(text: string): string | null {
  const t = text.toLowerCase();
  for (const kw of GARMENT_KEYWORDS) {
    if (t.includes(kw)) return kw;
  }
  return null;
}

/** Group keywords into broad categories for mismatch detection */
function garmentCategory(keyword: string | null): string | null {
  if (!keyword) return null;
  const k = keyword.toLowerCase();
  if (["hoodie", "hoody", "hood", "sweatshirt", "sweater", "jumper"].includes(k)) return "sweatshirts";
  if (["polo", "t-shirt", "tee", "shirt", "vest", "tank"].includes(k)) return "tops";
  if (["jacket", "fleece", "soft shell", "softshell", "bodywarmer", "gilet"].includes(k)) return "outerwear";
  if (["trouser", "jogger", "pant", "short"].includes(k)) return "bottoms";
  if (["cap", "hat", "beanie", "snapback", "bucket"].includes(k)) return "headwear";
  if (["bag", "tote", "backpack", "rucksack"].includes(k)) return "bags";
  return null;
}

function extractSearchTerms(item: JobLineItem): string[] {
  const terms: string[] = [];

  // 1. From SKU: try full SKU, then strip variant suffix (take first segment before -)
  if (item.sku) {
    terms.push(item.sku);
    const baseSku = item.sku.split("-")[0].trim();
    // Only use base code if it's at least 3 chars (avoid generic "MC", "XL" etc)
    if (baseSku && baseSku !== item.sku && baseSku.length >= 3) {
      terms.push(baseSku);
    }
  }

  // 2. From title: extract product code at the start (e.g., "JH030 - AWDis sweatshirt")
  if (item.productTitle) {
    const codeMatch = item.productTitle.match(/^([A-Za-z0-9]{3,10})\s*[-–—:]/);
    if (codeMatch) {
      const code = codeMatch[1];
      if (!terms.includes(code)) terms.push(code);
    }

    // 3. Extract garment type keyword for fallback search (e.g., "hoody", "polo")
    const garmentKw = extractGarmentType(item.productTitle);
    if (garmentKw && !terms.includes(garmentKw)) {
      terms.push(garmentKw);
    }

    // Also add full title as last resort
    terms.push(item.productTitle);
  }

  return terms;
}

/** Score how well a catalogue result matches a job line item */
function scoreMatch(result: DecoSearchResult, item: JobLineItem): number {
  let score = 0;
  const rSku = (result.sku || "").toLowerCase();
  const rName = (result.name || "").toLowerCase();
  const iSku = (item.sku || "").toLowerCase();
  const iTitle = (item.productTitle || "").toLowerCase();

  // ── Category mismatch penalty ──
  // If the item title says "hoody" but the result is a "snapback", reject it
  const itemGarment = extractGarmentType(iTitle);
  const resultGarment = extractGarmentType(rName);
  const itemCat = garmentCategory(itemGarment);
  const resultCat = garmentCategory(resultGarment);
  if (itemCat && resultCat && itemCat !== resultCat) return -1;

  // Exact SKU match (variant SKU = catalogue SKU)
  if (iSku && rSku === iSku) return 100;

  // Base product code match (catalogue SKU is prefix of item SKU)
  if (iSku && rSku && rSku.length >= 3 && iSku.startsWith(rSku)) score += 80;
  // Or item SKU contains the catalogue SKU (must be 3+ chars to avoid false positives)
  else if (iSku && rSku && rSku.length >= 3 && iSku.includes(rSku)) score += 60;
  // Or catalogue SKU is in the title
  else if (rSku && rSku.length >= 3 && iTitle.includes(rSku)) score += 50;

  // Name-based matching
  if (rName && iTitle && (rName.includes(iTitle) || iTitle.includes(rName))) score += 30;

  // Title starts with same product code
  const titleCode = iTitle.match(/^([a-z0-9]{3,10})\s*[-–—:]/)?.[1];
  if (titleCode && rSku === titleCode) score += 70;
  if (titleCode && rName.startsWith(titleCode)) score += 40;

  // Same garment type bonus
  if (itemCat && resultCat && itemCat === resultCat) score += 15;

  return score;
}

async function searchProducts(query: string): Promise<DecoSearchResult[]> {
  try {
    const res = await fetch(`/api/quotes/products?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as DecoSearchResult[];
  } catch {
    return [];
  }
}

async function fetchProductDetail(decoProductId: string, item: JobLineItem): Promise<DesignerProductDetail | null> {
  try {
    const skuParam = item.sku ? `?sku=${encodeURIComponent(item.sku)}` : "";
    const res = await fetch(`/api/quotes/products/${encodeURIComponent(decoProductId)}${skuParam}`);
    if (!res.ok) return null;
    const detail = await res.json();
    return {
      productName: detail.productName ?? item.productTitle,
      productCode: detail.productCode ?? item.sku ?? "UNKNOWN",
      supplier: detail.supplier ?? "Unknown",
      brand: detail.brand,
      category: detail.category ?? guessCategory(item.productTitle),
      colors: detail.colors ?? [],
      sizes: detail.sizes ?? [],
      images: detail.images ?? [],
    };
  } catch {
    return null;
  }
}

async function lookupProduct(item: JobLineItem): Promise<DesignerProductDetail | null> {
  const terms = extractSearchTerms(item);

  // Try each search term, collect all results, score them
  const allResults: DecoSearchResult[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    const results = await searchProducts(term);
    for (const r of results) {
      if (r.decoProductId && !seen.has(r.decoProductId)) {
        seen.add(r.decoProductId);
        allResults.push(r);
      }
    }
    // Stop searching once we have a result with a good, category-compatible match
    if (allResults.length > 0) {
      const topScore = Math.max(...allResults.map((r) => scoreMatch(r, item)));
      if (topScore >= 50) break;
    }
  }

  if (allResults.length === 0) return null;

  // Pick the best match (must score > 0 to avoid category mismatches)
  const scored = allResults
    .map((r) => ({ result: r, score: scoreMatch(r, item) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 || !scored[0].result.decoProductId) return null;

  return fetchProductDetail(scored[0].result.decoProductId, item);
}

/* ── Component ── */

export function JobLineItemConfig({ jobId, items }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Per-item edit state
  const [editMethod, setEditMethod] = useState<Record<string, string>>({});
  const [editPlacement, setEditPlacement] = useState<Record<string, string>>({});
  const [editDesigns, setEditDesigns] = useState<Record<string, DesignConfig[]>>({});

  // Product detail cache & lookup state
  const [productDetails, setProductDetails] = useState<Record<string, DesignerProductDetail>>({});
  const [productState, setProductState] = useState<Record<string, ProductLookupState>>({});
  const lookupRef = useRef<Set<string>>(new Set());

  // Designer modal state
  const [designerOpen, setDesignerOpen] = useState(false);
  const [designerItem, setDesignerItem] = useState<JobLineItem | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => (prev === id ? null : id));
    setError(null);
    setSuccess(null);
  }, []);

  // Initialize edit state when expanding an item
  const expandItem = useCallback((item: JobLineItem) => {
    toggleExpand(item.id);
    if (!editMethod[item.id]) {
      setEditMethod((prev) => ({ ...prev, [item.id]: item.decorationMethod || "" }));
      setEditPlacement((prev) => ({ ...prev, [item.id]: item.decorationPlacement || "" }));
      setEditDesigns((prev) => ({ ...prev, [item.id]: existingDesigns(item) }));
    }
  }, [editMethod, toggleExpand]);

  // Auto-lookup product when item is expanded
  useEffect(() => {
    if (!expanded) return;
    const item = items.find((i) => i.id === expanded);
    if (!item) return;
    if (lookupRef.current.has(item.id)) return; // already attempted
    lookupRef.current.add(item.id);

    setProductState((prev) => ({ ...prev, [item.id]: "searching" }));

    lookupProduct(item).then((detail) => {
      if (detail) {
        setProductDetails((prev) => ({ ...prev, [item.id]: detail }));
        setProductState((prev) => ({ ...prev, [item.id]: "loaded" }));
      } else {
        setProductState((prev) => ({ ...prev, [item.id]: "not_found" }));
      }
    }).catch(() => {
      setProductState((prev) => ({ ...prev, [item.id]: "error" }));
    });
  }, [expanded, items]);

  const saveItem = useCallback(async (item: JobLineItem) => {
    setSaving(item.id);
    setError(null);
    setSuccess(null);

    const method = editMethod[item.id] || undefined;
    const placement = editPlacement[item.id] || undefined;
    const designs = editDesigns[item.id];

    try {
      const res = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update_item",
          itemId: item.id,
          decorationMethod: method,
          decorationPlacement: placement,
          designs: designs?.length ? designs : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setError(data.error || "Failed to save");
      } else {
        setSuccess(`Saved decoration for ${item.productTitle}`);
        setTimeout(() => router.refresh(), 500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(null);
    }
  }, [jobId, editMethod, editPlacement, editDesigns, router]);

  const openDesigner = useCallback((item: JobLineItem) => {
    setDesignerItem(item);
    setDesignerOpen(true);
  }, []);

  const handleDesignerApply = useCallback((designs: DesignConfig[]) => {
    if (!designerItem) return;
    setEditDesigns((prev) => ({ ...prev, [designerItem.id]: designs }));

    // Auto-set method & placement from first design
    if (designs.length > 0) {
      const first = designs[0];
      setEditMethod((prev) => ({ ...prev, [designerItem.id]: first.decorationMethod }));
      const placements = designs.map((d) => d.placement).join(", ");
      setEditPlacement((prev) => ({ ...prev, [designerItem.id]: placements }));
    }

    setDesignerOpen(false);
    setDesignerItem(null);
  }, [designerItem]);

  return (
    <>
      <div className="space-y-3">
        {items.map((item, i) => {
          const isExpanded = expanded === item.id;
          const isSaving = saving === item.id;
          const method = editMethod[item.id] ?? item.decorationMethod ?? "";
          const placement = editPlacement[item.id] ?? item.decorationPlacement ?? "";
          const designs = editDesigns[item.id] ?? existingDesigns(item);
          const hasDecoration = Boolean(item.decorationMethod) || existingDesigns(item).length > 0;

          return (
            <div key={item.id} className="card overflow-hidden">
              {/* ── Header row (always visible, clickable) ── */}
              <button
                onClick={() => expandItem(item)}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-all hover:brightness-110"
              >
                {/* Line number */}
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                  style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}
                >
                  {i + 1}
                </span>

                {/* Product info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.sku && (
                      <span className="shrink-0 font-mono text-xs font-medium" style={{ color: "var(--accent-light)" }}>{item.sku}</span>
                    )}
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {item.productTitle}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                    {item.variantTitle && <>{item.variantTitle} · </>}Qty {item.quantity}
                    {item.decorationMethod && ` · ${item.decorationMethod}`}
                    {item.decorationPlacement && ` @ ${item.decorationPlacement}`}
                  </p>
                  {designs.length > 0 && (
                    <p className="mt-0.5 truncate text-[11px]" style={{ color: "#a5b4fc" }}>
                      {designSummary(designs)}
                    </p>
                  )}
                </div>

                {/* Status indicator */}
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={
                    hasDecoration
                      ? { background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.25)" }
                      : { background: "rgba(245,158,11,0.12)", color: "#fcd34d", border: "1px solid rgba(245,158,11,0.25)" }
                  }
                >
                  {hasDecoration ? "Configured" : "Needs setup"}
                </span>

                {/* Chevron */}
                <svg
                  className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  style={{ color: "var(--text-tertiary)" }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* ── Expanded config panel ── */}
              {isExpanded && (
                <div className="space-y-4 border-t px-4 pb-5 pt-4" style={{ borderColor: "var(--border)" }}>
                  {/* Feedback */}
                  {error && expanded === item.id && (
                    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
                      {error}
                    </div>
                  )}
                  {success && expanded === item.id && (
                    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(16,185,129,0.1)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}>
                      {success}
                    </div>
                  )}

                  {/* Decoration method selector */}
                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
                      Decoration method
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {METHODS.map((m) => (
                        <button
                          key={m.key}
                          onClick={() => setEditMethod((prev) => ({ ...prev, [item.id]: m.key }))}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                          style={
                            method === m.key
                              ? { background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.4)" }
                              : { background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
                          }
                        >
                          {m.icon} {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Placement selector */}
                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
                      Placement
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PLACEMENTS.map((p) => (
                        <button
                          key={p}
                          onClick={() => setEditPlacement((prev) => ({ ...prev, [item.id]: p }))}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                          style={
                            placement === p
                              ? { background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.4)" }
                              : { background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
                          }
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Product match indicator */}
                  {(productState[item.id] === "searching" || productState[item.id] === "loading") && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
                      Finding product in catalogue...
                    </div>
                  )}
                  {productState[item.id] === "loaded" && productDetails[item.id] && (
                    <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#6ee7b7" }}>
                      <span>✓</span>
                      <span>Matched: <strong>{productDetails[item.id].productName}</strong> ({productDetails[item.id].supplier})</span>
                      {productDetails[item.id].colors.length > 0 && (
                        <span style={{ color: "var(--text-tertiary)" }}>· {productDetails[item.id].colors.length} colours · {productDetails[item.id].images?.length ?? 0} images</span>
                      )}
                    </div>
                  )}
                  {productState[item.id] === "not_found" && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      No product match found in Deco catalogue — studio will use generic garment template
                    </div>
                  )}

                  {/* Designs summary */}
                  {designs.length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
                        Design placements ({designs.length})
                      </p>
                      <div className="space-y-1">
                        {designs.map((d, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                            <span className="h-1.5 w-1.5 rounded-full bg-[#6366f1]" />
                            <span className="font-medium" style={{ color: "var(--text-primary)" }}>{d.placement}</span>
                            <span>→</span>
                            <span>{d.decorationMethod}</span>
                            {d.artworkName && <span className="truncate" style={{ color: "var(--text-tertiary)" }}>({d.artworkName})</span>}
                            {d.stitchCount && <span style={{ color: "var(--text-tertiary)" }}>{d.stitchCount.toLocaleString()} stitches</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openDesigner(item)}
                      disabled={productState[item.id] === "searching" || productState[item.id] === "loading"}
                      className="rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:brightness-125 disabled:opacity-50"
                      style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
                    >
                      {productState[item.id] === "searching" || productState[item.id] === "loading"
                        ? "Loading product..."
                        : "🎨 Open studio"}
                    </button>

                    <button
                      onClick={() => saveItem(item)}
                      disabled={isSaving}
                      className="rounded-lg px-4 py-2 text-xs font-semibold transition-all hover:brightness-125 disabled:opacity-50"
                      style={{ background: "rgba(16,185,129,0.15)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.3)" }}
                    >
                      {isSaving ? "Saving..." : "💾 Save decoration"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Designer Modal ── */}
      {designerItem && (
        <DesignerModal
          open={designerOpen}
          onClose={() => {
            setDesignerOpen(false);
            setDesignerItem(null);
          }}
          onApply={handleDesignerApply}
          productDetail={productDetails[designerItem.id] ?? buildProductDetail(designerItem)}
          initialDesigns={editDesigns[designerItem.id] ?? existingDesigns(designerItem)}
        />
      )}
    </>
  );
}
