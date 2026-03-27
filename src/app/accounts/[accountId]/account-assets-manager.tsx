"use client";

import { useState, useRef, useCallback } from "react";
import type { AccountAsset } from "./page";

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
                accountId={accountId}
                onDelete={() => handleDelete(asset.id)}
                onUpdate={(updated) => setAssets((prev) => prev.map((a) => a.id === updated.id ? updated : (updated.isDefault && a.assetType === updated.assetType ? { ...a, isDefault: false } : a)))}
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
                accountId={accountId}
                onDelete={() => handleDelete(asset.id)}
                onUpdate={(updated) => setAssets((prev) => prev.map((a) => a.id === updated.id ? updated : (updated.isDefault && a.assetType === updated.assetType ? { ...a, isDefault: false } : a)))}
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
  accountId,
  onDelete,
  onUpdate,
  deleting,
}: {
  asset: AccountAsset;
  accountId: string;
  onDelete: () => void;
  onUpdate: (updated: AccountAsset) => void;
  deleting: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editLabel, setEditLabel] = useState(asset.label);
  const [editMethod, setEditMethod] = useState(asset.decorationMethod || "");
  const [editType, setEditType] = useState(asset.assetType);

  const isDataUrl = asset.fileUrl?.startsWith("data:image/");
  const isExternalImage = asset.fileUrl && /^https?:\/\//.test(asset.fileUrl);
  const isLocalImage = asset.fileUrl && /\.(png|jpe?g|svg|webp|gif)(\?.*)?$/i.test(asset.fileUrl);
  const hasImage = isDataUrl || isExternalImage || isLocalImage;

  const imgSrc = asset.fileUrl
    ? isDataUrl || !isExternalImage
      ? asset.fileUrl
      : `/api/image-proxy?url=${encodeURIComponent(asset.fileUrl)}`
    : "";

  const handleSave = async () => {
    if (!editLabel.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/accounts/${accountId}/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: editLabel.trim(),
          decorationMethod: editMethod.trim() || null,
          assetType: editType,
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        onUpdate(data);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDefault = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/accounts/${accountId}/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isDefault: !asset.isDefault }),
      });
      if (res.ok) {
        const { data } = await res.json();
        onUpdate(data);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!imgSrc) return;
    const a = document.createElement("a");
    a.href = imgSrc;
    a.download = `${asset.label}.png`;
    a.click();
  };

  return (
    <>
      <div
        className="group relative rounded-xl overflow-hidden transition-all hover:brightness-110"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Thumbnail — click to preview */}
        <div
          className="aspect-square flex items-center justify-center cursor-pointer"
          style={{ background: "rgba(255,255,255,0.02)" }}
          onClick={() => hasImage && setPreviewing(true)}
          title="Click to preview full size"
        >
          {hasImage && asset.fileUrl ? (
            <img src={imgSrc} alt={asset.label} className="h-full w-full object-contain p-3" />
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

        {/* Action buttons — visible on hover */}
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Download */}
          {hasImage && (
            <button
              onClick={handleDownload}
              className="rounded-full p-1"
              style={{ background: "rgba(0,0,0,0.6)", color: "#93c5fd" }}
              title="Download artwork"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}
          {/* Edit */}
          <button
            onClick={() => {
              setEditLabel(asset.label);
              setEditMethod(asset.decorationMethod || "");
              setEditType(asset.assetType);
              setEditing(true);
            }}
            className="rounded-full p-1"
            style={{ background: "rgba(0,0,0,0.6)", color: "#a5b4fc" }}
            title="Edit artwork details"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {/* Set Default */}
          <button
            onClick={handleToggleDefault}
            disabled={saving}
            className="rounded-full p-1"
            style={{
              background: "rgba(0,0,0,0.6)",
              color: asset.isDefault ? "#6ee7b7" : "#94a3b8",
            }}
            title={asset.isDefault ? "Remove as default" : "Set as default"}
          >
            <svg className="h-3.5 w-3.5" fill={asset.isDefault ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
          {/* Delete */}
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded-full p-1"
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
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: "var(--bg-primary, #0f172a)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Edit Artwork
            </h3>

            {/* Preview */}
            {hasImage && imgSrc && (
              <div className="flex justify-center rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
                <img src={imgSrc} alt={asset.label} className="max-h-32 object-contain" />
              </div>
            )}

            {/* Label */}
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Label
              </label>
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6366f1]"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>

            {/* Type + Method */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Type
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as AccountAsset["assetType"])}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <option value="LOGO" style={{ background: "#1e1e2e" }}>Logo / Badge</option>
                  <option value="TEMPLATE" style={{ background: "#1e1e2e" }}>Template</option>
                  <option value="DESIGN_REFERENCE" style={{ background: "#1e1e2e" }}>Design Reference</option>
                  <option value="PROOF" style={{ background: "#1e1e2e" }}>Proof</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Decoration Method
                </label>
                <input
                  type="text"
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value)}
                  placeholder="e.g. embroidery, DTG"
                  className="mt-1 w-full rounded-lg px-3 py-2 text-xs outline-none transition-all focus:ring-1 focus:ring-[#6366f1]"
                  style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg px-3 py-1.5 text-xs transition-all"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editLabel.trim()}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold transition-all hover:brightness-125 disabled:opacity-50"
                style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewing && hasImage && imgSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setPreviewing(false)}
        >
          <div className="relative max-w-3xl max-h-[85vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img src={imgSrc} alt={asset.label} className="max-h-[80vh] max-w-full object-contain rounded-xl" />
            <div className="mt-3 text-center">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{asset.label}</p>
              {asset.decorationMethod && (
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{asset.decorationMethod}</p>
              )}
            </div>
            <button
              onClick={() => setPreviewing(false)}
              className="absolute -top-2 -right-2 rounded-full p-2"
              style={{ background: "rgba(0,0,0,0.8)", color: "#e2e8f0" }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}


