"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ──

interface Storefront {
  id: string;
  accountId: string;
  name: string;
  type: "PERMANENT" | "CAMPAIGN" | "EVENT" | "CUSTOM";
  shopifyTagPattern: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  notes: string | null;
  _count: { jobs: number; productAssignments: number };
}

interface DecorationProfile {
  id: string;
  accountId: string;
  name: string;
  decorationMethod: string;
  artworkAssetId: string | null;
  placementConfigId: string | null;
  colourway: string | null;
  isDefault: boolean;
  active: boolean;
  artworkAsset: { id: string; label: string; fileUrl: string | null } | null;
  placementConfig: { id: string; label: string; placementKey: string } | null;
  _count: { productAssignments: number; jobItems: number };
}

interface ProductAssignment {
  id: string;
  accountId: string;
  storefrontId: string | null;
  styleCode: string;
  active: boolean;
  catalogProduct: { styleCode: string; brand: string; name: string; primaryImageUrl: string | null; productType: string | null };
  decorationProfile: { id: string; name: string; decorationMethod: string } | null;
  storefront: { id: string; name: string; type: string } | null;
  _count: { jobItems: number };
}

interface AccountAssetOption {
  id: string;
  label: string;
  assetType: string;
  fileUrl: string | null;
}

interface PlacementConfigOption {
  id: string;
  label: string;
  placementKey: string;
}

type Tab = "storefronts" | "profiles" | "assignments";

export function AccountOperationsManager({
  accountId,
  assets,
  placementConfigs,
}: {
  accountId: string;
  assets: AccountAssetOption[];
  placementConfigs: PlacementConfigOption[];
}) {
  const [tab, setTab] = useState<Tab>("storefronts");
  const [storefronts, setStorefronts] = useState<Storefront[]>([]);
  const [profiles, setProfiles] = useState<DecorationProfile[]>([]);
  const [assignments, setAssignments] = useState<ProductAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Data Fetching ──

  const fetchStorefronts = useCallback(async () => {
    try {
      const res = await fetch(`/api/storefronts?accountId=${accountId}`);
      if (res.ok) setStorefronts(await res.json());
    } catch { /* ignore */ }
  }, [accountId]);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/decoration-profiles?accountId=${accountId}`);
      if (res.ok) setProfiles(await res.json());
    } catch { /* ignore */ }
  }, [accountId]);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(`/api/product-assignments?accountId=${accountId}`);
      if (res.ok) setAssignments(await res.json());
    } catch { /* ignore */ }
  }, [accountId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStorefronts(), fetchProfiles(), fetchAssignments()]).finally(() =>
      setLoading(false),
    );
  }, [fetchStorefronts, fetchProfiles, fetchAssignments]);

  // ── Tabs ──

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "storefronts", label: "Storefronts", count: storefronts.length },
    { key: "profiles", label: "Decoration Profiles", count: profiles.length },
    { key: "assignments", label: "Product Assignments", count: assignments.length },
  ];

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
        Operations Configuration
      </h3>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 rounded-lg p-1" style={{ background: "rgba(255,255,255,0.03)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: tab === t.key ? "rgba(255,255,255,0.08)" : "transparent",
              color: tab === t.key ? "var(--text-primary)" : "var(--text-tertiary)",
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 opacity-60">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs py-4 text-center" style={{ color: "var(--text-tertiary)" }}>
          Loading…
        </p>
      ) : (
        <>
          {tab === "storefronts" && (
            <StorefrontsTab
              accountId={accountId}
              storefronts={storefronts}
              onRefresh={fetchStorefronts}
            />
          )}
          {tab === "profiles" && (
            <DecorationProfilesTab
              accountId={accountId}
              profiles={profiles}
              assets={assets}
              placementConfigs={placementConfigs}
              onRefresh={fetchProfiles}
            />
          )}
          {tab === "assignments" && (
            <ProductAssignmentsTab
              accountId={accountId}
              assignments={assignments}
              storefronts={storefronts}
              profiles={profiles}
              onRefresh={fetchAssignments}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Storefronts Tab ──

function StorefrontsTab({
  accountId,
  storefronts,
  onRefresh,
}: {
  accountId: string;
  storefronts: Storefront[];
  onRefresh: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("PERMANENT");
  const [tagPattern, setTagPattern] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/storefronts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          name: name.trim(),
          type,
          shopifyTagPattern: tagPattern.trim() || undefined,
        }),
      });
      if (res.ok) {
        setName("");
        setType("PERMANENT");
        setTagPattern("");
        setShowForm(false);
        await onRefresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this storefront?")) return;
    await fetch(`/api/storefronts/${id}`, { method: "DELETE" });
    await onRefresh();
  };

  const typeLabels: Record<string, { label: string; color: string }> = {
    PERMANENT: { label: "Permanent", color: "#6ee7b7" },
    CAMPAIGN: { label: "Campaign", color: "#93c5fd" },
    EVENT: { label: "Event", color: "#c4b5fd" },
    CUSTOM: { label: "Custom", color: "#fbbf24" },
  };

  return (
    <div>
      {storefronts.length === 0 && !showForm && (
        <p className="text-xs py-2" style={{ color: "var(--text-tertiary)" }}>
          No storefronts configured. Add one to organise this account&apos;s selling channels.
        </p>
      )}

      {storefronts.map((sf) => {
        const tl = typeLabels[sf.type] ?? typeLabels.CUSTOM;
        return (
          <div
            key={sf.id}
            className="flex items-center justify-between rounded-lg p-3 mb-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: sf.active ? tl.color : "#6b7280" }}
              />
              <div>
                <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {sf.name}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {tl.label}
                  {sf.shopifyTagPattern && <> · Tag: {sf.shopifyTagPattern}</>}
                  {sf._count.jobs > 0 && <> · {sf._count.jobs} jobs</>}
                  {sf._count.productAssignments > 0 && <> · {sf._count.productAssignments} products</>}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDelete(sf.id)}
              className="text-[10px] px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
              style={{ color: "#f87171" }}
            >
              Delete
            </button>
          </div>
        );
      })}

      {showForm ? (
        <div className="rounded-lg p-3 mt-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input
              className="input text-xs"
              placeholder="Storefront name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select className="input text-xs" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="PERMANENT">Permanent</option>
              <option value="CAMPAIGN">Campaign</option>
              <option value="EVENT">Event</option>
              <option value="CUSTOM">Custom</option>
            </select>
            <input
              className="input text-xs"
              placeholder="Shopify tag pattern (optional)"
              value={tagPattern}
              onChange={(e) => setTagPattern(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="btn btn-primary text-xs px-3 py-1"
            >
              {saving ? "Saving…" : "Create"}
            </button>
            <button onClick={() => setShowForm(false)} className="btn text-xs px-3 py-1">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="text-xs mt-2 px-3 py-1.5 rounded-md transition-colors"
          style={{ color: "#60a5fa", background: "rgba(96,165,250,0.08)" }}
        >
          + Add Storefront
        </button>
      )}
    </div>
  );
}

// ── Decoration Profiles Tab ──

function DecorationProfilesTab({
  accountId,
  profiles,
  assets,
  placementConfigs,
  onRefresh,
}: {
  accountId: string;
  profiles: DecorationProfile[];
  assets: AccountAssetOption[];
  placementConfigs: PlacementConfigOption[];
  onRefresh: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [method, setMethod] = useState("embroidery");
  const [assetId, setAssetId] = useState("");
  const [placementId, setPlacementId] = useState("");

  const handleCreate = async () => {
    if (!name.trim() || !method.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/decoration-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          name: name.trim(),
          decorationMethod: method,
          artworkAssetId: assetId || undefined,
          placementConfigId: placementId || undefined,
        }),
      });
      if (res.ok) {
        setName("");
        setMethod("embroidery");
        setAssetId("");
        setPlacementId("");
        setShowForm(false);
        await onRefresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this decoration profile?")) return;
    await fetch(`/api/decoration-profiles/${id}`, { method: "DELETE" });
    await onRefresh();
  };

  const methodColors: Record<string, string> = {
    embroidery: "#6ee7b7",
    dtf: "#93c5fd",
    dtg: "#c4b5fd",
    screen_print: "#fbbf24",
  };

  return (
    <div>
      {profiles.length === 0 && !showForm && (
        <p className="text-xs py-2" style={{ color: "var(--text-tertiary)" }}>
          No decoration profiles. Create one to define how products get decorated for this account.
        </p>
      )}

      {profiles.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-lg p-3 mb-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: p.active ? (methodColors[p.decorationMethod] ?? "#9ca3af") : "#6b7280" }}
            />
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                {p.name}
                {p.isDefault && (
                  <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>
                    default
                  </span>
                )}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {p.decorationMethod}
                {p.artworkAsset && <> · {p.artworkAsset.label}</>}
                {p.placementConfig && <> · {p.placementConfig.label}</>}
                {p._count.productAssignments > 0 && <> · {p._count.productAssignments} products</>}
                {p._count.jobItems > 0 && <> · {p._count.jobItems} items</>}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDelete(p.id)}
            className="text-[10px] px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
            style={{ color: "#f87171" }}
          >
            Delete
          </button>
        </div>
      ))}

      {showForm ? (
        <div className="rounded-lg p-3 mt-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              className="input text-xs"
              placeholder="Profile name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select className="input text-xs" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="embroidery">Embroidery</option>
              <option value="dtf">DTF</option>
              <option value="dtg">DTG</option>
              <option value="screen_print">Screen Print</option>
              <option value="vinyl">Vinyl</option>
              <option value="sublimation">Sublimation</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select className="input text-xs" value={assetId} onChange={(e) => setAssetId(e.target.value)}>
              <option value="">— Artwork (optional) —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.assetType})
                </option>
              ))}
            </select>
            <select className="input text-xs" value={placementId} onChange={(e) => setPlacementId(e.target.value)}>
              <option value="">— Placement (optional) —</option>
              {placementConfigs.map((pc) => (
                <option key={pc.id} value={pc.id}>
                  {pc.label} ({pc.placementKey})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="btn btn-primary text-xs px-3 py-1"
            >
              {saving ? "Saving…" : "Create"}
            </button>
            <button onClick={() => setShowForm(false)} className="btn text-xs px-3 py-1">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="text-xs mt-2 px-3 py-1.5 rounded-md transition-colors"
          style={{ color: "#60a5fa", background: "rgba(96,165,250,0.08)" }}
        >
          + Add Decoration Profile
        </button>
      )}
    </div>
  );
}

// ── Product Assignments Tab ──

function ProductAssignmentsTab({
  accountId,
  assignments,
  storefronts,
  profiles,
  onRefresh,
}: {
  accountId: string;
  assignments: ProductAssignment[];
  storefronts: Storefront[];
  profiles: DecorationProfile[];
  onRefresh: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [styleSearch, setStyleSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; styleCode: string; brand: string; name: string; primaryImageUrl: string | null }[]
  >([]);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    styleCode: string;
    brand: string;
    name: string;
  } | null>(null);
  const [storefrontId, setStorefrontId] = useState("");
  const [profileId, setProfileId] = useState("");

  const handleSearch = async (q: string) => {
    setStyleSearch(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) setSearchResults(await res.json());
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    try {
      const res = await fetch("/api/product-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          catalogProductId: selectedProduct.id,
          storefrontId: storefrontId || undefined,
          decorationProfileId: profileId || undefined,
        }),
      });
      if (res.ok) {
        setSelectedProduct(null);
        setStyleSearch("");
        setSearchResults([]);
        setStorefrontId("");
        setProfileId("");
        setShowForm(false);
        await onRefresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this product assignment?")) return;
    await fetch(`/api/product-assignments/${id}`, { method: "DELETE" });
    await onRefresh();
  };

  return (
    <div>
      {assignments.length === 0 && !showForm && (
        <p className="text-xs py-2" style={{ color: "var(--text-tertiary)" }}>
          No product assignments. Add products from the catalog to assign them to this account.
        </p>
      )}

      {assignments.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between rounded-lg p-3 mb-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3">
            {a.catalogProduct.primaryImageUrl?.startsWith("http") && (
              <img
                src={`/api/image-proxy?url=${encodeURIComponent(a.catalogProduct.primaryImageUrl)}`}
                alt=""
                className="w-8 h-8 rounded object-cover"
                style={{ background: "rgba(255,255,255,0.05)" }}
              />
            )}
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                {a.catalogProduct.brand} {a.catalogProduct.name}
                <span className="ml-1.5 opacity-50">({a.styleCode})</span>
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {a.decorationProfile ? (
                  <>{a.decorationProfile.name} ({a.decorationProfile.decorationMethod})</>
                ) : (
                  "No decoration profile"
                )}
                {a.storefront && <> · {a.storefront.name}</>}
                {a._count.jobItems > 0 && <> · {a._count.jobItems} items produced</>}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleDelete(a.id)}
            className="text-[10px] px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
            style={{ color: "#f87171" }}
          >
            Remove
          </button>
        </div>
      ))}

      {showForm ? (
        <div className="rounded-lg p-3 mt-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
          {/* Product search */}
          <div className="mb-2 relative">
            <input
              className="input text-xs w-full"
              placeholder="Search products by style code or name…"
              value={styleSearch}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {searchResults.length > 0 && !selectedProduct && (
              <div
                className="absolute z-10 left-0 right-0 mt-1 rounded-lg overflow-hidden max-h-48 overflow-y-auto"
                style={{ background: "var(--card-bg, #1e1e2e)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedProduct(r);
                      setSearchResults([]);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {r.primaryImageUrl?.startsWith("http") && (
                      <img
                        src={`/api/image-proxy?url=${encodeURIComponent(r.primaryImageUrl)}`}
                        alt=""
                        className="w-6 h-6 rounded object-cover"
                      />
                    )}
                    <span>
                      <strong>{r.styleCode}</strong> — {r.brand} {r.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedProduct && (
              <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--text-primary)" }}>
                <span className="font-medium">{selectedProduct.styleCode}</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {selectedProduct.brand} {selectedProduct.name}
                </span>
                <button
                  onClick={() => { setSelectedProduct(null); setStyleSearch(""); }}
                  className="text-[10px] ml-auto"
                  style={{ color: "#f87171" }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Storefront + Profile selectors */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select className="input text-xs" value={storefrontId} onChange={(e) => setStorefrontId(e.target.value)}>
              <option value="">— Account-wide —</option>
              {storefronts.map((sf) => (
                <option key={sf.id} value={sf.id}>
                  {sf.name} ({sf.type})
                </option>
              ))}
            </select>
            <select className="input text-xs" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">— No decoration profile —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.decorationMethod})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !selectedProduct}
              className="btn btn-primary text-xs px-3 py-1"
            >
              {saving ? "Saving…" : "Assign Product"}
            </button>
            <button onClick={() => { setShowForm(false); setSelectedProduct(null); setStyleSearch(""); setSearchResults([]); }} className="btn text-xs px-3 py-1">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="text-xs mt-2 px-3 py-1.5 rounded-md transition-colors"
          style={{ color: "#60a5fa", background: "rgba(96,165,250,0.08)" }}
        >
          + Assign Product
        </button>
      )}
    </div>
  );
}
