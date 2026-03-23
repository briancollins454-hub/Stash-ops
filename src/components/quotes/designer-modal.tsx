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
  artworkFileType?: string;
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

type UploadedFile = {
  name: string;
  url: string;
  isImage: boolean;
  ext: string;
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Constants
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const VIEWS = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

const PLACEMENTS = [
  { key: "front", label: "Front", view: "front" as ViewKey },
  { key: "back", label: "Back", view: "back" as ViewKey },
  { key: "left_chest", label: "Left Chest", view: "front" as ViewKey },
  { key: "right_chest", label: "Right Chest", view: "front" as ViewKey },
  { key: "left_sleeve", label: "Left Sleeve", view: "left" as ViewKey },
  { key: "right_sleeve", label: "Right Sleeve", view: "right" as ViewKey },
  { key: "collar", label: "Collar", view: "front" as ViewKey },
  { key: "hem", label: "Hem", view: "front" as ViewKey },
  { key: "pocket", label: "Pocket", view: "front" as ViewKey },
] as const;

const DECO_TYPES = [
  { key: "embroidery", label: "Embroidery", desc: "Thread stitched into the garment" },
  { key: "dtf", label: "DTF", desc: "Direct-to-Film heat transfer" },
  { key: "dtg", label: "DTG", desc: "Direct-to-Garment inkjet" },
  { key: "screen_print", label: "Screen Print", desc: "Ink pushed through mesh" },
  { key: "sublimation", label: "Sublimation", desc: "Dye infused via heat" },
  { key: "vinyl", label: "Vinyl / HTV", desc: "Heat-applied vinyl cut" },
];

/* Artwork position hints per placement — where the design appears on the garment preview */
const ARTWORK_POS: Record<string, { x: string; y: string; w: string; h: string }> = {
  front:        { x: "28%", y: "25%", w: "44%", h: "38%" },
  back:         { x: "22%", y: "18%", w: "56%", h: "48%" },
  left_chest:   { x: "50%", y: "25%", w: "18%", h: "18%" },
  right_chest:  { x: "30%", y: "25%", w: "18%", h: "18%" },
  left_sleeve:  { x: "25%", y: "28%", w: "20%", h: "16%" },
  right_sleeve: { x: "55%", y: "28%", w: "20%", h: "16%" },
  collar:       { x: "32%", y: "6%",  w: "36%", h: "10%" },
  hem:          { x: "28%", y: "72%", w: "44%", h: "10%" },
  pocket:       { x: "48%", y: "38%", w: "15%", h: "15%" },
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function colorToCss(name: string): string {
  const n = name.toLowerCase().trim();
  const map: Record<string, string> = {
    black: "#111", white: "#f5f5f5", navy: "#1a237e", red: "#c62828",
    royal: "#1565c0", "royal blue": "#1565c0", grey: "#9e9e9e", gray: "#9e9e9e",
    "bottle green": "#1b5e20", bottle: "#1b5e20", green: "#2e7d32",
    yellow: "#f9a825", orange: "#e65100", pink: "#ec407a", purple: "#7b1fa2",
    "sky blue": "#4fc3f7", sky: "#4fc3f7", burgundy: "#880e4f", maroon: "#880e4f",
    charcoal: "#424242", heather: "#9e9e9e", "french navy": "#1a237e",
    khaki: "#c2b280", olive: "#556b2f", tan: "#d2b48c", cream: "#fffdd0",
    beige: "#f5f5dc", teal: "#008080", coral: "#ff6f61", aqua: "#00bcd4",
    gold: "#ffd700", silver: "#c0c0c0", brown: "#795548", lime: "#cddc39",
    magenta: "#e91e63", lavender: "#b39ddb", turquoise: "#00bcd4",
  };
  return map[n] ?? "var(--text-tertiary)";
}

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
  selectedColorId: initialColorId,
  initialDesigns,
}: Props) {
  /* ── Core state ── */
  const [activeView, setActiveView] = useState<ViewKey>("front");
  const [activePlacement, setActivePlacement] = useState("front");
  const [activeColorId, setActiveColorId] = useState<number | undefined>(initialColorId);
  const [designs, setDesigns] = useState<Record<string, DesignConfig>>(() => {
    const m: Record<string, DesignConfig> = {};
    initialDesigns?.forEach((d) => { m[d.placement] = d; });
    return m;
  });

  /* ── Uploads ── */
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Right panel tab ── */
  type RightTab = "design" | "artwork" | "notes";
  const [rightTab, setRightTab] = useState<RightTab>("design");

  /* ── Escape to close ── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /* When placement changes, auto-switch to the relevant garment view */
  useEffect(() => {
    const p = PLACEMENTS.find((p) => p.key === activePlacement);
    if (p) setActiveView(p.view);
  }, [activePlacement]);

  /* ── Derived ── */
  const current = designs[activePlacement];
  const placementInfo = PLACEMENTS.find((p) => p.key === activePlacement)!;

  const displayImage = useMemo(() => {
    const imgs = productDetail.images ?? [];
    const selColor = productDetail.colors.find((c) => c.id === activeColorId);

    // Try colour-specific front image
    if (selColor) {
      const colorMatch = imgs.find(
        (i) => i.type === "front" && i.color?.toLowerCase() === selColor.name.toLowerCase()
      );
      if (colorMatch) return colorMatch.url;
    }
    // Fall back to first front image or gallery
    return imgs.find((i) => i.type === "front")?.url
      ?? imgs.find((i) => i.type === "gallery")?.url
      ?? null;
  }, [productDetail, activeColorId]);

  const colorImages = useMemo(() => {
    return (productDetail.images ?? []).filter((i) => i.type === "front" && i.color);
  }, [productDetail.images]);

  const configuredPlacements = useMemo(
    () => Object.values(designs).filter((d) => d.decorationMethod || d.artworkUrl),
    [designs]
  );

  /* ── File handling ── */
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => {
        if (file.size > MAX_FILE_BYTES) return;
        const ext = fileExt(file.name);
        const isImage = file.type.startsWith("image/");
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          setUploads((prev) =>
            prev.some((u) => u.name === file.name)
              ? prev
              : [...prev, { name: file.name, url: dataUrl, isImage, ext }]
          );
          // Auto-assign to active placement
          setDesigns((prev) => ({
            ...prev,
            [activePlacement]: {
              ...prev[activePlacement],
              placement: activePlacement,
              decorationMethod: prev[activePlacement]?.decorationMethod || (isImage ? "" : "embroidery"),
              artworkUrl: dataUrl,
              artworkName: file.name,
              artworkFileType: ext,
            },
          }));
          setRightTab("artwork");
        };
        reader.readAsDataURL(file);
      });
    },
    [activePlacement]
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

  function clearDesign() {
    setDesigns((prev) => {
      const n = { ...prev };
      delete n[activePlacement];
      return n;
    });
  }

  function handleApply() {
    onApply(configuredPlacements);
    onClose();
  }

  if (!open) return null;

  const artOverlay = ARTWORK_POS[activePlacement] ?? ARTWORK_POS.front;

  /* ━━━━━━━ RENDER ━━━━━━━ */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col w-full max-w-[1440px] h-[94vh] mx-4 rounded-2xl border overflow-hidden"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        {/* ══════════ HEADER ══════════ */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.15)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
              <span className="text-base">🎨</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                Designer — {productDetail.productName}
              </h2>
              <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                {productDetail.productCode} · {productDetail.supplier}{productDetail.brand ? ` / ${productDetail.brand}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {configuredPlacements.length > 0 && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent-light)" }}>
                {configuredPlacements.length} placement{configuredPlacements.length !== 1 ? "s" : ""}
              </span>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: "var(--text-tertiary)" }}>
              ✕
            </button>
          </div>
        </div>

        {/* ══════════ BODY — 3 columns ══════════ */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ━━━ COL 1: Placements sidebar ━━━ */}
          <div className="w-52 shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.08)" }}>
            <div className="px-3 pt-3 pb-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Placements</div>
            </div>
            <div className="flex-1 overflow-auto px-2 pb-2 space-y-0.5">
              {PLACEMENTS.map((p) => {
                const d = designs[p.key];
                const isActive = activePlacement === p.key;
                const hasConfig = !!(d?.decorationMethod || d?.artworkUrl);
                return (
                  <button
                    key={p.key}
                    onClick={() => { setActivePlacement(p.key); setRightTab("design"); }}
                    className="w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-2.5"
                    style={{
                      background: isActive ? "var(--accent-soft)" : "transparent",
                      borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                    }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        background: hasConfig ? "var(--success)" : isActive ? "var(--accent)" : "rgba(255,255,255,0.1)",
                        boxShadow: hasConfig ? "0 0 6px var(--success)" : "none",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: isActive ? "var(--accent-light)" : "var(--text-primary)" }}>
                        {p.label}
                      </div>
                      {hasConfig && (
                        <div className="text-[9px] truncate" style={{ color: "var(--text-tertiary)" }}>
                          {DECO_TYPES.find((dt) => dt.key === d?.decorationMethod)?.label ?? ""}
                          {d?.artworkName ? ` · ${d.artworkName}` : ""}
                        </div>
                      )}
                    </div>
                    {hasConfig && <span className="text-[9px] shrink-0" style={{ color: "var(--success)" }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {configuredPlacements.length === 0
                  ? "No placements configured"
                  : `${configuredPlacements.length} / ${PLACEMENTS.length} configured`}
              </div>
            </div>
          </div>

          {/* ━━━ COL 2: Garment preview ━━━ */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
            {/* View rotation bar */}
            <div className="flex items-center justify-center gap-1.5 px-4 pt-3 pb-1">
              {VIEWS.map((v) => {
                const isActive = activeView === v.key;
                return (
                  <button
                    key={v.key}
                    onClick={() => setActiveView(v.key)}
                    className="px-5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: isActive ? "var(--accent)" : "rgba(255,255,255,0.06)",
                      color: isActive ? "white" : "var(--text-tertiary)",
                      boxShadow: isActive ? "0 2px 8px rgba(99,102,241,0.4)" : "none",
                    }}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>

            {/* Main product image area */}
            <div
              className="flex-1 flex items-center justify-center p-4 relative"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
            >
              <div
                className="relative w-full max-w-md aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
                style={{ background: "#ffffff" }}
              >
                {displayImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayImage}
                      alt={`${productDetail.productName} – ${activeView}`}
                      className="max-w-[88%] max-h-[88%] object-contain select-none"
                      draggable={false}
                      style={{
                        transform:
                          activeView === "back" ? "scaleX(-1)"
                          : activeView === "left" ? "perspective(600px) rotateY(40deg)"
                          : activeView === "right" ? "perspective(600px) rotateY(-40deg)"
                          : "none",
                        transition: "transform 0.4s cubic-bezier(.4,0,.2,1)",
                      }}
                    />
                    {/* Artwork overlay */}
                    {current?.artworkUrl && current.artworkUrl.startsWith("data:image/") && activeView === placementInfo.view && (
                      <div
                        className="absolute pointer-events-none transition-all duration-300"
                        style={{ left: artOverlay.x, top: artOverlay.y, width: artOverlay.w, height: artOverlay.h, opacity: 0.85 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={current.artworkUrl} alt="Design" className="w-full h-full object-contain" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }} />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <div className="text-8xl opacity-20 mb-3">👕</div>
                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>No images available</div>
                  </div>
                )}

                {/* View label */}
                <div className="absolute top-3 left-3">
                  <div className="px-2.5 py-1 rounded-lg text-[10px] font-semibold backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.5)", color: "white" }}>
                    {placementInfo.label} · {VIEWS.find((v) => v.key === activeView)?.label} View
                  </div>
                </div>

                {/* Drop overlay */}
                {dragOver && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl" style={{ background: "rgba(99,102,241,0.2)", border: "3px dashed var(--accent)" }}>
                    <span className="text-5xl mb-2">📥</span>
                    <div className="text-sm font-semibold" style={{ color: "var(--accent-light)" }}>Drop artwork for {placementInfo.label}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Colour swatches */}
            {productDetail.colors.length > 0 && (
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="text-[10px] font-medium mr-1" style={{ color: "var(--text-tertiary)" }}>Colour:</span>
                  {productDetail.colors.slice(0, 24).map((c) => {
                    const isActive = activeColorId === c.id;
                    return (
                      <button key={c.id} onClick={() => setActiveColorId(c.id)} title={c.name} className="group relative">
                        <div
                          className="w-6 h-6 rounded-full border-2 transition-all"
                          style={{
                            background: colorToCss(c.name),
                            borderColor: isActive ? "var(--accent)" : "rgba(255,255,255,0.15)",
                            boxShadow: isActive ? "0 0 0 2px var(--accent), 0 2px 4px rgba(0,0,0,0.3)" : "0 1px 2px rgba(0,0,0,0.2)",
                            transform: isActive ? "scale(1.2)" : "scale(1)",
                          }}
                        />
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <div className="px-1.5 py-0.5 rounded text-[8px] font-medium whitespace-nowrap" style={{ background: "rgba(0,0,0,0.85)", color: "white" }}>{c.name}</div>
                        </div>
                      </button>
                    );
                  })}
                  {productDetail.colors.length > 24 && (
                    <span className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>+{productDetail.colors.length - 24}</span>
                  )}
                </div>
              </div>
            )}

            {/* Colour image strip */}
            {colorImages.length > 1 && (
              <div className="px-4 pb-3">
                <div className="flex gap-1.5 overflow-x-auto justify-center">
                  {colorImages.slice(0, 14).map((img, idx) => {
                    const isActive = displayImage === img.url;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          const match = productDetail.colors.find((c) => c.name.toLowerCase() === img.color?.toLowerCase());
                          if (match) setActiveColorId(match.id);
                          setActiveView("front");
                        }}
                        className="shrink-0 rounded-lg overflow-hidden border-2 transition-all"
                        style={{ width: 42, height: 42, borderColor: isActive ? "var(--accent)" : "transparent", background: "#fff" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.color ?? ""} className="w-full h-full object-contain" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ━━━ COL 3: Configuration panel ━━━ */}
          <div className="w-80 shrink-0 border-l flex flex-col overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {/* Tabs */}
            <div className="flex border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              {([
                { key: "design" as RightTab, label: "Design" },
                { key: "artwork" as RightTab, label: "Artwork" },
                { key: "notes" as RightTab, label: "Notes" },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setRightTab(tab.key)}
                  className="flex-1 py-2.5 text-xs font-semibold transition-colors relative"
                  style={{ color: rightTab === tab.key ? "var(--accent-light)" : "var(--text-tertiary)" }}
                >
                  {tab.label}
                  {rightTab === tab.key && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: "var(--accent)" }} />
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* ── DESIGN TAB ── */}
              {rightTab === "design" && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{placementInfo.label}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{VIEWS.find((v) => v.key === placementInfo.view)?.label} view</div>
                    </div>
                    {current && (current.decorationMethod || current.artworkUrl) && (
                      <button onClick={clearDesign} className="text-[10px] px-2 py-1 rounded hover:bg-white/5 transition-colors" style={{ color: "var(--danger)" }}>
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Decoration Method</div>
                    <div className="space-y-1">
                      {DECO_TYPES.map((dt) => {
                        const isActive = current?.decorationMethod === dt.key;
                        return (
                          <button
                            key={dt.key}
                            onClick={() => updateDesign({ decorationMethod: dt.key })}
                            className="w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between"
                            style={{
                              borderColor: isActive ? "var(--accent)" : "var(--border)",
                              background: isActive ? "var(--accent-soft)" : "transparent",
                            }}
                          >
                            <div>
                              <div className="text-xs font-medium" style={{ color: isActive ? "var(--accent-light)" : "var(--text-primary)" }}>{dt.label}</div>
                              <div className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>{dt.desc}</div>
                            </div>
                            {isActive && (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--accent)" }}>
                                <span className="text-[10px] text-white">✓</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {current?.artworkUrl && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Attached Artwork</div>
                      <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "rgba(99,102,241,0.3)", background: "var(--accent-soft)" }}>
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0 flex items-center justify-center">
                          {current.artworkUrl.startsWith("data:image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={current.artworkUrl} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <div className="text-center">
                              <div className="text-lg">📄</div>
                              <div className="text-[7px] font-bold uppercase" style={{ color: "#666" }}>{current.artworkFileType ?? "FILE"}</div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{current.artworkName ?? "Artwork"}</div>
                          <div className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>Assigned to {placementInfo.label}</div>
                        </div>
                        <button
                          onClick={() => updateDesign({ artworkUrl: undefined, artworkName: undefined, artworkFileType: undefined })}
                          className="text-[10px] px-1.5 py-1 rounded hover:bg-white/5" style={{ color: "var(--danger)" }}
                        >✕</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── ARTWORK TAB ── */}
              {rightTab === "artwork" && (
                <>
                  <div
                    className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all hover:border-[var(--accent)]"
                    style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.dst,.pes,.jef,.exp,.vp3,.hus,.pdf"
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }}
                    />
                    <div className="text-3xl mb-1.5">📁</div>
                    <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Click to upload artwork</div>
                    <div className="text-[9px] mt-1" style={{ color: "var(--text-tertiary)" }}>PNG · JPG · SVG · PDF · DST · PES · JEF — Max 10MB</div>
                    <div className="text-[9px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>Or drag & drop onto the garment preview</div>
                  </div>

                  {uploads.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                        Uploaded Files ({uploads.length})
                      </div>
                      <div className="space-y-1">
                        {uploads.map((file, i) => {
                          const isAssigned = current?.artworkUrl === file.url;
                          return (
                            <button
                              key={i}
                              onClick={() => updateDesign({ artworkUrl: file.url, artworkName: file.name, artworkFileType: file.ext })}
                              className="w-full flex items-center gap-2.5 p-2 rounded-lg border transition-all hover:bg-white/5 text-left"
                              style={{ borderColor: isAssigned ? "var(--accent)" : "var(--border)", background: isAssigned ? "var(--accent-soft)" : "transparent" }}
                            >
                              <div className="w-10 h-10 rounded bg-white flex items-center justify-center shrink-0 overflow-hidden">
                                {file.isImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={file.url} alt={file.name} className="w-full h-full object-contain" />
                                ) : (
                                  <div className="text-center">
                                    <div className="text-sm">📄</div>
                                    <div className="text-[6px] font-bold uppercase" style={{ color: "#666" }}>{file.ext}</div>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{file.name}</div>
                                <div className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                                  {isAssigned ? `Assigned to ${placementInfo.label}` : `Click to assign to ${placementInfo.label}`}
                                </div>
                              </div>
                              {isAssigned && <span className="shrink-0 text-[10px]" style={{ color: "var(--accent-light)" }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-4xl opacity-20 mb-2">🎨</div>
                      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>No artwork uploaded yet</div>
                      <div className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>Upload embroidery files (.dst, .pes) or<br />image artwork (.png, .jpg, .svg)</div>
                    </div>
                  )}
                </>
              )}

              {/* ── NOTES TAB ── */}
              {rightTab === "notes" && (
                <>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                      Design Notes — {placementInfo.label}
                    </div>
                    <textarea
                      value={current?.notes ?? ""}
                      onChange={(e) => updateDesign({ notes: e.target.value })}
                      placeholder={`Special instructions for ${placementInfo.label}...\n\ne.g. "Match PMS 186C red"\n"Scale logo to 8cm wide"\n"Position 3cm below collar"`}
                      rows={8}
                      className="input w-full resize-y text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Quick Notes</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Match PMS colours exactly",
                        "Scale to fit",
                        "Centre aligned",
                        "Left aligned",
                        "White underbase required",
                        "Remove background",
                        "Mirror for left/right",
                        "Design requires changes",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => updateDesign({ notes: (current?.notes ? current.notes + "\n" : "") + q })}
                          className="px-2 py-1 rounded text-[9px] font-medium hover:bg-white/5 border transition-colors"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                        >
                          + {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ══════════ FOOTER ══════════ */}
        <div className="flex items-center justify-between px-5 py-3 border-t shrink-0" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.1)" }}>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {configuredPlacements.length === 0 ? (
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Select placements and decoration methods to configure</span>
            ) : (
              configuredPlacements.map((d) => (
                <div key={d.placement} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent-light)" }}>
                  {PLACEMENTS.find((p) => p.key === d.placement)?.label ?? d.placement}
                  {d.decorationMethod && ` · ${DECO_TYPES.find((dt) => dt.key === d.decorationMethod)?.label ?? d.decorationMethod}`}
                  {d.artworkName && " 📎"}
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 shrink-0 ml-3">
            <button onClick={onClose} className="btn text-sm px-4" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button onClick={handleApply} className="btn btn--primary text-sm px-5">
              Apply Design{configuredPlacements.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
