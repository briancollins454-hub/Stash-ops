"use client";

import {
  useState, useRef, useCallback, useMemo, useEffect,
  type PointerEvent as RPointerEvent, type CSSProperties,
} from "react";

/* ═══════════════════════════════════════════════════════════
   PUBLIC TYPES — must stay compatible with quote-builder.tsx
   ═══════════════════════════════════════════════════════════ */

export interface DesignConfig {
  placement: string;
  decorationMethod: string;
  artworkUrl?: string;
  artworkName?: string;
  artworkFileType?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  stitchCount?: number;
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

/* ═══════════════════════════════════════════════════════════
   VIEW / ZONE SYSTEM
   ═══════════════════════════════════════════════════════════ */

type ViewKey = "front" | "back" | "left" | "right";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "left", label: "Left Sleeve" },
  { key: "right", label: "Right Sleeve" },
];

const PROCESSES = [
  { key: "WEMB", label: "Embroidery", icon: "🧵", hasStitchCount: true },
  { key: "DTF",  label: "DTF",        icon: "🖨️", hasStitchCount: false },
  { key: "DTG",  label: "DTG",        icon: "🎯", hasStitchCount: false },
  { key: "TRF",  label: "Transfer",   icon: "♨️", hasStitchCount: false },
  { key: "RHS",  label: "Screen Print",icon: "🖼️", hasStitchCount: false },
  { key: "SUB",  label: "Sublimation", icon: "🌈", hasStitchCount: false },
] as const;

interface ZoneDef {
  key: string;
  label: string;
  view: ViewKey;
  x: number; y: number; w: number; h: number;
}

const ZONE_TEMPLATES: Record<string, ZoneDef[]> = {
  tshirt: [
    { key: "left_chest",        label: "Left Chest",         view: "front", x: 50, y: 26, w: 18, h: 16 },
    { key: "right_chest",       label: "Right Chest",        view: "front", x: 28, y: 26, w: 18, h: 16 },
    { key: "centre_chest",      label: "Centre Chest",       view: "front", x: 28, y: 24, w: 40, h: 20 },
    { key: "main_body",         label: "Main Body",          view: "front", x: 20, y: 22, w: 56, h: 42 },
    { key: "full_back",         label: "Full Back",          view: "back",  x: 18, y: 18, w: 60, h: 48 },
    { key: "left_sleeve_short", label: "Left Sleeve",        view: "left",  x: 28, y: 18, w: 30, h: 22 },
    { key: "right_sleeve_short",label: "Right Sleeve",       view: "right", x: 40, y: 18, w: 30, h: 22 },
  ],
  hoodie: [
    { key: "left_chest",        label: "Left Chest",         view: "front", x: 50, y: 30, w: 18, h: 16 },
    { key: "right_chest",       label: "Right Chest",        view: "front", x: 28, y: 30, w: 18, h: 16 },
    { key: "centre_chest",      label: "Centre Chest",       view: "front", x: 28, y: 28, w: 40, h: 20 },
    { key: "main_body",         label: "Main Body",          view: "front", x: 20, y: 24, w: 56, h: 42 },
    { key: "full_back",         label: "Full Back",          view: "back",  x: 18, y: 20, w: 60, h: 48 },
    { key: "left_sleeve_long",  label: "Left Sleeve",        view: "left",  x: 22, y: 14, w: 34, h: 38 },
    { key: "right_sleeve_long", label: "Right Sleeve",       view: "right", x: 42, y: 14, w: 34, h: 38 },
    { key: "hood",              label: "Hood",               view: "back",  x: 30, y: 2,  w: 36, h: 18 },
  ],
  polo: [
    { key: "left_chest",        label: "Left Chest",         view: "front", x: 50, y: 26, w: 18, h: 16 },
    { key: "right_chest",       label: "Right Chest",        view: "front", x: 28, y: 26, w: 18, h: 16 },
    { key: "main_body",         label: "Main Body",          view: "front", x: 20, y: 22, w: 56, h: 42 },
    { key: "full_back",         label: "Full Back",          view: "back",  x: 18, y: 18, w: 60, h: 48 },
    { key: "left_sleeve_short", label: "Left Sleeve",        view: "left",  x: 28, y: 18, w: 30, h: 22 },
    { key: "right_sleeve_short",label: "Right Sleeve",       view: "right", x: 40, y: 18, w: 30, h: 22 },
  ],
  jacket: [
    { key: "left_chest",        label: "Left Chest",         view: "front", x: 50, y: 28, w: 18, h: 16 },
    { key: "right_chest",       label: "Right Chest",        view: "front", x: 28, y: 28, w: 18, h: 16 },
    { key: "main_body",         label: "Main Body",          view: "front", x: 20, y: 24, w: 56, h: 42 },
    { key: "full_back",         label: "Full Back",          view: "back",  x: 18, y: 18, w: 60, h: 48 },
    { key: "left_sleeve_long",  label: "Left Sleeve",        view: "left",  x: 22, y: 14, w: 34, h: 38 },
    { key: "right_sleeve_long", label: "Right Sleeve",       view: "right", x: 42, y: 14, w: 34, h: 38 },
  ],
  trousers: [
    { key: "left_leg_front",    label: "Left Leg Front",     view: "front", x: 48, y: 30, w: 18, h: 22 },
    { key: "right_leg_front",   label: "Right Leg Front",    view: "front", x: 30, y: 30, w: 18, h: 22 },
    { key: "left_leg_back",     label: "Left Leg Back",      view: "back",  x: 48, y: 30, w: 18, h: 22 },
    { key: "backside",          label: "Backside",           view: "back",  x: 24, y: 10, w: 48, h: 26 },
  ],
  headwear: [
    { key: "headwear_front",    label: "Front Panel",        view: "front", x: 20, y: 20, w: 56, h: 40 },
    { key: "headwear_back",     label: "Back Panel",         view: "back",  x: 20, y: 20, w: 56, h: 40 },
  ],
  bag: [
    { key: "bag_front",         label: "Front",              view: "front", x: 15, y: 20, w: 66, h: 50 },
    { key: "bag_back",          label: "Back",               view: "back",  x: 15, y: 20, w: 66, h: 50 },
  ],
};

const DEFAULT_ZONES: ZoneDef[] = ZONE_TEMPLATES.tshirt;

/* ═══════════════════════════════════════════════════════════
   SVG GARMENT SILHOUETTES
   ═══════════════════════════════════════════════════════════ */

function GarmentSVG({ view, garmentType, garmentColor, className, style }: {
  view: ViewKey; garmentType: string; garmentColor?: string; className?: string; style?: CSSProperties;
}) {
  const fill = garmentColor ? hexToRgba(garmentColor, 0.15) : "rgba(148,163,184,0.12)";
  const stroke = garmentColor ? hexToRgba(garmentColor, 0.35) : "rgba(148,163,184,0.25)";
  const sw = 1;
  const gt = garmentType;

  if (gt === "headwear") {
    return (
      <svg viewBox="0 0 200 200" fill="none" className={className} style={style}>
        <ellipse cx="100" cy="110" rx="65" ry="50" fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d="M40 120 Q40 145 100 150 Q160 145 160 120" fill={fill} stroke={stroke} strokeWidth={sw} />
        <rect x="30" y="120" width="140" height="12" rx="3" fill={fill} stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }

  if (gt === "bag") {
    return (
      <svg viewBox="0 0 200 260" fill="none" className={className} style={style}>
        <rect x="30" y="50" width="140" height="170" rx="6" fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d="M60 50 Q60 20 100 20 Q140 20 140 50" fill="none" stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }

  if (gt === "trousers") {
    if (view === "front" || view === "back") {
      return (
        <svg viewBox="0 0 200 280" fill="none" className={className} style={style}>
          <path d="M50 20 L40 20 Q30 20 30 30 L30 50 L28 280 L90 280 L100 120 L110 280 L172 280 L170 50 L170 30 Q170 20 160 20 L150 20"
            fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 200 280" fill="none" className={className} style={style}>
        <path d="M60 20 L50 30 L46 280 L95 280 L100 100 L105 280 L154 280 L150 30 L140 20 Z"
          fill={fill} stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }

  if (view === "front") {
    return (
      <svg viewBox="0 0 200 250" fill="none" className={className} style={style}>
        <path d="M62 30 L42 45 L20 40 L8 70 L40 80 L42 65 L42 240 L158 240 L158 65 L160 80 L192 70 L180 40 L158 45 L138 30"
          fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d={gt === "polo"
          ? "M62 30 Q65 18 80 12 L82 28 L100 35 L118 28 L120 12 Q135 18 138 30"
          : gt === "hoodie"
            ? "M62 30 Q80 10 100 8 Q120 10 138 30 L122 45 Q100 50 78 45 Z"
            : "M62 30 Q80 10 100 8 Q120 10 138 30"}
          fill={gt === "hoodie" ? fill : "none"} stroke={stroke} strokeWidth={sw} />
        {(gt === "hoodie" || gt === "jacket") && (
          <line x1="100" y1="35" x2="100" y2="240" stroke={stroke} strokeWidth={0.5} strokeDasharray="4 3" />
        )}
      </svg>
    );
  }

  if (view === "back") {
    return (
      <svg viewBox="0 0 200 250" fill="none" className={className} style={style}>
        <path d="M62 30 L42 45 L20 40 L8 70 L40 80 L42 65 L42 240 L158 240 L158 65 L160 80 L192 70 L180 40 L158 45 L138 30"
          fill={fill} stroke={stroke} strokeWidth={sw} />
        <path d="M62 30 Q80 22 100 20 Q120 22 138 30" fill="none" stroke={stroke} strokeWidth={sw} />
        {gt === "hoodie" && (
          <path d="M62 30 Q68 8 100 4 Q132 8 138 30 L130 30 Q100 15 70 30 Z"
            fill={fill} stroke={stroke} strokeWidth={sw} />
        )}
      </svg>
    );
  }

  const flip = view === "right";
  return (
    <svg viewBox="0 0 200 250" fill="none" className={className}
      style={{ ...style, transform: flip ? "scaleX(-1)" : undefined }}>
      <path d="M70 30 L30 50 L12 70 L30 78 L55 65 L55 240 L130 240 L130 65 L135 55 L125 40 L110 30"
        fill={fill} stroke={stroke} strokeWidth={sw} />
      <path d="M70 30 Q80 14 90 12 Q100 14 110 30" fill="none" stroke={stroke} strokeWidth={sw} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

type UploadedFile = { name: string; url: string; isImage: boolean; ext: string };
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_SIZE_PCT = 4;

function fileExt(name: string): string { return name.split(".").pop()?.toLowerCase() ?? ""; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return `rgba(148,163,184,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(148,163,184,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
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
  };
  return map[n] ?? "#9e9e9e";
}

function detectGarmentType(category?: string, productName?: string): string {
  const text = `${category ?? ""} ${productName ?? ""}`.toLowerCase();
  if (/hoodie|hooded|sweat|fleece|pullover/.test(text)) return "hoodie";
  if (/polo/.test(text)) return "polo";
  if (/jacket|coat|softshell|gilet|bodywarmer/.test(text)) return "jacket";
  if (/trouser|jogger|legging/.test(text)) return "trousers";
  if (/\bshorts\b/.test(text) && !/short\s*sleeve/.test(text)) return "trousers";
  if (/\bcap\b|\bhat\b|beanie|headwear|bucket/.test(text)) return "headwear";
  if (/bag|tote|backpack|rucksack|holdall|duffel/.test(text)) return "bag";
  return "tshirt";
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (designs: DesignConfig[]) => void;
  productDetail: DesignerProductDetail;
  selectedColorId?: number;
  initialDesigns?: DesignConfig[];
}

export function DesignerModal({ open, onClose, onApply, productDetail, selectedColorId: initColorId, initialDesigns }: Props) {
  const garmentType = useMemo(() => detectGarmentType(productDetail.category, productDetail.productName), [productDetail]);
  const zones = useMemo(() => ZONE_TEMPLATES[garmentType] ?? DEFAULT_ZONES, [garmentType]);

  const [activeView, setActiveView] = useState<ViewKey>("front");
  const [activeZoneKey, setActiveZoneKey] = useState(() => zones[0]?.key ?? "left_chest");
  const [activeColorId, setActiveColorId] = useState<number | undefined>(initColorId);
  const [designs, setDesigns] = useState<Record<string, DesignConfig>>(() => {
    const m: Record<string, DesignConfig> = {};
    initialDesigns?.forEach((d) => { m[d.placement] = d; });
    return m;
  });
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rightPanel, setRightPanel] = useState<"process" | "artwork" | "notes">("process");

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: "move" | "resize";
    startX: number; startY: number;
    origX: number; origY: number; origW: number; origH: number;
    resizeCorner: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Auto-switch view when selecting a zone on another view
  useEffect(() => {
    const z = zones.find((z) => z.key === activeZoneKey);
    if (z && z.view !== activeView) setActiveView(z.view);
  }, [activeZoneKey, zones]);

  const activeZone = zones.find((z) => z.key === activeZoneKey)!;
  const current = designs[activeZoneKey];
  const visibleZones = useMemo(() => zones.filter((z) => z.view === activeView), [zones, activeView]);

  const activeColorCss = useMemo(() => {
    const selColor = productDetail.colors.find((c) => c.id === activeColorId);
    return selColor ? colorToCss(selColor.name) : undefined;
  }, [productDetail.colors, activeColorId]);

  const displayImage = useMemo(() => {
    const imgs = productDetail.images ?? [];
    const selColor = productDetail.colors.find((c) => c.id === activeColorId);
    const viewToType: Record<ViewKey, string> = { front: "front", back: "back", left: "side", right: "side" };
    const imgType = viewToType[activeView];

    if (selColor) {
      const exact = imgs.find((i) => i.type === imgType && i.color?.toLowerCase() === selColor.name.toLowerCase());
      if (exact) return exact.url;
    }
    const typeMatch = imgs.find((i) => i.type === imgType);
    if (typeMatch) return typeMatch.url;

    if (activeView === "front") {
      if (selColor) {
        const cm = imgs.find((i) => i.type === "front" && i.color?.toLowerCase() === selColor.name.toLowerCase());
        if (cm) return cm.url;
      }
      return imgs.find((i) => i.type === "front")?.url ?? imgs.find((i) => i.type === "gallery")?.url ?? null;
    }
    return null;
  }, [productDetail, activeColorId, activeView]);

  const configuredZones = useMemo(
    () => Object.values(designs).filter((d) => d.decorationMethod || d.artworkUrl),
    [designs],
  );

  /** View labels adapted per garment */
  const availableViews = useMemo(() => {
    return VIEWS.filter((v) => zones.some((z) => z.view === v.key));
  }, [zones]);

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
        const zone = zones.find((z) => z.key === activeZoneKey)!;
        setDesigns((prev) => ({
          ...prev,
          [activeZoneKey]: {
            ...prev[activeZoneKey],
            placement: activeZoneKey,
            decorationMethod: prev[activeZoneKey]?.decorationMethod || "",
            artworkUrl: dataUrl, artworkName: file.name, artworkFileType: ext,
            x: prev[activeZoneKey]?.x ?? zone.x,
            y: prev[activeZoneKey]?.y ?? zone.y,
            w: prev[activeZoneKey]?.w ?? zone.w,
            h: prev[activeZoneKey]?.h ?? zone.h,
          },
        }));
        setRightPanel("artwork");
      };
      reader.readAsDataURL(file);
    });
  }, [activeZoneKey, zones]);

  function updateDesign(updates: Partial<DesignConfig>) {
    const zone = zones.find((z) => z.key === activeZoneKey)!;
    setDesigns((prev) => ({
      ...prev,
      [activeZoneKey]: {
        ...prev[activeZoneKey],
        placement: activeZoneKey,
        decorationMethod: prev[activeZoneKey]?.decorationMethod || "",
        x: prev[activeZoneKey]?.x ?? zone.x,
        y: prev[activeZoneKey]?.y ?? zone.y,
        w: prev[activeZoneKey]?.w ?? zone.w,
        h: prev[activeZoneKey]?.h ?? zone.h,
        ...updates,
      },
    }));
  }

  function clearDesign() {
    setDesigns((prev) => { const n = { ...prev }; delete n[activeZoneKey]; return n; });
  }

  function handleApply() {
    onApply(configuredZones);
    onClose();
  }

  /* ── pointer handlers ── */
  function onArtworkPointerDown(e: RPointerEvent<HTMLDivElement>, mode: "move" | "resize", corner = "") {
    e.preventDefault();
    e.stopPropagation();
    if (!current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = {
      mode, startX: e.clientX, startY: e.clientY,
      origX: current.x, origY: current.y, origW: current.w, origH: current.h,
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
      const c = ds.resizeCorner;
      let nx = ds.origX, ny = ds.origY, nw = ds.origW, nh = ds.origH;
      if (c.includes("r")) nw = clamp(ds.origW + dx, MIN_SIZE_PCT, 100 - ds.origX);
      if (c.includes("l")) { nw = clamp(ds.origW - dx, MIN_SIZE_PCT, ds.origX + ds.origW); nx = ds.origX + ds.origW - nw; }
      if (c.includes("b")) nh = clamp(ds.origH + dy, MIN_SIZE_PCT, 100 - ds.origY);
      if (c.includes("t")) { nh = clamp(ds.origH - dy, MIN_SIZE_PCT, ds.origY + ds.origH); ny = ds.origY + ds.origH - nh; }
      updateDesign({ x: nx, y: ny, w: nw, h: nh });
    }
  }

  function onCanvasPointerUp() { dragState.current = null; }

  if (!open) return null;

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex flex-col w-full max-w-[1440px] h-[92vh] mx-6 rounded-xl overflow-hidden"
        style={{ background: "#1a1a2e", boxShadow: "0 25px 80px rgba(0,0,0,0.6)" }}>

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between px-5 py-2.5 shrink-0"
          style={{ background: "#12122b", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: "#6366f1" }} />
              <span className="text-[13px] font-semibold tracking-tight" style={{ color: "#e2e8f0" }}>
                Decoration Studio
              </span>
            </div>
            <div className="w-px h-4 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="text-[12px] truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
              {productDetail.productName}
              <span className="mx-1.5 opacity-50">·</span>
              {productDetail.productCode}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {configuredZones.length > 0 && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>
                {configuredZones.length} decoration{configuredZones.length !== 1 ? "s" : ""}
              </span>
            )}
            <button onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>

        {/* ═══ BODY ═══ */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ─── LEFT SIDEBAR: Locations ─── */}
          <div className="w-[200px] shrink-0 flex flex-col"
            style={{ background: "#151528", borderRight: "1px solid rgba(255,255,255,0.06)" }}>

            {/* View thumbnails — like DecoNetwork Locations panel */}
            <div className="px-3 pt-3 pb-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2"
                style={{ color: "rgba(255,255,255,0.3)" }}>
                Locations
              </div>
              <div className="space-y-1">
                {availableViews.map((v) => {
                  const isActive = activeView === v.key;
                  const viewZones = zones.filter((z) => z.view === v.key);
                  const hasDesign = viewZones.some((z) => {
                    const d = designs[z.key];
                    return d?.decorationMethod || d?.artworkUrl;
                  });
                  return (
                    <button key={v.key}
                      onClick={() => {
                        setActiveView(v.key);
                        const firstZone = viewZones[0];
                        if (firstZone) setActiveZoneKey(firstZone.key);
                      }}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all"
                      style={{
                        background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
                        border: isActive ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                      }}>
                      {/* Mini garment thumbnail */}
                      <div className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                        style={{ background: isActive ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)" }}>
                        <GarmentSVG
                          view={v.key}
                          garmentType={garmentType}
                          garmentColor={activeColorCss}
                          className="w-8 h-8"
                        />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-[11px] font-medium" style={{ color: isActive ? "#c7d2fe" : "rgba(255,255,255,0.55)" }}>
                          {v.label}
                        </div>
                        <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                          {viewZones.length} area{viewZones.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      {hasDesign && (
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#22c55e" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mx-3 my-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }} />

            {/* Decoration areas for active view */}
            <div className="flex-1 overflow-auto px-3 pb-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2"
                style={{ color: "rgba(255,255,255,0.3)" }}>
                Decoration Areas
              </div>
              <div className="space-y-0.5">
                {visibleZones.map((z) => {
                  const d = designs[z.key];
                  const isActive = activeZoneKey === z.key;
                  const hasConfig = !!(d?.decorationMethod || d?.artworkUrl);
                  return (
                    <button key={z.key}
                      onClick={() => { setActiveZoneKey(z.key); setRightPanel("process"); }}
                      className="w-full text-left px-2.5 py-2 rounded-md transition-all flex items-center gap-2"
                      style={{
                        background: isActive ? "rgba(99,102,241,0.15)" : "transparent",
                      }}>
                      <div className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background: hasConfig ? "#22c55e" : isActive ? "#6366f1" : "rgba(255,255,255,0.12)",
                        }} />
                      <span className="text-[11px] font-medium flex-1 truncate"
                        style={{ color: isActive ? "#c7d2fe" : hasConfig ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)" }}>
                        {z.label}
                      </span>
                      {hasConfig && (
                        <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
                          {PROCESSES.find((p) => p.key === d?.decorationMethod)?.label ?? ""}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Colour picker at bottom of sidebar */}
            {productDetail.colors.length > 0 && (
              <div className="px-3 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-2"
                  style={{ color: "rgba(255,255,255,0.3)" }}>
                  Colour
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {productDetail.colors.slice(0, 20).map((c) => {
                    const isA = activeColorId === c.id;
                    return (
                      <button key={c.id} onClick={() => setActiveColorId(c.id)} title={c.name} className="group relative">
                        <div className="w-5 h-5 rounded-full transition-all"
                          style={{
                            background: colorToCss(c.name),
                            outline: isA ? "2px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                            outlineOffset: isA ? "2px" : "0px",
                            transform: isA ? "scale(1.15)" : "scale(1)",
                          }} />
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                          <div className="px-1.5 py-0.5 rounded text-[8px] font-medium whitespace-nowrap"
                            style={{ background: "rgba(0,0,0,0.9)", color: "white" }}>{c.name}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ─── CENTER: Canvas ─── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden"
            style={{ background: "#1e1e3a" }}>

            {/* Canvas area */}
            <div className="flex-1 flex items-center justify-center p-6 relative"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
            >
              {/* Subtle grid background pattern */}
              <div className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }} />

              <div
                ref={canvasRef}
                className="relative select-none"
                style={{ width: "100%", maxWidth: 480, aspectRatio: "1 / 1.15" }}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
                onPointerLeave={onCanvasPointerUp}
              >
                {/* Garment silhouette */}
                <GarmentSVG
                  view={activeView}
                  garmentType={garmentType}
                  garmentColor={activeColorCss}
                  className="absolute inset-0 w-full h-full"
                  style={{ zIndex: 0, opacity: displayImage ? 0.15 : 1 }}
                />

                {/* Product image */}
                {displayImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayImage}
                    alt={`${productDetail.productName} — ${activeView}`}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    style={{ zIndex: 1 }}
                    draggable={false}
                  />
                )}

                {/* Active zone highlight — ONLY the selected zone, subtle */}
                {activeZone.view === activeView && (
                  <div
                    className="absolute transition-all duration-200"
                    style={{
                      left: `${activeZone.x}%`, top: `${activeZone.y}%`,
                      width: `${activeZone.w}%`, height: `${activeZone.h}%`,
                      border: "1.5px dashed rgba(99,102,241,0.6)",
                      borderRadius: 4,
                      background: "rgba(99,102,241,0.06)",
                      zIndex: 2,
                    }}
                  >
                    {/* Corner markers */}
                    {["tl","tr","bl","br"].map((c) => (
                      <div key={c} className="absolute w-2 h-2"
                        style={{
                          ...(c.includes("t") ? { top: -1 } : { bottom: -1 }),
                          ...(c.includes("l") ? { left: -1 } : { right: -1 }),
                          borderColor: "rgba(99,102,241,0.7)",
                          borderWidth: 0,
                          ...(c === "tl" ? { borderTopWidth: 2, borderLeftWidth: 2 } : {}),
                          ...(c === "tr" ? { borderTopWidth: 2, borderRightWidth: 2 } : {}),
                          ...(c === "bl" ? { borderBottomWidth: 2, borderLeftWidth: 2 } : {}),
                          ...(c === "br" ? { borderBottomWidth: 2, borderRightWidth: 2 } : {}),
                        }}
                      />
                    ))}

                    {/* Crosshair centre lines — only when no artwork */}
                    {!current?.artworkUrl && (
                      <>
                        <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: "rgba(99,102,241,0.15)" }} />
                        <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: "rgba(99,102,241,0.15)" }} />
                      </>
                    )}
                  </div>
                )}

                {/* Non-active zones — barely visible dots */}
                {visibleZones.filter((z) => z.key !== activeZoneKey).map((zone) => {
                  const d = designs[zone.key];
                  const hasConfig = !!(d?.decorationMethod || d?.artworkUrl);
                  return (
                    <div key={zone.key}
                      onClick={() => { setActiveZoneKey(zone.key); setRightPanel("process"); }}
                      className="absolute cursor-pointer transition-opacity hover:opacity-100"
                      style={{
                        left: `${zone.x}%`, top: `${zone.y}%`,
                        width: `${zone.w}%`, height: `${zone.h}%`,
                        border: hasConfig
                          ? "1px solid rgba(34,197,94,0.25)"
                          : "1px dashed rgba(255,255,255,0.08)",
                        borderRadius: 3,
                        opacity: 0.5,
                        zIndex: 2,
                      }}
                    />
                  );
                })}

                {/* Artwork overlay — draggable & resizable */}
                {current?.artworkUrl && current.artworkUrl.startsWith("data:image/") && activeZone.view === activeView && (
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
                    <img src={current.artworkUrl} alt="Design artwork"
                      className="w-full h-full object-contain pointer-events-none"
                      style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}
                      draggable={false} />

                    {/* Selection border */}
                    <div className="absolute inset-0 border rounded"
                      style={{ borderColor: "rgba(99,102,241,0.8)", borderWidth: 1.5, pointerEvents: "none" }} />

                    {/* 4 corner handles */}
                    {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                      <div key={corner}
                        className="absolute w-3 h-3 rounded-sm"
                        style={{
                          background: "#6366f1", border: "1.5px solid white",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                          cursor: corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize",
                          ...(corner.includes("t") ? { top: -5 } : { bottom: -5 }),
                          ...(corner.includes("l") ? { left: -5 } : { right: -5 }),
                        }}
                        onPointerDown={(e) => onArtworkPointerDown(e, "resize", corner)} />
                    ))}

                    {/* 4 edge handles */}
                    {([
                      { edge: "t", style: { top: -4, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } as CSSProperties },
                      { edge: "b", style: { bottom: -4, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } as CSSProperties },
                      { edge: "l", style: { left: -4, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } as CSSProperties },
                      { edge: "r", style: { right: -4, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } as CSSProperties },
                    ]).map(({ edge, style }) => (
                      <div key={edge}
                        className="absolute w-2 h-2 rounded-full"
                        style={{ background: "#6366f1", border: "1.5px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", ...style }}
                        onPointerDown={(e) => onArtworkPointerDown(e, "resize", edge)} />
                    ))}
                  </div>
                )}

                {/* Non-image file indicator (DST, PES etc.) */}
                {current?.artworkUrl && !current.artworkUrl.startsWith("data:image/") && activeZone.view === activeView && (
                  <div className="absolute z-10 flex flex-col items-center justify-center rounded border-2 border-dashed"
                    style={{
                      left: `${current.x}%`, top: `${current.y}%`,
                      width: `${current.w}%`, height: `${current.h}%`,
                      borderColor: "rgba(99,102,241,0.5)",
                      background: "rgba(99,102,241,0.08)",
                    }}>
                    <div className="text-xl mb-0.5">📄</div>
                    <div className="text-[9px] font-bold uppercase" style={{ color: "#818cf8" }}>
                      {current.artworkFileType ?? "FILE"}
                    </div>
                    <div className="text-[8px] truncate px-2 max-w-full" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {current.artworkName}
                    </div>
                  </div>
                )}

                {/* Drop overlay */}
                {dragOver && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20 rounded-xl"
                    style={{ background: "rgba(99,102,241,0.15)", border: "2px dashed rgba(99,102,241,0.5)" }}>
                    <span className="text-4xl mb-2">📥</span>
                    <div className="text-sm font-medium" style={{ color: "#c7d2fe" }}>
                      Drop artwork here
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Active zone label — clean bar below canvas */}
            <div className="px-6 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {VIEWS.find((v) => v.key === activeView)?.label}
                </span>
                <div className="w-px h-3" style={{ background: "rgba(255,255,255,0.1)" }} />
                <span className="text-[11px] font-semibold" style={{ color: "#c7d2fe" }}>
                  {activeZone.label}
                </span>
              </div>
              {current?.artworkUrl && (
                <div className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {Math.round(current.w)}% × {Math.round(current.h)}%
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT SIDEBAR: Configuration ─── */}
          <div className="w-[300px] shrink-0 flex flex-col overflow-hidden"
            style={{ background: "#151528", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>

            {/* Panel header with zone name */}
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "#e2e8f0" }}>{activeZone.label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {VIEWS.find((v) => v.key === activeZone.view)?.label} · {garmentType}
                  </div>
                </div>
                {current && (current.decorationMethod || current.artworkUrl) && (
                  <button onClick={clearDesign}
                    className="text-[10px] px-2 py-1 rounded transition-colors"
                    style={{ color: "#f87171" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(248,113,113,0.1)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Tab row */}
            <div className="flex px-4 gap-1 mb-1">
              {([
                { key: "process" as const, label: "Process" },
                { key: "artwork" as const, label: "Artwork" },
                { key: "notes" as const, label: "Notes" },
              ]).map((t) => (
                <button key={t.key} onClick={() => setRightPanel(t.key)}
                  className="flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all"
                  style={{
                    background: rightPanel === t.key ? "rgba(99,102,241,0.15)" : "transparent",
                    color: rightPanel === t.key ? "#c7d2fe" : "rgba(255,255,255,0.3)",
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto px-4 py-3 space-y-4">

              {/* ── PROCESS TAB ── */}
              {rightPanel === "process" && (
                <>
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Decoration Method
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PROCESSES.map((proc) => {
                        const isA = current?.decorationMethod === proc.key;
                        return (
                          <button key={proc.key}
                            onClick={() => updateDesign({ decorationMethod: proc.key })}
                            className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg transition-all"
                            style={{
                              background: isA ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.02)",
                              border: isA ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.06)",
                            }}>
                            <span className="text-lg">{proc.icon}</span>
                            <span className="text-[10px] font-medium"
                              style={{ color: isA ? "#c7d2fe" : "rgba(255,255,255,0.5)" }}>
                              {proc.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stitch count */}
                  {current?.decorationMethod === "WEMB" && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Stitch Count
                      </div>
                      <input type="number" min={0} step={100}
                        value={current.stitchCount ?? ""}
                        onChange={(e) => updateDesign({ stitchCount: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="e.g. 7500"
                        className="w-full text-sm font-mono rounded-lg px-3 py-2"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "#e2e8f0",
                          outline: "none",
                        }} />
                    </div>
                  )}

                  {/* Position & Size — only when artwork is placed */}
                  {current?.artworkUrl && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Position & Size
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { label: "X", field: "x" as const },
                          { label: "Y", field: "y" as const },
                          { label: "W", field: "w" as const },
                          { label: "H", field: "h" as const },
                        ]).map(({ label, field }) => (
                          <div key={field} className="flex items-center gap-2">
                            <label className="text-[10px] font-mono w-3 text-right" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</label>
                            <input type="number" min={0} max={100} step={1}
                              value={Math.round(current[field])}
                              onChange={(e) => updateDesign({ [field]: clamp(Number(e.target.value), 0, 100) })}
                              className="flex-1 text-xs font-mono text-center rounded-md px-2 py-1.5"
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                color: "#e2e8f0", outline: "none",
                              }} />
                          </div>
                        ))}
                      </div>
                      <button onClick={() => updateDesign({ x: activeZone.x, y: activeZone.y, w: activeZone.w, h: activeZone.h })}
                        className="text-[10px] font-medium" style={{ color: "#818cf8" }}>
                        Reset position
                      </button>
                    </div>
                  )}

                  {/* Attached artwork card */}
                  {current?.artworkUrl && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Attached Artwork
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
                        <div className="w-10 h-10 rounded bg-white shrink-0 flex items-center justify-center overflow-hidden">
                          {current.artworkUrl.startsWith("data:image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={current.artworkUrl} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <div className="text-center">
                              <div className="text-sm">📄</div>
                              <div className="text-[7px] font-bold uppercase" style={{ color: "#666" }}>{current.artworkFileType}</div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium truncate" style={{ color: "#e2e8f0" }}>
                            {current.artworkName ?? "Artwork"}
                          </div>
                          <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                            {activeZone.label}
                          </div>
                        </div>
                        <button onClick={() => updateDesign({ artworkUrl: undefined, artworkName: undefined, artworkFileType: undefined })}
                          className="text-[10px] w-6 h-6 rounded flex items-center justify-center"
                          style={{ color: "#f87171" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(248,113,113,0.1)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── ARTWORK TAB ── */}
              {rightPanel === "artwork" && (
                <>
                  <div className="rounded-xl p-4 text-center cursor-pointer transition-all"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1.5px dashed rgba(255,255,255,0.1)",
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}>
                    <input ref={fileInputRef} type="file" multiple
                      accept="image/*,.dst,.pes,.jef,.exp,.vp3,.hus,.pdf" className="hidden"
                      onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />
                    <div className="text-2xl mb-1">📁</div>
                    <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                      Upload artwork
                    </div>
                    <div className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                      PNG · JPG · SVG · PDF · DST · PES · JEF
                    </div>
                  </div>

                  {uploads.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Files ({uploads.length})
                      </div>
                      {uploads.map((file, i) => {
                        const isAssigned = current?.artworkUrl === file.url;
                        return (
                          <button key={i}
                            onClick={() => updateDesign({ artworkUrl: file.url, artworkName: file.name, artworkFileType: file.ext })}
                            className="w-full flex items-center gap-2.5 p-2 rounded-lg transition-all text-left"
                            style={{
                              background: isAssigned ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                              border: isAssigned ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.04)",
                            }}>
                            <div className="w-9 h-9 rounded bg-white flex items-center justify-center shrink-0 overflow-hidden">
                              {file.isImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={file.url} alt={file.name} className="w-full h-full object-contain" />
                              ) : (
                                <div className="text-center">
                                  <div className="text-xs">📄</div>
                                  <div className="text-[6px] font-bold uppercase" style={{ color: "#666" }}>{file.ext}</div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-medium truncate" style={{ color: "#e2e8f0" }}>
                                {file.name}
                              </div>
                              <div className="text-[8px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                {isAssigned ? "Assigned" : `Click to assign`}
                              </div>
                            </div>
                            {isAssigned && <span className="text-[10px] shrink-0" style={{ color: "#818cf8" }}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-3xl opacity-15 mb-2">🎨</div>
                      <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>No artwork uploaded</div>
                      <div className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.15)" }}>
                        Drag & drop files onto the garment or click above
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── NOTES TAB ── */}
              {rightPanel === "notes" && (
                <>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Design Notes
                    </div>
                    <textarea
                      value={current?.notes ?? ""}
                      onChange={(e) => updateDesign({ notes: e.target.value })}
                      placeholder={`Instructions for ${activeZone.label}...\n\ne.g. "Match PMS 186C red"\n"Scale logo to 8cm wide"`}
                      rows={6}
                      className="w-full resize-y text-sm rounded-lg px-3 py-2.5"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#e2e8f0", outline: "none",
                      }} />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Quick Add
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[
                        "Match PMS colours",
                        "Scale to fit",
                        "Centre aligned",
                        "Left aligned",
                        "White underbase",
                        "Remove background",
                        "Mirror left/right",
                      ].map((q) => (
                        <button key={q}
                          onClick={() => updateDesign({ notes: (current?.notes ? current.notes + "\n" : "") + q })}
                          className="px-2 py-1 rounded-md text-[9px] font-medium transition-colors"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.4)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)";
                            e.currentTarget.style.color = "#c7d2fe";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                            e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                          }}>
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

        {/* ═══ FOOTER ═══ */}
        <div className="flex items-center justify-between px-5 py-2.5 shrink-0"
          style={{ background: "#12122b", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {configuredZones.length === 0 ? (
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                Select a zone, choose a decoration process, and upload artwork
              </span>
            ) : (
              configuredZones.map((d) => (
                <div key={d.placement}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium"
                  style={{ background: "rgba(99,102,241,0.1)", color: "#c7d2fe" }}>
                  <div className="w-1 h-1 rounded-full" style={{ background: "#22c55e" }} />
                  {zones.find((z) => z.key === d.placement)?.label ?? d.placement}
                  {d.decorationMethod && (
                    <span style={{ color: "rgba(255,255,255,0.35)" }}>
                      · {PROCESSES.find((p) => p.key === d.decorationMethod)?.label ?? d.decorationMethod}
                    </span>
                  )}
                  {d.artworkName && <span style={{ color: "rgba(255,255,255,0.25)" }}>📎</span>}
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 shrink-0 ml-3">
            <button onClick={onClose}
              className="text-[12px] font-medium px-4 py-1.5 rounded-lg transition-colors"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.4)",
                background: "transparent",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              Cancel
            </button>
            <button onClick={handleApply}
              className="text-[12px] font-semibold px-5 py-1.5 rounded-lg transition-all"
              style={{
                background: configuredZones.length > 0 ? "#6366f1" : "rgba(99,102,241,0.3)",
                color: configuredZones.length > 0 ? "white" : "rgba(255,255,255,0.4)",
                boxShadow: configuredZones.length > 0 ? "0 2px 12px rgba(99,102,241,0.4)" : "none",
              }}>
              Apply Design{configuredZones.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
