"use client";

import { useState, useRef, useCallback, useMemo, useEffect, type PointerEvent as RPointerEvent } from "react";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Public types
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export interface DesignConfig {
  placement: string;
  decorationMethod: string;
  artworkUrl?: string;
  artworkName?: string;
  artworkFileType?: string;
  /** position & size as % of the container (0-100) */
  x: number;
  y: number;
  w: number;
  h: number;
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

type UploadedFile = { name: string; url: string; isImage: boolean; ext: string };

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Constants
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type ViewKey = "front" | "back" | "left" | "right";
const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
];

/** Every placement = a named zone on one side of the garment.
 *  x/y/w/h are default zone position as % of the garment image. */
const PLACEMENTS = [
  { key: "front",        label: "Front",        view: "front" as ViewKey, x: 25, y: 28, w: 50, h: 35 },
  { key: "back",         label: "Back",         view: "back"  as ViewKey, x: 20, y: 20, w: 60, h: 45 },
  { key: "left_chest",   label: "Left Chest",   view: "front" as ViewKey, x: 48, y: 26, w: 18, h: 18 },
  { key: "right_chest",  label: "Right Chest",  view: "front" as ViewKey, x: 30, y: 26, w: 18, h: 18 },
  { key: "left_sleeve",  label: "Left Sleeve",  view: "left"  as ViewKey, x: 30, y: 22, w: 28, h: 22 },
  { key: "right_sleeve", label: "Right Sleeve", view: "right" as ViewKey, x: 42, y: 22, w: 28, h: 22 },
  { key: "collar",       label: "Collar",       view: "front" as ViewKey, x: 30, y: 6,  w: 40, h: 12 },
  { key: "hem",          label: "Hem",          view: "front" as ViewKey, x: 25, y: 72, w: 50, h: 10 },
  { key: "pocket",       label: "Pocket",       view: "front" as ViewKey, x: 46, y: 38, w: 14, h: 14 },
] as const;

const DECO_TYPES = [
  { key: "embroidery",   label: "Embroidery",   desc: "Thread stitched into garment" },
  { key: "dtf",          label: "DTF",          desc: "Direct-to-Film transfer" },
  { key: "dtg",          label: "DTG",          desc: "Direct-to-Garment inkjet" },
  { key: "screen_print", label: "Screen Print", desc: "Ink pushed through mesh" },
  { key: "sublimation",  label: "Sublimation",  desc: "Dye infused via heat" },
  { key: "vinyl",        label: "Vinyl / HTV",  desc: "Heat-applied vinyl cut" },
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_SIZE_PCT = 4; // minimum artwork dimension %

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

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Component
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (designs: DesignConfig[]) => void;
  productDetail: DesignerProductDetail;
  selectedColorId?: number;
  initialDesigns?: DesignConfig[];
}

export function DesignerModal({ open, onClose, onApply, productDetail, selectedColorId: initColorId, initialDesigns }: Props) {
  /* ── state ── */
  const [activeView, setActiveView] = useState<ViewKey>("front");
  const [activePlacement, setActivePlacement] = useState("front");
  const [activeColorId, setActiveColorId] = useState<number | undefined>(initColorId);
  const [designs, setDesigns] = useState<Record<string, DesignConfig>>(() => {
    const m: Record<string, DesignConfig> = {};
    initialDesigns?.forEach((d) => { m[d.placement] = d; });
    return m;
  });
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  type RightTab = "design" | "artwork" | "notes";
  const [rightTab, setRightTab] = useState<RightTab>("design");

  /* drag / resize state */
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: "move" | "resize";
    startX: number; startY: number;
    origX: number; origY: number; origW: number; origH: number;
    resizeCorner: string;
  } | null>(null);

  /* ── escape ── */
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  /* switch view when placement changes */
  useEffect(() => {
    const p = PLACEMENTS.find((p) => p.key === activePlacement);
    if (p) setActiveView(p.view);
  }, [activePlacement]);

  /* ── derived ── */
  const current = designs[activePlacement];
  const pInfo = PLACEMENTS.find((p) => p.key === activePlacement)!;

  /* zones visible in current view */
  const visibleZones = useMemo(
    () => PLACEMENTS.filter((p) => p.view === activeView),
    [activeView],
  );

  const displayImage = useMemo(() => {
    const imgs = productDetail.images ?? [];
    const selColor = productDetail.colors.find((c) => c.id === activeColorId);
    if (selColor) {
      const cm = imgs.find((i) => i.type === "front" && i.color?.toLowerCase() === selColor.name.toLowerCase());
      if (cm) return cm.url;
    }
    return imgs.find((i) => i.type === "front")?.url ?? imgs.find((i) => i.type === "gallery")?.url ?? null;
  }, [productDetail, activeColorId]);

  const colorImages = useMemo(
    () => (productDetail.images ?? []).filter((i) => i.type === "front" && i.color),
    [productDetail.images],
  );

  const configuredPlacements = useMemo(
    () => Object.values(designs).filter((d) => d.decorationMethod || d.artworkUrl),
    [designs],
  );

  /* ── file handling ── */
  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_BYTES) return;
      const ext = fileExt(file.name);
      const isImage = file.type.startsWith("image/");
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setUploads((prev) => prev.some((u) => u.name === file.name) ? prev : [...prev, { name: file.name, url: dataUrl, isImage, ext }]);
        const zone = PLACEMENTS.find((p) => p.key === activePlacement)!;
        setDesigns((prev) => ({
          ...prev,
          [activePlacement]: {
            ...prev[activePlacement],
            placement: activePlacement,
            decorationMethod: prev[activePlacement]?.decorationMethod || (isImage ? "" : "embroidery"),
            artworkUrl: dataUrl,
            artworkName: file.name,
            artworkFileType: ext,
            x: prev[activePlacement]?.x ?? zone.x,
            y: prev[activePlacement]?.y ?? zone.y,
            w: prev[activePlacement]?.w ?? zone.w,
            h: prev[activePlacement]?.h ?? zone.h,
          },
        }));
        setRightTab("artwork");
      };
      reader.readAsDataURL(file);
    });
  }, [activePlacement]);

  /* ── design mutations ── */
  function updateDesign(updates: Partial<DesignConfig>) {
    const zone = PLACEMENTS.find((p) => p.key === activePlacement)!;
    setDesigns((prev) => ({
      ...prev,
      [activePlacement]: {
        ...prev[activePlacement],
        placement: activePlacement,
        decorationMethod: prev[activePlacement]?.decorationMethod || "",
        x: prev[activePlacement]?.x ?? zone.x,
        y: prev[activePlacement]?.y ?? zone.y,
        w: prev[activePlacement]?.w ?? zone.w,
        h: prev[activePlacement]?.h ?? zone.h,
        ...updates,
      },
    }));
  }

  function clearDesign() {
    setDesigns((prev) => { const n = { ...prev }; delete n[activePlacement]; return n; });
  }

  function handleApply() {
    onApply(configuredPlacements);
    onClose();
  }

  /* ── pointer handlers for drag/resize on canvas ── */
  function onArtworkPointerDown(e: RPointerEvent<HTMLDivElement>, mode: "move" | "resize", corner = "") {
    e.preventDefault();
    e.stopPropagation();
    if (!current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: current.x,
      origY: current.y,
      origW: current.w,
      origH: current.h,
      resizeCorner: corner,
    };
  }

  function onCanvasPointerMove(e: RPointerEvent<HTMLDivElement>) {
    const ds = dragState.current;
    if (!ds || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - ds.startX) / rect.width) * 100;
    const dy = ((e.clientY - ds.startY) / rect.height) * 100;

    if (ds.mode === "move") {
      updateDesign({
        x: clamp(ds.origX + dx, 0, 100 - (current?.w ?? 20)),
        y: clamp(ds.origY + dy, 0, 100 - (current?.h ?? 20)),
      });
    } else {
      // resize from bottom-right
      const corner = ds.resizeCorner;
      let newX = ds.origX, newY = ds.origY, newW = ds.origW, newH = ds.origH;
      if (corner.includes("r")) newW = clamp(ds.origW + dx, MIN_SIZE_PCT, 100 - ds.origX);
      if (corner.includes("l")) { newW = clamp(ds.origW - dx, MIN_SIZE_PCT, ds.origX + ds.origW); newX = ds.origX + ds.origW - newW; }
      if (corner.includes("b")) newH = clamp(ds.origH + dy, MIN_SIZE_PCT, 100 - ds.origY);
      if (corner.includes("t")) { newH = clamp(ds.origH - dy, MIN_SIZE_PCT, ds.origY + ds.origH); newY = ds.origY + ds.origH - newH; }
      updateDesign({ x: newX, y: newY, w: newW, h: newH });
    }
  }

  function onCanvasPointerUp() { dragState.current = null; }

  /* zone click — select placement */
  function onZoneClick(key: string) {
    setActivePlacement(key);
    setRightTab("design");
  }

  if (!open) return null;

  /* ━━━━━ RENDER ━━━━━ */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex flex-col w-full max-w-[1440px] h-[94vh] mx-4 rounded-2xl border overflow-hidden"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.15)" }}>
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
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{ background: "var(--accent-soft)", color: "var(--accent-light)" }}>
                {configuredPlacements.length} placement{configuredPlacements.length !== 1 ? "s" : ""}
              </span>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ color: "var(--text-tertiary)" }}>✕</button>
          </div>
        </div>

        {/* ═══ BODY ═══ */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ─── COL 1: Placements ─── */}
          <div className="w-52 shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.08)" }}>
            <div className="px-3 pt-3 pb-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Placements</div>
            </div>
            <div className="flex-1 overflow-auto px-2 pb-2 space-y-0.5">
              {PLACEMENTS.map((p) => {
                const d = designs[p.key];
                const isActive = activePlacement === p.key;
                const has = !!(d?.decorationMethod || d?.artworkUrl);
                return (
                  <button key={p.key}
                    onClick={() => { setActivePlacement(p.key); setRightTab("design"); }}
                    className="w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-2.5"
                    style={{ background: isActive ? "var(--accent-soft)" : "transparent", borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent" }}>
                    <div className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: has ? "var(--success)" : isActive ? "var(--accent)" : "rgba(255,255,255,0.1)", boxShadow: has ? "0 0 6px var(--success)" : "none" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: isActive ? "var(--accent-light)" : "var(--text-primary)" }}>{p.label}</div>
                      {has && (
                        <div className="text-[9px] truncate" style={{ color: "var(--text-tertiary)" }}>
                          {DECO_TYPES.find((dt) => dt.key === d?.decorationMethod)?.label ?? ""}
                          {d?.artworkName ? ` · ${d.artworkName}` : ""}
                        </div>
                      )}
                    </div>
                    {has && <span className="text-[9px] shrink-0" style={{ color: "var(--success)" }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {configuredPlacements.length === 0 ? "No placements configured" : `${configuredPlacements.length} / ${PLACEMENTS.length} configured`}
              </div>
            </div>
          </div>

          {/* ─── COL 2: Garment canvas ─── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
            {/* View tabs */}
            <div className="flex items-center justify-center gap-1.5 px-4 pt-3 pb-1">
              {VIEWS.map((v) => {
                const isActive = activeView === v.key;
                return (
                  <button key={v.key} onClick={() => setActiveView(v.key)}
                    className="px-5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: isActive ? "var(--accent)" : "rgba(255,255,255,0.06)", color: isActive ? "white" : "var(--text-tertiary)", boxShadow: isActive ? "0 2px 8px rgba(99,102,241,0.4)" : "none" }}>
                    {v.label}
                  </button>
                );
              })}
            </div>

            {/* Canvas area */}
            <div
              className="flex-1 flex items-center justify-center p-4"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
            >
              <div
                ref={canvasRef}
                className="relative rounded-2xl overflow-hidden select-none"
                style={{ background: "#ffffff", width: "100%", maxWidth: 500, aspectRatio: "1 / 1" }}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
                onPointerLeave={onCanvasPointerUp}
              >
                {/* Product image */}
                {displayImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayImage} alt={productDetail.productName}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    draggable={false} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-8xl opacity-20">👕</div>
                  </div>
                )}

                {/* Placement zones — dashed rectangles */}
                {visibleZones.map((zone) => {
                  const d = designs[zone.key];
                  const isActive = activePlacement === zone.key;
                  const has = !!(d?.decorationMethod || d?.artworkUrl);
                  return (
                    <div key={zone.key}
                      onClick={() => onZoneClick(zone.key)}
                      className="absolute cursor-pointer transition-all"
                      style={{
                        left: `${zone.x}%`, top: `${zone.y}%`,
                        width: `${zone.w}%`, height: `${zone.h}%`,
                        border: isActive
                          ? "2px solid rgba(99,102,241,0.9)"
                          : has
                            ? "2px solid rgba(34,197,94,0.6)"
                            : "2px dashed rgba(99,102,241,0.35)",
                        borderRadius: 6,
                        background: isActive
                          ? "rgba(99,102,241,0.08)"
                          : has
                            ? "rgba(34,197,94,0.05)"
                            : "rgba(99,102,241,0.03)",
                        zIndex: isActive ? 5 : 2,
                      }}
                    >
                      {/* Zone label */}
                      <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[8px] font-bold whitespace-nowrap"
                        style={{
                          background: isActive ? "rgba(99,102,241,0.9)" : has ? "rgba(34,197,94,0.8)" : "rgba(99,102,241,0.5)",
                          color: "white",
                        }}>
                        {zone.label}
                        {has && d?.decorationMethod && ` · ${DECO_TYPES.find((dt) => dt.key === d.decorationMethod)?.label ?? d.decorationMethod}`}
                      </div>
                    </div>
                  );
                })}

                {/* Artwork overlay — draggable + resizable */}
                {current?.artworkUrl && current.artworkUrl.startsWith("data:image/") && pInfo.view === activeView && (
                  <div
                    className="absolute z-10"
                    style={{
                      left: `${current.x}%`, top: `${current.y}%`,
                      width: `${current.w}%`, height: `${current.h}%`,
                      cursor: "move",
                    }}
                    onPointerDown={(e) => onArtworkPointerDown(e, "move")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={current.artworkUrl} alt="Design"
                      className="w-full h-full object-contain pointer-events-none"
                      style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.45))" }}
                      draggable={false} />

                    {/* Selection border */}
                    <div className="absolute inset-0 border-2 rounded"
                      style={{ borderColor: "rgba(99,102,241,0.9)", pointerEvents: "none" }} />

                    {/* Resize handles — corners */}
                    {["tl", "tr", "bl", "br"].map((corner) => (
                      <div
                        key={corner}
                        className="absolute w-3.5 h-3.5 rounded-sm"
                        style={{
                          background: "var(--accent)",
                          border: "2px solid white",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                          cursor: corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize",
                          ...(corner.includes("t") ? { top: -6 } : { bottom: -6 }),
                          ...(corner.includes("l") ? { left: -6 } : { right: -6 }),
                        }}
                        onPointerDown={(e) => {
                          const map: Record<string, string> = { tl: "tl", tr: "tr", bl: "bl", br: "br" };
                          onArtworkPointerDown(e, "resize", map[corner]);
                        }}
                      />
                    ))}

                    {/* Edge handles — mid points */}
                    {[
                      { edge: "t", style: { top: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } },
                      { edge: "b", style: { bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } },
                      { edge: "l", style: { left: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
                      { edge: "r", style: { right: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } },
                    ].map(({ edge, style }) => (
                      <div key={edge}
                        className="absolute w-2.5 h-2.5 rounded-full"
                        style={{ background: "var(--accent)", border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", ...style } as React.CSSProperties}
                        onPointerDown={(e) => onArtworkPointerDown(e, "resize", edge)} />
                    ))}

                    {/* Size label on artwork */}
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold whitespace-nowrap"
                      style={{ background: "rgba(0,0,0,0.7)", color: "white" }}>
                      {current.w.toFixed(0)}% × {current.h.toFixed(0)}%
                    </div>
                  </div>
                )}

                {/* Drop overlay */}
                {dragOver && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20"
                    style={{ background: "rgba(99,102,241,0.2)", border: "3px dashed var(--accent)" }}>
                    <span className="text-5xl mb-2">📥</span>
                    <div className="text-sm font-semibold" style={{ color: "var(--accent-light)" }}>Drop artwork for {pInfo.label}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Colour bar */}
            {productDetail.colors.length > 0 && (
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="text-[10px] font-medium mr-1" style={{ color: "var(--text-tertiary)" }}>Colour:</span>
                  {productDetail.colors.slice(0, 24).map((c) => {
                    const isA = activeColorId === c.id;
                    return (
                      <button key={c.id} onClick={() => setActiveColorId(c.id)} title={c.name} className="group relative">
                        <div className="w-6 h-6 rounded-full border-2 transition-all"
                          style={{
                            background: colorToCss(c.name),
                            borderColor: isA ? "var(--accent)" : "rgba(255,255,255,0.15)",
                            boxShadow: isA ? "0 0 0 2px var(--accent)" : "0 1px 2px rgba(0,0,0,0.2)",
                            transform: isA ? "scale(1.2)" : "scale(1)",
                          }} />
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <div className="px-1.5 py-0.5 rounded text-[8px] font-medium whitespace-nowrap" style={{ background: "rgba(0,0,0,0.85)", color: "white" }}>{c.name}</div>
                        </div>
                      </button>
                    );
                  })}
                  {productDetail.colors.length > 24 && <span className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>+{productDetail.colors.length - 24}</span>}
                </div>
              </div>
            )}
            {colorImages.length > 1 && (
              <div className="px-4 pb-3">
                <div className="flex gap-1.5 overflow-x-auto justify-center">
                  {colorImages.slice(0, 14).map((img, i) => {
                    const isA = displayImage === img.url;
                    return (
                      <button key={i} onClick={() => {
                        const m = productDetail.colors.find((c) => c.name.toLowerCase() === img.color?.toLowerCase());
                        if (m) setActiveColorId(m.id);
                        setActiveView("front");
                      }} className="shrink-0 rounded-lg overflow-hidden border-2 transition-all"
                        style={{ width: 42, height: 42, borderColor: isA ? "var(--accent)" : "transparent", background: "#fff" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.color ?? ""} className="w-full h-full object-contain" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ─── COL 3: Config panel ─── */}
          <div className="w-80 shrink-0 border-l flex flex-col overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {/* Tabs */}
            <div className="flex border-b shrink-0" style={{ borderColor: "var(--border)" }}>
              {([{ key: "design" as RightTab, label: "Design" }, { key: "artwork" as RightTab, label: "Artwork" }, { key: "notes" as RightTab, label: "Notes" }]).map((t) => (
                <button key={t.key} onClick={() => setRightTab(t.key)}
                  className="flex-1 py-2.5 text-xs font-semibold transition-colors relative"
                  style={{ color: rightTab === t.key ? "var(--accent-light)" : "var(--text-tertiary)" }}>
                  {t.label}
                  {rightTab === t.key && <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: "var(--accent)" }} />}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* ── DESIGN TAB ── */}
              {rightTab === "design" && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{pInfo.label}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{VIEWS.find((v) => v.key === pInfo.view)?.label} view</div>
                    </div>
                    {current && (current.decorationMethod || current.artworkUrl) && (
                      <button onClick={clearDesign} className="text-[10px] px-2 py-1 rounded hover:bg-white/5" style={{ color: "var(--danger)" }}>Clear</button>
                    )}
                  </div>

                  {/* Decoration Method */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Decoration Method</div>
                    <div className="space-y-1">
                      {DECO_TYPES.map((dt) => {
                        const isA = current?.decorationMethod === dt.key;
                        return (
                          <button key={dt.key} onClick={() => updateDesign({ decorationMethod: dt.key })}
                            className="w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between"
                            style={{ borderColor: isA ? "var(--accent)" : "var(--border)", background: isA ? "var(--accent-soft)" : "transparent" }}>
                            <div>
                              <div className="text-xs font-medium" style={{ color: isA ? "var(--accent-light)" : "var(--text-primary)" }}>{dt.label}</div>
                              <div className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>{dt.desc}</div>
                            </div>
                            {isA && <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--accent)" }}><span className="text-[10px] text-white">✓</span></div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Position & size */}
                  {current?.artworkUrl && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Position & Size</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "X Position", field: "x" as const },
                          { label: "Y Position", field: "y" as const },
                          { label: "Width",      field: "w" as const },
                          { label: "Height",     field: "h" as const },
                        ].map(({ label, field }) => (
                          <div key={field} className="space-y-1">
                            <label className="text-[9px] font-medium" style={{ color: "var(--text-tertiary)" }}>{label} (%)</label>
                            <input type="number" min={0} max={100} step={1}
                              value={Math.round(current[field])}
                              onChange={(e) => updateDesign({ [field]: clamp(Number(e.target.value), 0, 100) })}
                              className="input w-full text-xs font-mono text-center" style={{ padding: "4px 6px" }} />
                          </div>
                        ))}
                      </div>
                      <button onClick={() => {
                        const zone = PLACEMENTS.find((p) => p.key === activePlacement)!;
                        updateDesign({ x: zone.x, y: zone.y, w: zone.w, h: zone.h });
                      }} className="text-[10px] font-medium hover:underline" style={{ color: "var(--accent-light)" }}>
                        Reset to default position
                      </button>
                    </div>
                  )}

                  {/* Attached artwork */}
                  {current?.artworkUrl && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Attached Artwork</div>
                      <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "rgba(99,102,241,0.3)", background: "var(--accent-soft)" }}>
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0 flex items-center justify-center">
                          {current.artworkUrl.startsWith("data:image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={current.artworkUrl} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <div className="text-center"><div className="text-lg">📄</div><div className="text-[7px] font-bold uppercase" style={{ color: "#666" }}>{current.artworkFileType ?? "FILE"}</div></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{current.artworkName ?? "Artwork"}</div>
                          <div className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>Assigned to {pInfo.label}</div>
                        </div>
                        <button onClick={() => updateDesign({ artworkUrl: undefined, artworkName: undefined, artworkFileType: undefined })}
                          className="text-[10px] px-1.5 py-1 rounded hover:bg-white/5" style={{ color: "var(--danger)" }}>✕</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── ARTWORK TAB ── */}
              {rightTab === "artwork" && (
                <>
                  <div className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all hover:border-[var(--accent)]"
                    style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}
                    onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,.dst,.pes,.jef,.exp,.vp3,.hus,.pdf" className="hidden"
                      onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />
                    <div className="text-3xl mb-1.5">📁</div>
                    <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Click to upload artwork</div>
                    <div className="text-[9px] mt-1" style={{ color: "var(--text-tertiary)" }}>PNG · JPG · SVG · PDF · DST · PES · JEF — Max 10MB</div>
                    <div className="text-[9px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>Or drag & drop onto the garment preview</div>
                  </div>
                  {uploads.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Uploaded Files ({uploads.length})</div>
                      <div className="space-y-1">
                        {uploads.map((file, i) => {
                          const isAssigned = current?.artworkUrl === file.url;
                          return (
                            <button key={i} onClick={() => updateDesign({ artworkUrl: file.url, artworkName: file.name, artworkFileType: file.ext })}
                              className="w-full flex items-center gap-2.5 p-2 rounded-lg border transition-all hover:bg-white/5 text-left"
                              style={{ borderColor: isAssigned ? "var(--accent)" : "var(--border)", background: isAssigned ? "var(--accent-soft)" : "transparent" }}>
                              <div className="w-10 h-10 rounded bg-white flex items-center justify-center shrink-0 overflow-hidden">
                                {file.isImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={file.url} alt={file.name} className="w-full h-full object-contain" />
                                ) : (
                                  <div className="text-center"><div className="text-sm">📄</div><div className="text-[6px] font-bold uppercase" style={{ color: "#666" }}>{file.ext}</div></div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-medium truncate" style={{ color: "var(--text-primary)" }}>{file.name}</div>
                                <div className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                                  {isAssigned ? `Assigned to ${pInfo.label}` : `Click to assign to ${pInfo.label}`}
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
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Design Notes — {pInfo.label}</div>
                    <textarea value={current?.notes ?? ""} onChange={(e) => updateDesign({ notes: e.target.value })}
                      placeholder={`Special instructions for ${pInfo.label}...\n\ne.g. "Match PMS 186C red"\n"Scale logo to 8cm wide"\n"Position 3cm below collar"`}
                      rows={8} className="input w-full resize-y text-sm" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Quick Notes</div>
                    <div className="flex flex-wrap gap-1.5">
                      {["Match PMS colours exactly", "Scale to fit", "Centre aligned", "Left aligned", "White underbase required", "Remove background", "Mirror for left/right", "Design requires changes"].map((q) => (
                        <button key={q} onClick={() => updateDesign({ notes: (current?.notes ? current.notes + "\n" : "") + q })}
                          className="px-2 py-1 rounded text-[9px] font-medium hover:bg-white/5 border transition-colors"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>+ {q}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-t shrink-0" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.1)" }}>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {configuredPlacements.length === 0 ? (
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Select a placement zone on the garment, choose a decoration method, and upload artwork</span>
            ) : (
              configuredPlacements.map((d) => (
                <div key={d.placement} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-light)" }}>
                  {PLACEMENTS.find((p) => p.key === d.placement)?.label ?? d.placement}
                  {d.decorationMethod && ` · ${DECO_TYPES.find((dt) => dt.key === d.decorationMethod)?.label ?? d.decorationMethod}`}
                  {d.artworkName && " 📎"}
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 shrink-0 ml-3">
            <button onClick={onClose} className="btn text-sm px-4" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={handleApply} className="btn btn--primary text-sm px-5">Apply Design{configuredPlacements.length !== 1 ? "s" : ""}</button>
          </div>
        </div>
      </div>
    </div>
  );
}