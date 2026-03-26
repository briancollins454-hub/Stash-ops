"use client";

import { useEffect, useState, useCallback } from "react";

interface BrandSummary {
  name: string;
  count: number;
}

interface ProductTypeSummary {
  name: string;
  count: number;
}

interface ProductItem {
  id: string;
  styleCode: string;
  brand: string;
  name: string;
  productType: string | null;
  gender: string | null;
  primaryImageUrl: string | null;
  colourCount: number;
}

interface BrowseResponse {
  total: number;
  brands: BrandSummary[];
  productTypes: ProductTypeSummary[];
  items: ProductItem[];
}

type ViewMode = "brands" | "types" | "products";

export function ProductCatalogBrowser() {
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("brands");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [productDetail, setProductDetail] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (brand?: string, productType?: string) => {
    setLoading(true);
    try {
      let qs = "";
      if (brand) qs += `&brand=${encodeURIComponent(brand)}`;
      if (productType) qs += `&productType=${encodeURIComponent(productType)}`;
      if (qs) qs = "?" + qs.slice(1);
      const res = await fetch(`/api/v1/catalog/browse${qs}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBrandClick = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedType(null);
    setViewMode("products");
    load(brand);
  };

  const handleTypeClick = (type: string) => {
    setSelectedType(type);
    setSelectedBrand(null);
    setViewMode("products");
    load(undefined, type);
  };

  const handleBack = () => {
    setSelectedBrand(null);
    setSelectedType(null);
    setExpandedProduct(null);
    setProductDetail(null);
    setViewMode("brands");
    load();
  };

  const handleDeleteProduct = async (styleCode: string) => {
    if (!confirm(`Delete product ${styleCode}? This will also remove all its colour variants.`)) return;
    setDeleting(styleCode);
    try {
      const res = await fetch(`/api/v1/catalog/products/${encodeURIComponent(styleCode)}`, { method: "DELETE" });
      if (res.ok) {
        setData((prev) =>
          prev ? { ...prev, total: prev.total - 1, items: prev.items.filter((p) => p.styleCode !== styleCode) } : prev
        );
      }
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  };

  const handleDeleteBrand = async (brand: string) => {
    const count = data?.brands.find((b) => b.name === brand)?.count ?? 0;
    if (!confirm(`Delete ALL ${count} products from "${brand}"? This cannot be undone.`)) return;
    setDeleting(brand);
    try {
      const res = await fetch(`/api/v1/catalog/brands/${encodeURIComponent(brand)}`, { method: "DELETE" });
      if (res.ok) {
        load();
      }
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  };

  const handleViewProduct = async (styleCode: string) => {
    if (expandedProduct === styleCode) {
      setExpandedProduct(null);
      setProductDetail(null);
      return;
    }
    setExpandedProduct(styleCode);
    try {
      const res = await fetch(`/api/catalog/products/${encodeURIComponent(styleCode)}`);
      if (res.ok) setProductDetail(await res.json());
    } catch { /* ignore */ }
  };

  if (loading && !data) {
    return (
      <p className="py-6 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
        Loading catalog...
      </p>
    );
  }

  if (!data || data.total === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        No products in catalog. Upload a supplier CSV above to get started.
      </p>
    );
  }

  // Filter items by search
  const filteredItems = search.trim()
    ? data.items.filter(
        (p) =>
          p.styleCode.toLowerCase().includes(search.toLowerCase()) ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.brand && p.brand.toLowerCase().includes(search.toLowerCase()))
      )
    : data.items;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div
        className="rounded-xl p-4"
        style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#93c5fd" }}>
          Product catalog
        </p>
        <div className="grid grid-cols-3 gap-3">
          <StatCell label="Total products" value={data.total} />
          <StatCell label="Brands" value={data.brands.length} />
          <StatCell label="Product types" value={data.productTypes.length} />
        </div>
      </div>

      {/* View mode tabs */}
      <div className="flex items-center gap-2">
        {(selectedBrand || selectedType) && (
          <button
            onClick={handleBack}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:brightness-125"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            ← All
          </button>
        )}
        {!selectedBrand && !selectedType && (
          <>
            <TabButton active={viewMode === "brands"} onClick={() => setViewMode("brands")}>
              By Brand
            </TabButton>
            <TabButton active={viewMode === "types"} onClick={() => setViewMode("types")}>
              By Type
            </TabButton>
            <TabButton active={viewMode === "products"} onClick={() => setViewMode("products")}>
              All Products
            </TabButton>
          </>
        )}
        {selectedBrand && (
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            {selectedBrand}
            <span className="ml-1.5 font-normal" style={{ color: "var(--text-tertiary)" }}>
              ({filteredItems.length} products)
            </span>
          </span>
        )}
        {selectedType && (
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            {selectedType}
            <span className="ml-1.5 font-normal" style={{ color: "var(--text-tertiary)" }}>
              ({filteredItems.length} products)
            </span>
          </span>
        )}
      </div>

      {/* Brand grid */}
      {viewMode === "brands" && !selectedBrand && !selectedType && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {data.brands.map((b) => (
            <div
              key={b.name}
              className="group rounded-xl p-3 flex items-center justify-between transition-all hover:brightness-125 cursor-pointer"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              onClick={() => handleBrandClick(b.name)}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {b.name}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {b.count} product{b.count !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteBrand(b.name); }}
                  disabled={deleting === b.name}
                  className="rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "#fca5a5" }}
                  title={`Delete all ${b.name} products`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <svg className="h-4 w-4" style={{ color: "var(--text-tertiary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product type grid */}
      {viewMode === "types" && !selectedBrand && !selectedType && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
          {data.productTypes.map((t) => (
            <div
              key={t.name}
              className="rounded-xl p-3 flex items-center justify-between transition-all hover:brightness-125 cursor-pointer"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              onClick={() => handleTypeClick(t.name)}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {t.name}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {t.count} product{t.count !== 1 ? "s" : ""}
                </p>
              </div>
              <svg className="h-4 w-4 shrink-0" style={{ color: "var(--text-tertiary)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
        </div>
      )}

      {/* Product list view */}
      {(viewMode === "products" || selectedBrand || selectedType) && (
        <div className="space-y-2">
          {/* Search */}
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-xs"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--text-primary)",
              border: "1px solid rgba(255,255,255,0.08)",
              outline: "none",
            }}
          />

          {/* Products */}
          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredItems.map((p) => (
              <div key={p.styleCode}>
                <div
                  className="group rounded-xl p-3 flex items-center gap-3 transition-all hover:brightness-110 cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  onClick={() => handleViewProduct(p.styleCode)}
                >
                  {/* Thumbnail */}
                  <div
                    className="h-12 w-12 shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    {p.primaryImageUrl?.startsWith("http") ? (
                      <img
                        src={`/api/image-proxy?url=${encodeURIComponent(p.primaryImageUrl)}`}
                        alt={p.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-lg">👕</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {p.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                        {p.styleCode}
                      </span>
                      {!selectedBrand && (
                        <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                          {p.brand}
                        </span>
                      )}
                      {p.productType && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px]"
                          style={{ background: "rgba(99,102,241,0.1)", color: "#a5b4fc" }}
                        >
                          {p.productType}
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                        {p.colourCount} colour{p.colourCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProduct(p.styleCode); }}
                      disabled={deleting === p.styleCode}
                      className="rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "#fca5a5" }}
                      title="Delete product"
                    >
                      {deleting === p.styleCode ? (
                        <span className="text-[10px]">...</span>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                    <svg
                      className="h-4 w-4 transition-transform"
                      style={{
                        color: "var(--text-tertiary)",
                        transform: expandedProduct === p.styleCode ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedProduct === p.styleCode && productDetail && (
                  <ProductDetailPanel product={productDetail} />
                )}
              </div>
            ))}
            {filteredItems.length === 0 && (
              <p className="py-4 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
                No products match your search.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductDetailPanel({ product }: { product: Record<string, unknown> }) {
  const colours = (product.colours ?? []) as Array<{
    colourCode: string;
    colourName: string;
    imageUrl: string | null;
    rgb: string | null;
    singlePrice: string | null;
    skuStatus: string | null;
  }>;

  return (
    <div
      className="rounded-b-xl -mt-1 p-4 space-y-3"
      style={{ background: "rgba(255,255,255,0.02)", borderLeft: "1px solid rgba(255,255,255,0.06)", borderRight: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Product info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
        {product.gender ? <InfoCell label="Gender" value={product.gender as string} /> : null}
        {product.fabric ? <InfoCell label="Fabric" value={product.fabric as string} /> : null}
        {product.weight ? <InfoCell label="Weight" value={product.weight as string} /> : null}
        {product.sizeRange ? <InfoCell label="Sizes" value={product.sizeRange as string} /> : null}
      </div>

      {/* Colours */}
      {colours.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
            Colours ({colours.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {colours.map((c) => {
              const rgbParts = c.rgb?.split(" ").map(Number);
              const bgColor = rgbParts?.length === 3 ? `rgb(${rgbParts[0]},${rgbParts[1]},${rgbParts[2]})` : "rgba(255,255,255,0.1)";
              const isLight = rgbParts?.length === 3 && (rgbParts[0] * 299 + rgbParts[1] * 587 + rgbParts[2] * 114) / 1000 > 150;
              const discontinued = c.skuStatus === "Discontinued";

              return (
                <div
                  key={c.colourCode}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    opacity: discontinued ? 0.4 : 1,
                  }}
                  title={`${c.colourName} (${c.colourCode})${c.singlePrice ? ` — £${c.singlePrice}` : ""}${discontinued ? " — Discontinued" : ""}`}
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{
                      background: bgColor,
                      border: isLight ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(255,255,255,0.15)",
                    }}
                  />
                  <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {c.colourName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        {value.toLocaleString()}
      </p>
      <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{label}</p>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold" style={{ color: "var(--text-tertiary)" }}>{label}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
      style={{
        background: active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
        color: active ? "#a5b4fc" : "var(--text-tertiary)",
        border: `1px solid ${active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      {children}
    </button>
  );
}
