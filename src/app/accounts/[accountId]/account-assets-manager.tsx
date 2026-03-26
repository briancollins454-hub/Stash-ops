"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AccountAsset } from "./page";

interface DecoDesign {
  id: string;
  name: string;
  thumbnailUrl: string;
  fullUrl: string;
  decoCustomerId: string;
}

interface Props {
  accountId: string;
  accountName: string;
  initialAssets: AccountAsset[];
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  LOGO: "Logo / Badge",
  TEMPLATE: "Template",
  DESIGN_REFERENCE: "Design Reference",
  PROOF: "Proof",
};

const ASSET_TYPE_OPTIONS = ["LOGO", "TEMPLATE", "DESIGN_REFERENCE", "PROOF"] as const;

export function AccountAssetsManager({ accountId, accountName, initialAssets }: Props) {
  const [assets, setAssets] = useState<AccountAsset[]>(initialAssets);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [label, setLabel] = useState("");
  const [assetType, setAssetType] = useState<(typeof ASSET_TYPE_OPTIONS)[number]>("LOGO");
  const [fileUrl, setFileUrl] = useState("");
  const [decorationMethod, setDecorationMethod] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const resetForm = () => {
    setLabel("");
    setAssetType("LOGO");
    setFileUrl("");
    setDecorationMethod("");
    setIsDefault(false);
    setPreviewUrl(null);
    setAdding(false);
  };

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) return; // 10MB limit

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewUrl(dataUrl);
      setFileUrl(dataUrl);
      if (!label) setLabel(file.name.replace(/\.[^.]+$/, ""));
    };
    reader.readAsDataURL(file);
  }, [label]);

  const handleSave = async () => {
    if (!label.trim() || !fileUrl.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/accounts/${accountId}/assets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assetType,
          label: label.trim(),
          fileUrl: fileUrl.trim(),
          decorationMethod: decorationMethod.trim() || undefined,
          isDefault,
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setAssets((prev) => [...prev, data]);
        resetForm();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    setDeleting(assetId);
    try {
      const res = await fetch(`/api/v1/accounts/${accountId}/assets/${assetId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
      }
    } finally {
      setDeleting(null);
    }
  };

  const logos = assets.filter((a) => a.assetType === "LOGO");
  const others = assets.filter((a) => a.assetType !== "LOGO");

  return (
    <div className="space-y-6">
      {/* Logos / Badges section */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Logos & Badges
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              Saved artwork available in the decorator for {accountName}
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:brightness-125"
            style={{
              background: "rgba(99,102,241,0.15)",
              color: "#a5b4fc",
              border: "1px solid rgba(99,102,241,0.3)",
            }}
          >
            + Add Artwork
          </button>
        </div>

        {/* Asset grid */}
        {logos.length === 0 && !adding ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
            No logos or badges saved yet. Add artwork to make it available in the decorator.
          </p>
        ) : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
            {logos.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDelete={() => handleDelete(asset.id)}
                deleting={deleting === asset.id}
              />
            ))}
          </div>
        )}

        {/* Add form */}
        {adding && (
          <div
            className="mt-4 rounded-xl p-4 space-y-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <h4 className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Add New Artwork
            </h4>

            {/* File upload zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all hover:brightness-110"
              style={{
                borderColor: previewUrl ? "#6366f1" : "rgba(255,255,255,0.1)",
                background: previewUrl ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.02)",
              }}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="mx-auto h-20 object-contain" />
              ) : (
                <>
                  <p className="text-2xl mb-1">📁</p>
                  <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Click to upload logo / badge
                  </p>
                  <p className="mt-1 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    PNG, JPG, SVG, PDF
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".png,.jpg,.jpeg,.svg,.pdf,.eps,.ai"
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            {/* Label */}
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. School Crest, Club Badge"
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6366f1]"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
            </div>

            {/* Type + method row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Type
                </label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as (typeof ASSET_TYPE_OPTIONS)[number])}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--text-primary)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {ASSET_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t} style={{ background: "#1e1e2e" }}>
                      {ASSET_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Decoration Method
                </label>
                <input
                  type="text"
                  value={decorationMethod}
                  onChange={(e) => setDecorationMethod(e.target.value)}
                  placeholder="e.g. embroidery, DTG"
                  className="mt-1 w-full rounded-lg px-3 py-2 text-xs outline-none transition-all focus:ring-1 focus:ring-[#6366f1]"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--text-primary)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
              </div>
            </div>

            {/* Default checkbox */}
            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded"
              />
              Set as default artwork for this account
            </label>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={resetForm}
                className="rounded-lg px-3 py-1.5 text-xs transition-all"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !label.trim() || !fileUrl.trim()}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold transition-all hover:brightness-125 disabled:opacity-50"
                style={{
                  background: "rgba(16,185,129,0.15)",
                  color: "#6ee7b7",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                {saving ? "Saving..." : "Save Artwork"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Deco Artwork from customer uploads */}
      <DecoArtworkSection accountId={accountId} />

      {/* Other assets */}
      {others.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Other Assets
          </h3>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
            {others.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDelete={() => handleDelete(asset.id)}
                deleting={deleting === asset.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssetCard({
  asset,
  onDelete,
  deleting,
}: {
  asset: AccountAsset;
  onDelete: () => void;
  deleting: boolean;
}) {
  const isImage = asset.fileUrl && /\.(png|jpe?g|svg|webp|gif)$/i.test(asset.fileUrl);
  const isDataUrl = asset.fileUrl?.startsWith("data:image/");

  return (
    <div
      className="group relative rounded-xl overflow-hidden transition-all hover:brightness-110"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Thumbnail */}
      <div className="aspect-square flex items-center justify-center" style={{ background: "rgba(255,255,255,0.02)" }}>
        {(isImage || isDataUrl) && asset.fileUrl ? (
          <img src={asset.fileUrl} alt={asset.label} className="h-full w-full object-contain p-3" />
        ) : (
          <div className="text-3xl">🎨</div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {asset.label}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
            style={{
              background: asset.assetType === "LOGO" ? "rgba(59,130,246,0.12)" : "rgba(156,163,175,0.12)",
              color: asset.assetType === "LOGO" ? "#93c5fd" : "#d1d5db",
            }}
          >
            {asset.assetType}
          </span>
          {asset.isDefault && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7" }}
            >
              Default
            </span>
          )}
        </div>
        {asset.decorationMethod && (
          <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
            {asset.decorationMethod}
          </p>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        disabled={deleting}
        className="absolute top-1.5 right-1.5 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "rgba(0,0,0,0.6)", color: "#fca5a5" }}
        title="Delete artwork"
      >
        {deleting ? (
          <span className="text-[10px]">...</span>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </button>
    </div>
  );
}

function DecoArtworkSection({ accountId }: { accountId: string }) {
  const [designs, setDesigns] = useState<DecoDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/accounts/${accountId}/deco-artwork`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.items) setDesigns(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accountId]);

  if (!loading && designs.length === 0) return null;

  return (
    <div className="card p-5">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between mb-4">
        <div className="text-left">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            Deco Artwork
            {designs.length > 0 && (
              <span
                className="inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", minWidth: "1.2rem" }}
              >
                {designs.length}
              </span>
            )}
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            Customer designs synced from DecoNetwork
          </p>
        </div>
        <svg
          className="h-4 w-4 transition-transform"
          style={{ color: "var(--text-tertiary)", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        loading ? (
          <p className="py-6 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
            Loading Deco artwork...
          </p>
        ) : (
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
            {designs.map((d) => (
              <div
                key={d.id}
                className="group relative rounded-xl overflow-hidden transition-all hover:brightness-110 hover:ring-1 hover:ring-[#f59e0b]/40"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="aspect-square flex items-center justify-center" style={{ background: "rgba(255,255,255,0.02)" }}>
                  {d.thumbnailUrl ? (
                    <img
                      src={`/api/image-proxy?url=${encodeURIComponent(d.thumbnailUrl)}`}
                      alt={d.name}
                      className="h-full w-full object-contain p-3"
                    />
                  ) : (
                    <div className="text-3xl">🎨</div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {d.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                      style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}
                    >
                      Deco
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
