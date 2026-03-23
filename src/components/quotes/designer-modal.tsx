"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Types
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export interface DesignConfig {
  placement: string;
  decorationMethod: string;
  artworkUrl?: string;
  artworkName?: string;
  notes?: string;
}

export interface DesignerProductDetail {
  productName: string;
  productCode: string;
  supplier: string;
  brand?: string;
  category?: string;
  colors: Array<{ id: number; name: string }>;
  sizes: Array<{ id: number; code: string }>;
  images?: Array<{ url: string; type: string; color?: string }>;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Constants
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PLACEMENTS = [
  { key: "front", label: "Front", icon: "👕", view: "front" },
  { key: "back", label: "Back", icon: "🔄", view: "back" },
  { key: "left_chest", label: "Left Chest", icon: "◀", view: "front" },
  { key: "right_chest", label: "Right Chest", icon: "▶", view: "front" },
  { key: "left_sleeve", label: "Left Sleeve", icon: "🫲", view: "left" },
  { key: "right_sleeve", label: "Right Sleeve", icon: "🫱", view: "right" },
  { key: "collar", label: "Collar", icon: "⬆", view: "front" },
];

const DECO_TYPES = [
  { key: "embroidery", label: "Embroidery", icon: "🧵" },
  { key: "dtf", label: "DTF", icon: "🖨" },
  { key: "dtg", label: "DTG", icon: "🎨" },
  { key: "screen_print", label: "Screen Print", icon: "🖼" },
  { key: "sublimation", label: "Sublimation", icon: "🌈" },
  { key: "vinyl", label: "Vinyl", icon: "✂" },
];

/** Default artwork overlay position per placement (CSS %) */
const OVERLAY: Record<string, React.CSSProperties> = {
  front: { left: "30%", top: "25%", width: "40%", height: "30%" },
  back: { left: "25%", top: "18%", width: "50%", height: "40%" },
  left_chest: { left: "52%", top: "25%", width: "16%", height: "16%" },
  right_chest: { left: "30%", top: "25%", width: "16%", height: "16%" },
  left_sleeve: { left: "30%", top: "30%", width: "22%", height: "15%" },
  right_sleeve: { left: "48%", top: "30%", width: "22%", height: "15%" },
  collar: { left: "35%", top: "5%", width: "30%", height: "10%" },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const VIEW_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  left: "Left",
  right: "Right",
  model: "Model",
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Component
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (designs: DesignConfig[]) => void;
  productDetail: DesignerProductDetail;
  selectedColorId?: number;
  initialDesigns?: DesignConfig[];
}

export function DesignerModal({
  open,
  onClose,
  onApply,
  productDetail,
  selectedColorId,
  initialDesigns,
}: Props) {
  /* ── State ── */
  const [activePlacement, setActivePlacement] = useState("front");
  const [viewOverride, setViewOverride] = useState<string | null>(null);
  const [designs, setDesigns] = useState<Record<string, DesignConfig>>(() => {
    const m: Record<string, DesignConfig> = {};
    initialDesigns?.forEach((d) => {
      m[d.placement] = d;
    });
    return m;
  });
  const [uploads, setUploads] = useState<Array<{ name: string; url: string }>>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset view override when switching placement
  useEffect(() => {
    setViewOverride(null);
  }, [activePlacement]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* ── Derived ── */
  const current = designs[activePlacement];
  const placementInfo = PLACEMENTS.find((p) => p.key === activePlacement)!;
  const activeView = viewOverride ?? placementInfo.view;

  const displayImage = useMemo(() => {
    const imgs = productDetail.images ?? [];
    const selColor = productDetail.colors.find((c) => c.id === selectedColorId);
    if (selColor) {
      const match = imgs.find(
        (i) =>
          i.type === activeView &&
          i.color?.toLowerCase() === selColor.name.toLowerCase(),
      );
      if (match) return match;
    }
    return imgs.find((i) => i.type === activeView) ?? imgs[0] ?? null;
  }, [productDetail, selectedColorId, activeView]);

  const viewTypes = useMemo(() => {
    const set = new Set<string>();
    productDetail.images?.forEach((img) => {
      if (["front", "back", "left", "right", "model"].includes(img.type))
        set.add(img.type);
    });
    return Array.from(set);
  }, [productDetail.images]);

  /* ── File handling ── */
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => {
        if (file.size > MAX_FILE_SIZE) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const url = e.target?.result as string;
          setUploads((prev) =>
            prev.some((u) => u.name === file.name)
              ? prev
              : [...prev, { name: file.name, url }],
          );
          // Auto-assign images to the active placement
          if (file.type.startsWith("image/")) {
            setDesigns((prev) => ({
              ...prev,
              [activePlacement]: {
                ...prev[activePlacement],
                placement: activePlacement,
                decorationMethod:
                  prev[activePlacement]?.decorationMethod || "",
                artworkUrl: url,
                artworkName: file.name,
              },
            }));
          }
        };
        reader.readAsDataURL(file);
      });
    },
    [activePlacement],
  );

  /* ── Design mutations ── */
  function updateDesign(updates: Partial<DesignConfig>) {
    setDesigns((prev) => ({
      ...prev,
      [activePlacement]: {
        ...prev[activePlacement],
        placement: activePlacement,
        decorationMethod: prev[activePlacement]?.decorationMethod || "",
        ...updates,
      },
    }));
  }

  function clearPlacement() {
    setDesigns((prev) => {
      const n = { ...prev };
      delete n[activePlacement];
      return n;
    });
  }

  function handleApply() {
    onApply(
      Object.values(designs).filter((d) => d.decorationMethod || d.artworkUrl),
    );
    onClose();
  }

  const configuredCount = Object.values(designs).filter(
    (d) => d.decorationMethod || d.artworkUrl,
  ).length;

  if (!open) return null;

  const overlayPos = OVERLAY[activePlacement] ?? OVERLAY.front;

  /* ── Render ── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex flex-col w-full max-w-6xl max-h-[92vh] rounded-2xl border overflow-hidden"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        {/* ── HEADER ── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🎨</span>
            <div>
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Designer
              </h2>
              <p
                className="text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                {productDetail.productName} · {productDetail.productCode}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "var(--text-tertiary)" }}
          >
            ✕
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-auto flex flex-col lg:flex-row min-h-0">
          {/* ▸ Left: Product Viewer */}
          <div
            className="lg:w-1/2 p-5 flex flex-col gap-4 shrink-0"
            style={{ borderRight: "1px solid var(--border)" }}
          >
            {/* Main image with artwork overlay */}
            <div
              className="relative rounded-xl overflow-hidden flex items-center justify-center"
              style={{ background: "#fff", minHeight: 300 }}
            >
              {displayImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayImage.url}
                    alt={productDetail.productName}
                    className="max-h-80 w-auto object-contain"
                  />
                  {current?.artworkUrl &&
                    current.artworkUrl.startsWith("data:image/") && (
                      <div
                        className="absolute pointer-events-none transition-all duration-200"
                        style={{ ...overlayPos, opacity: 0.85 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={current.artworkUrl}
                          alt="Design"
                          className="w-full h-full object-contain"
                          style={{
                            filter:
                              "drop-shadow(0 2px 6px rgba(0,0,0,0.35))",
                          }}
                        />
                      </div>
                    )}
                </>
              ) : (
                <div className="text-7xl py-12 opacity-30">👕</div>
              )}
            </div>

            {/* View thumbnails */}
            {viewTypes.length > 1 && (
              <div className="flex gap-2 justify-center">
                {viewTypes.map((vt) => {
                  const img = productDetail.images?.find(
                    (i) => i.type === vt,
                  );
                  const isActive = activeView === vt;
                  return (
                    <button
                      key={vt}
                      onClick={() => setViewOverride(vt)}
                      className="rounded-lg border overflow-hidden transition-all flex flex-col items-center"
                      style={{
                        width: 60,
                        borderColor: isActive
                          ? "var(--accent)"
                          : "var(--border)",
                        boxShadow: isActive
                          ? "0 0 0 2px var(--accent)"
                          : "none",
                        background: "#fff",
                      }}
                    >
                      {img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img.url}
                          alt={vt}
                          className="w-full h-10 object-contain"
                        />
                      )}
                      <span
                        className="text-[9px] py-0.5 font-medium w-full text-center"
                        style={{
                          color: isActive
                            ? "var(--accent-light)"
                            : "var(--text-tertiary)",
                          background: "var(--bg-surface)",
                        }}
                      >
                        {VIEW_LABELS[vt] ?? vt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Configured placements summary */}
            <div className="space-y-2">
              <div
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Configured Placements
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PLACEMENTS.map((p) => {
                  const d = designs[p.key];
                  const has = !!(d?.decorationMethod || d?.artworkUrl);
                  return (
                    <button
                      key={p.key}
                      onClick={() => setActivePlacement(p.key)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors"
                      style={{
                        background: has
                          ? "var(--accent-soft)"
                          : "rgba(255,255,255,0.04)",
                        color: has
                          ? "var(--accent-light)"
                          : "var(--text-tertiary)",
                        border: `1px solid ${has ? "rgba(99,102,241,0.3)" : "var(--border)"}`,
                      }}
                    >
                      {has && "✓ "}
                      {p.label}
                      {d?.decorationMethod && (
                        <span className="opacity-70">
                          {" · "}
                          {DECO_TYPES.find(
                            (dt) => dt.key === d.decorationMethod,
                          )?.label ?? d.decorationMethod}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ▸ Right: Design Configuration */}
          <div className="lg:w-1/2 p-5 space-y-5 overflow-auto">
            {/* Placement selector */}
            <div className="space-y-2">
              <div
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Select Placement
              </div>
              <div className="flex flex-wrap gap-2">
                {PLACEMENTS.map((p) => {
                  const isActive = activePlacement === p.key;
                  const has = !!(
                    designs[p.key]?.decorationMethod ||
                    designs[p.key]?.artworkUrl
                  );
                  return (
                    <button
                      key={p.key}
                      onClick={() => setActivePlacement(p.key)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border"
                      style={{
                        borderColor: isActive
                          ? "var(--accent)"
                          : has
                            ? "rgba(99,102,241,0.3)"
                            : "var(--border)",
                        background: isActive
                          ? "var(--accent-soft)"
                          : has
                            ? "rgba(99,102,241,0.05)"
                            : "transparent",
                        color: isActive
                          ? "var(--accent-light)"
                          : has
                            ? "var(--accent-light)"
                            : "var(--text-secondary)",
                        boxShadow: isActive
                          ? "0 0 0 1px var(--accent)"
                          : "none",
                      }}
                    >
                      <span className="text-sm">{p.icon}</span>
                      {p.label}
                      {has && !isActive && (
                        <span className="ml-0.5 text-[10px] opacity-60">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Decoration type */}
            <div className="space-y-2">
              <div
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Decoration Type
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DECO_TYPES.map((dt) => {
                  const isActive =
                    current?.decorationMethod === dt.key;
                  return (
                    <button
                      key={dt.key}
                      onClick={() =>
                        updateDesign({ decorationMethod: dt.key })
                      }
                      className="flex flex-col items-center gap-1 p-3 rounded-xl border transition-all"
                      style={{
                        borderColor: isActive
                          ? "var(--accent)"
                          : "var(--border)",
                        background: isActive
                          ? "var(--accent-soft)"
                          : "rgba(255,255,255,0.02)",
                        color: isActive
                          ? "var(--accent-light)"
                          : "var(--text-secondary)",
                        boxShadow: isActive
                          ? "0 0 0 1px var(--accent)"
                          : "none",
                      }}
                    >
                      <span className="text-xl">{dt.icon}</span>
                      <span className="text-[11px] font-medium">
                        {dt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Artwork ── */}
            <div className="space-y-3">
              <div
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Artwork
              </div>

              {/* Current artwork preview */}
              {current?.artworkUrl && (
                <div
                  className="flex items-center gap-3 p-3 rounded-xl border"
                  style={{
                    borderColor: "rgba(99,102,241,0.4)",
                    background: "var(--accent-soft)",
                  }}
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-white shrink-0 flex items-center justify-center">
                    {current.artworkUrl.startsWith("data:image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={current.artworkUrl}
                        alt="artwork"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <span className="text-2xl">📄</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {current.artworkName ?? "Artwork"}
                    </div>
                    <div
                      className="text-[10px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Assigned to {placementInfo.label}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      updateDesign({
                        artworkUrl: undefined,
                        artworkName: undefined,
                      })
                    }
                    className="text-xs px-2 py-1 rounded transition-colors hover:bg-white/5"
                    style={{ color: "var(--danger)" }}
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Upload zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                  dragActive ? "scale-[1.01]" : ""
                }`}
                style={{
                  borderColor: dragActive
                    ? "var(--accent)"
                    : "var(--border)",
                  background: dragActive
                    ? "var(--accent-soft)"
                    : "rgba(255,255,255,0.02)",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files.length)
                    handleFiles(e.dataTransfer.files);
                }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,.dst,.pes,.jef,.exp,.vp3,.hus,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <div className="text-3xl mb-2">
                  {dragActive ? "📥" : "📁"}
                </div>
                <div
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {dragActive
                    ? "Drop files here"
                    : "Drop artwork or click to browse"}
                </div>
                <div
                  className="text-[10px] mt-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Images: PNG, JPG, SVG · Production: DST, PES, JEF · Max
                  10MB
                </div>
              </div>
            </div>

            {/* Session uploads library */}
            {uploads.length > 0 && (
              <div className="space-y-2">
                <div
                  className="text-[11px] font-medium uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Uploaded Files ({uploads.length})
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {uploads.map((file, idx) => {
                    const isActive = current?.artworkUrl === file.url;
                    const isImage = file.url.startsWith("data:image/");
                    return (
                      <button
                        key={idx}
                        onClick={() =>
                          updateDesign({
                            artworkUrl: file.url,
                            artworkName: file.name,
                          })
                        }
                        className="flex flex-col items-center gap-1 p-2 rounded-lg border transition-all hover:bg-white/5"
                        style={{
                          borderColor: isActive
                            ? "var(--accent)"
                            : "var(--border)",
                          background: isActive
                            ? "var(--accent-soft)"
                            : "transparent",
                        }}
                      >
                        {isImage ? (
                          <div className="w-12 h-12 rounded bg-white flex items-center justify-center overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={file.url}
                              alt={file.name}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div
                            className="w-12 h-12 rounded flex items-center justify-center"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                            }}
                          >
                            <span className="text-lg">📄</span>
                          </div>
                        )}
                        <span
                          className="text-[9px] truncate w-full text-center"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {file.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Design notes */}
            <div className="space-y-2">
              <div
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Design Notes
              </div>
              <textarea
                value={current?.notes ?? ""}
                onChange={(e) => updateDesign({ notes: e.target.value })}
                placeholder={`Special instructions for ${placementInfo.label} decoration...`}
                rows={3}
                className="input w-full resize-y text-sm"
              />
            </div>

            {/* Clear placement */}
            {current &&
              (current.decorationMethod || current.artworkUrl) && (
                <button
                  onClick={clearPlacement}
                  className="text-xs transition-colors hover:underline"
                  style={{ color: "var(--danger)" }}
                >
                  Clear {placementInfo.label} design
                </button>
              )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="text-sm"
            style={{ color: "var(--text-tertiary)" }}
          >
            {configuredCount === 0
              ? "No placements configured"
              : `${configuredCount} placement${configuredCount > 1 ? "s" : ""} configured`}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              Cancel
            </button>
            <button onClick={handleApply} className="btn btn--primary">
              Apply Design{configuredCount > 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
