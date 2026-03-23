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
   VIEW / ZONE SYSTEM — mirrors DecoNetwork decorator
   ═══════════════════════════════════════════════════════════ */

type ViewKey = "front" | "back" | "left" | "right";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
];

/** Decoration process codes — matches DecoNetwork exactly */
const PROCESSES = [
  { key: "WEMB", label: "Embroidery", desc: "Thread stitched into garment", hasStitchCount: true },
  { key: "DTF",  label: "DTF",        desc: "Direct-to-Film transfer",      hasStitchCount: false },
  { key: "DTG",  label: "DTG",        desc: "Direct-to-Garment inkjet",     hasStitchCount: false },
  { key: "TRF",  label: "Transfer",   desc: "Heat transfer vinyl/print",    hasStitchCount: false },
  { key: "RHS",  label: "Screen Print",desc: "Ink pushed through mesh",     hasStitchCount: false },
  { key: "SUB",  label: "Sublimation", desc: "Dye infused via heat",        hasStitchCount: false },
] as const;

/** A zone = a named decoration area on a specific view.
 *  x/y/w/h as % of the garment bounding box.
 *  These match DecoNetwork's zone names from real order data. */
interface ZoneDef {
  key: string;
  label: string;
  view: ViewKey;
  x: number; y: number; w: number; h: number;
}

/** Zone templates per garment category */
const ZONE_TEMPLATES: Record<string, ZoneDef[]> = {
  tshirt: [
    { key: "left_chest",        label: "Left Chest",         view: "front", x: 50, y: 26, w: 18, h: 16 },
    { key: "right_chest",       label: "Right Chest",        view: "front", x: 28, y: 26, w: 18, h: 16 },
    { key: "centre_chest",      label: "Centre Chest",       view: "front", x: 28, y: 24, w: 40, h: 20 },
    { key: "main_body",         label: "Main Body",          view: "front", x: 20, y: 22, w: 56, h: 42 },
    { key: "full_back",         label: "Full Back",          view: "back",  x: 18, y: 18, w: 60, h: 48 },
    { key: "left_sleeve_short", label: "Left Sleeve (Short)",  view: "left",  x: 28, y: 18, w: 30, h: 22 },
    { key: "right_sleeve_short",label: "Right Sleeve (Short)", view: "right", x: 40, y: 18, w: 30, h: 22 },
    { key: "collar",            label: "Collar",             view: "front", x: 32, y: 6,  w: 32, h: 10 },
  ],
  hoodie: [
    { key: "left_chest",        label: "Left Chest",         view: "front", x: 50, y: 30, w: 18, h: 16 },
    { key: "right_chest",       label: "Right Chest",        view: "front", x: 28, y: 30, w: 18, h: 16 },
    { key: "centre_chest",      label: "Centre Chest",       view: "front", x: 28, y: 28, w: 40, h: 20 },
    { key: "main_body",         label: "Main Body",          view: "front", x: 20, y: 24, w: 56, h: 42 },
    { key: "full_back",         label: "Full Back",          view: "back",  x: 18, y: 20, w: 60, h: 48 },
    { key: "left_sleeve_long",  label: "Left Sleeve (Long)",   view: "left",  x: 22, y: 14, w: 34, h: 38 },
    { key: "right_sleeve_long", label: "Right Sleeve (Long)",  view: "right", x: 42, y: 14, w: 34, h: 38 },
    { key: "hood",              label: "Hood",               view: "back",  x: 30, y: 2,  w: 36, h: 18 },
  ],
  polo: [
    { key: "left_chest",        label: "Left Chest",         view: "front", x: 50, y: 26, w: 18, h: 16 },
    { key: "right_chest",       label: "Right Chest",        view: "front", x: 28, y: 26, w: 18, h: 16 },
    { key: "main_body",         label: "Main Body",          view: "front", x: 20, y: 22, w: 56, h: 42 },
    { key: "full_back",         label: "Full Back",          view: "back",  x: 18, y: 18, w: 60, h: 48 },
    { key: "left_sleeve_short", label: "Left Sleeve (Short)",  view: "left",  x: 28, y: 18, w: 30, h: 22 },
    { key: "right_sleeve_short",label: "Right Sleeve (Short)", view: "right", x: 40, y: 18, w: 30, h: 22 },
    { key: "collar_tip_left",   label: "Collar Tip: Left",  view: "front", x: 45, y: 8,  w: 15, h: 10 },
    { key: "collar_tip_right",  label: "Collar Tip: Right", view: "front", x: 36, y: 8,  w: 15, h: 10 },
  ],
  jacket: [
    { key: "left_chest",        label: "Left Chest",         view: "front", x: 50, y: 28, w: 18, h: 16 },
    { key: "right_chest",       label: "Right Chest",        view: "front", x: 28, y: 28, w: 18, h: 16 },
    { key: "main_body",         label: "Main Body",          view: "front", x: 20, y: 24, w: 56, h: 42 },
    { key: "full_back",         label: "Full Back",          view: "back",  x: 18, y: 18, w: 60, h: 48 },
    { key: "left_sleeve_long",  label: "Left Sleeve (Long)",   view: "left",  x: 22, y: 14, w: 34, h: 38 },
    { key: "right_sleeve_long", label: "Right Sleeve (Long)",  view: "right", x: 42, y: 14, w: 34, h: 38 },
  ],
  trousers: [
    { key: "left_leg_front",    label: "Left Leg Logo Front",   view: "front", x: 48, y: 30, w: 18, h: 22 },
    { key: "right_leg_front",   label: "Right Leg Logo Front",  view: "front", x: 30, y: 30, w: 18, h: 22 },
    { key: "left_leg_back",     label: "Left Leg (Short) Back", view: "back",  x: 48, y: 30, w: 18, h: 22 },
    { key: "backside",          label: "Backside",           view: "back",  x: 24, y: 10, w: 48, h: 26 },
  ],
  headwear: [
    { key: "headwear_front",    label: "Headwear Front",     view: "front", x: 20, y: 20, w: 56, h: 40 },
    { key: "headwear_back",     label: "Headwear Back",      view: "back",  x: 20, y: 20, w: 56, h: 40 },
  ],
  bag: [
    { key: "bag_front",         label: "Bag Front",          view: "front", x: 15, y: 20, w: 66, h: 50 },
    { key: "bag_back",          label: "Bag Back",           view: "back",  x: 15, y: 20, w: 66, h: 50 },
  ],
};

/** Fallback for unknown category */
const DEFAULT_ZONES: ZoneDef[] = ZONE_TEMPLATES.tshirt;

/* ═══════════════════════════════════════════════════════════
   SVG GARMENT SILHOUETTES — colour-tinted outlines per view
   ═══════════════════════════════════════════════════════════ */

function GarmentSVG({ view, garmentType, garmentColor, className, style }: {
  view: ViewKey; garmentType: string; garmentColor?: string; className?: string; style?: CSSProperties;
}) {
  const tint = garmentColor ?? "rgba(148,163,184,0.35)";
  const colour = garmentColor ? hexToRgba(tint, 0.25) : "rgba(148,163,184,0.2)";
  const stroke = garmentColor ? hexToRgba(tint, 0.5) : "rgba(148,163,184,0.35)";
  const sw = 1.5;
  const gt = garmentType;

  if (gt === "headwear") {
    return (
      <svg viewBox="0 0 200 200" fill="none" className={className} style={style}>
        <ellipse cx="100" cy="110" rx="65" ry="50" fill={colour} stroke={stroke} strokeWidth={sw} />
        <path d="M40 120 Q40 145 100 150 Q160 145 160 120" fill={colour} stroke={stroke} strokeWidth={sw} />
        <rect x="30" y="120" width="140" height="12" rx="3" fill={colour} stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }

  if (gt === "bag") {
    return (
      <svg viewBox="0 0 200 260" fill="none" className={className} style={style}>
        <rect x="30" y="50" width="140" height="170" rx="6" fill={colour} stroke={stroke} strokeWidth={sw} />
        <path d="M60 50 Q60 20 100 20 Q140 20 140 50" fill="none" stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }

  if (gt === "trousers") {
    if (view === "front" || view === "back") {
      return (
        <svg viewBox="0 0 200 280" fill="none" className={className} style={style}>
          <path d={`M50 20 L40 20 Q30 20 30 30 L30 50 L28 280 L90 280 L100 120 L110 280 L172 280 L170 50 L170 30 Q170 20 160 20 L150 20`}
            fill={colour} stroke={stroke} strokeWidth={sw} />
          {view === "front" && <line x1="100" y1="50" x2="100" y2="120" stroke={stroke} strokeWidth={0.8} strokeDasharray="4 3" />}
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 200 280" fill="none" className={className} style={style}>
        <path d="M60 20 L50 30 L46 280 L95 280 L100 100 L105 280 L154 280 L150 30 L140 20 Z"
          fill={colour} stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }

  /* ── T-shirt / polo / hoodie / jacket (upper garment) ── */
  if (view === "front") {
    return (
      <svg viewBox="0 0 200 250" fill="none" className={className} style={style}>
        {/* Body */}
        <path d="M62 30 L42 45 L20 40 L8 70 L40 80 L42 65 L42 240 L158 240 L158 65 L160 80 L192 70 L180 40 L158 45 L138 30"
          fill={colour} stroke={stroke} strokeWidth={sw} />
        {/* Neckline */}
        <path d={gt === "polo"
          ? "M62 30 Q65 18 80 12 L82 28 L100 35 L118 28 L120 12 Q135 18 138 30"
          : gt === "hoodie"
            ? "M62 30 Q80 10 100 8 Q120 10 138 30 L122 45 Q100 50 78 45 Z"
            : "M62 30 Q80 10 100 8 Q120 10 138 30"}
          fill={gt === "hoodie" ? colour : "none"} stroke={stroke} strokeWidth={sw} />
        {/* Centre line */}
        {(gt === "hoodie" || gt === "jacket") && (
          <line x1="100" y1="35" x2="100" y2="240" stroke={stroke} strokeWidth={0.8} strokeDasharray="4 3" />
        )}
        {gt === "polo" && (
          <line x1="100" y1="28" x2="100" y2="50" stroke={stroke} strokeWidth={0.8} />
        )}
      </svg>
    );
  }

  if (view === "back") {
    return (
      <svg viewBox="0 0 200 250" fill="none" className={className} style={style}>
        <path d="M62 30 L42 45 L20 40 L8 70 L40 80 L42 65 L42 240 L158 240 L158 65 L160 80 L192 70 L180 40 L158 45 L138 30"
          fill={colour} stroke={stroke} strokeWidth={sw} />
        {/* Back neckline — higher, simpler */}
        <path d="M62 30 Q80 22 100 20 Q120 22 138 30"
          fill="none" stroke={stroke} strokeWidth={sw} />
        {gt === "hoodie" && (
          <path d="M62 30 Q68 8 100 4 Q132 8 138 30 L130 30 Q100 15 70 30 Z"
            fill={colour} stroke={stroke} strokeWidth={sw} />
        )}
      </svg>
    );
  }

  /* Left / Right side views */
  const flip = view === "right";
  return (
    <svg viewBox="0 0 200 250" fill="none" className={className}
      style={{ ...style, transform: flip ? "scaleX(-1)" : undefined }}>
      {/* Side body */}
      <path d="M70 30 L30 50 L12 70 L30 78 L55 65 L55 240 L130 240 L130 65 L135 55 L125 40 L110 30"
        fill={colour} stroke={stroke} strokeWidth={sw} />
      {/* Side neckline */}
      <path d="M70 30 Q80 14 90 12 Q100 14 110 30"
        fill="none" stroke={stroke} strokeWidth={sw} />
      {/* Sleeve seam */}
      <line x1="55" y1="65" x2="130" y2="65" stroke={stroke} strokeWidth={0.6} strokeDasharray="3 3" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

type UploadedFile = { name: string; url: string; isImage: boolean; ext: string };

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_SIZE_PCT = 4;

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/** Convert hex (#rrggbb) to rgba string */
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
  return map[n] ?? "var(--text-tertiary)";
}

/** Guess garment type from category / product name */
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
  /* ── garment & zone detection ── */
  const garmentType = useMemo(() => detectGarmentType(productDetail.category, productDetail.productName), [productDetail]);
  const zones = useMemo(() => ZONE_TEMPLATES[garmentType] ?? DEFAULT_ZONES, [garmentType]);

  /* ── state ── */
  const [activeView, setActiveView] = useState<ViewKey>("front");
  const [prevView, setPrevView] = useState<ViewKey>("front");
  const [isRotating, setIsRotating] = useState(false);
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
  type RTab = "design" | "artwork" | "notes";
  const [rightTab, setRightTab] = useState<RTab>("design");

  /* drag / resize state */
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: "move" | "resize";
    startX: number; startY: number;
    origX: number; origY: number; origW: number; origH: number;
    resizeCorner: string;
  } | null>(null);

  /* ── effects ── */
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  // Switch view when zone changes
  useEffect(() => {
    const z = zones.find((z) => z.key === activeZoneKey);
    if (z && z.view !== activeView) switchView(z.view);
  }, [activeZoneKey, zones]);

  /** Switch view with 3D rotation animation */
  const switchView = useCallback((to: ViewKey) => {
    if (to === activeView || isRotating) return;
    setPrevView(activeView);
    setIsRotating(true);
    // Mid-rotation swap (300ms = halfway through 600ms animation)
    setTimeout(() => setActiveView(to), 300);
    setTimeout(() => setIsRotating(false), 600);
  }, [activeView, isRotating]);

  /* ── derived ── */
  const activeZone = zones.find((z) => z.key === activeZoneKey)!;
  const current = designs[activeZoneKey];
  const visibleZones = useMemo(() => zones.filter((z) => z.view === activeView), [zones, activeView]);

  /** Rotation degrees for 3D animation per view */
  const viewRotation: Record<ViewKey, number> = useMemo(() => ({
    front: 0, right: 90, back: 180, left: 270,
  }), []);

  /** Get the Y-rotation angle for the 3D transition */
  const rotationAngle = useMemo(() => {
    if (!isRotating) return viewRotation[activeView];
    // First half: rotate away from prevView
    return viewRotation[prevView] + 90;
  }, [isRotating, activeView, prevView, viewRotation]);

  /** CSS color for the selected garment color (for SVG tinting) */
  const activeColorCss = useMemo(() => {
    const selColor = productDetail.colors.find((c) => c.id === activeColorId);
    return selColor ? colorToCss(selColor.name) : undefined;
  }, [productDetail.colors, activeColorId]);

  /** Find best image for the current view and selected color */
  const displayImage = useMemo(() => {
    const imgs = productDetail.images ?? [];
    const selColor = productDetail.colors.find((c) => c.id === activeColorId);
    const viewToType: Record<ViewKey, string> = { front: "front", back: "back", left: "side", right: "side" };
    const imgType = viewToType[activeView];

    // Try exact match: correct type + correct color
    if (selColor) {
      const exact = imgs.find((i) => i.type === imgType && i.color?.toLowerCase() === selColor.name.toLowerCase());
      if (exact) return exact.url;
    }

    // Try type match without color
    const typeMatch = imgs.find((i) => i.type === imgType);
    if (typeMatch) return typeMatch.url;

    // For front view, fall back to any front image or gallery
    if (activeView === "front") {
      if (selColor) {
        const cm = imgs.find((i) => i.type === "front" && i.color?.toLowerCase() === selColor.name.toLowerCase());
        if (cm) return cm.url;
      }
      return imgs.find((i) => i.type === "front")?.url ?? imgs.find((i) => i.type === "gallery")?.url ?? null;
    }

    // For non-front views, no fallback — show SVG only
    return null;
  }, [productDetail, activeColorId, activeView]);

  const colorImages = useMemo(
    () => (productDetail.images ?? []).filter((i) => i.type === "front" && i.color),
    [productDetail.images],
  );

  const configuredZones = useMemo(
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
        const zone = zones.find((z) => z.key === activeZoneKey)!;
        setDesigns((prev) => ({
          ...prev,
          [activeZoneKey]: {
            ...prev[activeZoneKey],
            placement: activeZoneKey,
            decorationMethod: prev[activeZoneKey]?.decorationMethod || (isImage ? "" : "WEMB"),
            artworkUrl: dataUrl,
            artworkName: file.name,
            artworkFileType: ext,
            x: prev[activeZoneKey]?.x ?? zone.x,
            y: prev[activeZoneKey]?.y ?? zone.y,
            w: prev[activeZoneKey]?.w ?? zone.w,
            h: prev[activeZoneKey]?.h ?? zone.h,
          },
        }));
        setRightTab("artwork");
      };
      reader.readAsDataURL(file);
    });
  }, [activeZoneKey, zones]);

  /* ── design mutations ── */
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

  /* ── pointer handlers for drag/resize ── */
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
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(14px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex flex-col w-full max-w-[1520px] h-[95vh] mx-4 rounded-2xl border overflow-hidden"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.18)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
              <span className="text-lg">🎨</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                Decoration Studio — {productDetail.productName}
              </h2>
              <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                {productDetail.productCode} · {productDetail.supplier}
                {productDetail.brand ? ` / ${productDetail.brand}` : ""}
                {" · "}
                <span className="capitalize">{garmentType}</span> template
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {configuredZones.length > 0 && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                style={{ background: "var(--accent-soft)", color: "var(--accent-light)" }}>
                {configuredZones.length} area{configuredZones.length !== 1 ? "s" : ""} configured
              </span>
            )}
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ color: "var(--text-tertiary)" }}>✕</button>
          </div>
        </div>

        {/* ═══ BODY — 3 columns ═══ */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ─── COL 1: Zone list ─── */}
          <div className="w-56 shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.08)" }}>
            <div className="px-3 pt-3 pb-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                Decoration Areas
              </div>
            </div>

            {/* Group zones by view */}
            <div className="flex-1 overflow-auto px-2 pb-2">
              {VIEWS.map((v) => {
                const vZones = zones.filter((z) => z.view === v.key);
                if (vZones.length === 0) return null;
                return (
                  <div key={v.key} className="mb-1.5">
                    <div className="text-[9px] font-bold uppercase tracking-widest px-2 py-1.5 mt-1"
                      style={{ color: "var(--text-tertiary)" }}>
                      {v.label} View
                    </div>
                    {vZones.map((z) => {
                      const d = designs[z.key];
                      const isActive = activeZoneKey === z.key;
                      const has = !!(d?.decorationMethod || d?.artworkUrl);
                      return (
                        <button key={z.key}
                          onClick={() => { setActiveZoneKey(z.key); setRightTab("design"); }}
                          className="w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2"
                          style={{
                            background: isActive ? "var(--accent-soft)" : "transparent",
                            borderLeft: isActive ? "3px solid var(--accent)" : "3px solid transparent",
                          }}>
                          <div className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              background: has ? "var(--success)" : isActive ? "var(--accent)" : "rgba(255,255,255,0.1)",
                              boxShadow: has ? "0 0 6px var(--success)" : "none",
                            }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium truncate"
                              style={{ color: isActive ? "var(--accent-light)" : "var(--text-primary)" }}>
                              {z.label}
                            </div>
                            {has && (
                              <div className="text-[9px] truncate" style={{ color: "var(--text-tertiary)" }}>
                                {PROCESSES.find((p) => p.key === d?.decorationMethod)?.label ?? d?.decorationMethod ?? ""}
                                {d?.artworkName ? ` · ${d.artworkName}` : ""}
                              </div>
                            )}
                          </div>
                          {has && <span className="text-[9px] shrink-0" style={{ color: "var(--success)" }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {configuredZones.length === 0 ? "No areas configured" : `${configuredZones.length} / ${zones.length} configured`}
              </div>
            </div>
          </div>

          {/* ─── COL 2: Garment canvas ─── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
            {/* View tabs */}
            <div className="flex items-center justify-center gap-1.5 px-4 pt-3 pb-1">
              {VIEWS.map((v) => {
                const hasZones = zones.some((z) => z.view === v.key);
                if (!hasZones) return null;
                const isAct = activeView === v.key;
                const hasConf = Object.values(designs).some((d) => {
                  const z = zones.find((zn) => zn.key === d.placement);
                  return z?.view === v.key && (d.decorationMethod || d.artworkUrl);
                });
                return (
                  <button key={v.key} onClick={() => switchView(v.key)}
                    className="relative px-6 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: isAct ? "var(--accent)" : "rgba(255,255,255,0.06)",
                      color: isAct ? "white" : "var(--text-tertiary)",
                      boxShadow: isAct ? "0 2px 10px rgba(99,102,241,0.45)" : "none",
                    }}>
                    {v.label}
                    {hasConf && !isAct && (
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                        style={{ background: "var(--success)", boxShadow: "0 0 4px var(--success)" }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Canvas */}
            <div className="flex-1 flex items-center justify-center p-4"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
            >
              <div
                ref={canvasRef}
                className="relative select-none"
                style={{
                  width: "100%", maxWidth: 460, aspectRatio: "1 / 1.15",
                  perspective: "1200px",
                }}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
                onPointerLeave={onCanvasPointerUp}
              >
                {/* 3D rotating container */}
                <div
                  className="absolute inset-0"
                  style={{
                    transformStyle: "preserve-3d",
                    transform: `rotateY(${isRotating ? (viewRotation[prevView] < viewRotation[activeView] ? "90deg" : "-90deg") : "0deg"})`,
                    transition: isRotating ? "transform 0.3s ease-in-out" : "transform 0.3s ease-in-out",
                    backfaceVisibility: "hidden",
                  }}
                >
                  {/* Garment silhouette — always visible, colour-tinted */}
                  <GarmentSVG
                    view={activeView}
                    garmentType={garmentType}
                    garmentColor={activeColorCss}
                    className="absolute inset-0 w-full h-full"
                    style={{ zIndex: 0, opacity: displayImage ? 0.3 : 1 }}
                  />

                  {/* Real product image — for any view that has one */}
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

                {/* Decoration zone rectangles */}
                {visibleZones.map((zone) => {
                  const d = designs[zone.key];
                  const isAct = activeZoneKey === zone.key;
                  const has = !!(d?.decorationMethod || d?.artworkUrl);
                  return (
                    <div key={zone.key}
                      onClick={() => { setActiveZoneKey(zone.key); setRightTab("design"); }}
                      className="absolute cursor-pointer transition-all group"
                      style={{
                        left: `${zone.x}%`, top: `${zone.y}%`,
                        width: `${zone.w}%`, height: `${zone.h}%`,
                        border: isAct
                          ? "2.5px solid rgba(99,102,241,0.95)"
                          : has
                            ? "2px solid rgba(34,197,94,0.7)"
                            : "2px dashed rgba(99,102,241,0.3)",
                        borderRadius: 6,
                        background: isAct
                          ? "rgba(99,102,241,0.1)"
                          : has
                            ? "rgba(34,197,94,0.06)"
                            : "rgba(99,102,241,0.04)",
                        zIndex: isAct ? 5 : has ? 3 : 2,
                      }}
                    >
                      {/* Zone label badge */}
                      <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[8px] font-bold whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity"
                        style={{
                          background: isAct ? "rgba(99,102,241,0.95)" : has ? "rgba(34,197,94,0.85)" : "rgba(99,102,241,0.55)",
                          color: "white",
                        }}>
                        {zone.label}
                        {has && d?.decorationMethod && (
                          <span className="ml-1 opacity-80">
                            · {PROCESSES.find((p) => p.key === d.decorationMethod)?.label ?? d.decorationMethod}
                          </span>
                        )}
                      </div>

                      {/* Dotted crosshair inside zone */}
                      {isAct && !d?.artworkUrl && (
                        <>
                          <div className="absolute left-1/2 top-2 bottom-2 w-px" style={{ background: "rgba(99,102,241,0.3)", borderRight: "1px dashed rgba(99,102,241,0.2)" }} />
                          <div className="absolute top-1/2 left-2 right-2 h-px" style={{ background: "rgba(99,102,241,0.3)", borderBottom: "1px dashed rgba(99,102,241,0.2)" }} />
                        </>
                      )}
                    </div>
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
                      style={{ filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.5))" }}
                      draggable={false} />

                    {/* Selection border */}
                    <div className="absolute inset-0 border-2 rounded"
                      style={{ borderColor: "rgba(99,102,241,0.9)", pointerEvents: "none" }} />

                    {/* 4 corner handles */}
                    {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                      <div key={corner}
                        className="absolute w-3.5 h-3.5 rounded-sm"
                        style={{
                          background: "var(--accent)", border: "2px solid white",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                          cursor: corner === "tl" || corner === "br" ? "nwse-resize" : "nesw-resize",
                          ...(corner.includes("t") ? { top: -6 } : { bottom: -6 }),
                          ...(corner.includes("l") ? { left: -6 } : { right: -6 }),
                        }}
                        onPointerDown={(e) => onArtworkPointerDown(e, "resize", corner)} />
                    ))}

                    {/* 4 edge handles */}
                    {([
                      { edge: "t", style: { top: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } as CSSProperties },
                      { edge: "b", style: { bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" } as CSSProperties },
                      { edge: "l", style: { left: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } as CSSProperties },
                      { edge: "r", style: { right: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" } as CSSProperties },
                    ]).map(({ edge, style }) => (
                      <div key={edge}
                        className="absolute w-2.5 h-2.5 rounded-full"
                        style={{ background: "var(--accent)", border: "2px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", ...style }}
                        onPointerDown={(e) => onArtworkPointerDown(e, "resize", edge)} />
                    ))}

                    {/* Size label */}
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold whitespace-nowrap"
                      style={{ background: "rgba(0,0,0,0.75)", color: "white" }}>
                      {current.w.toFixed(0)}% × {current.h.toFixed(0)}%
                    </div>
                  </div>
                )}

                {/* Non-image file indicator (DST, PES etc.) */}
                {current?.artworkUrl && !current.artworkUrl.startsWith("data:image/") && activeZone.view === activeView && (
                  <div className="absolute z-10 flex flex-col items-center justify-center rounded-lg border-2 border-dashed"
                    style={{
                      left: `${current.x}%`, top: `${current.y}%`,
                      width: `${current.w}%`, height: `${current.h}%`,
                      borderColor: "var(--accent)",
                      background: "rgba(99,102,241,0.12)",
                    }}>
                    <div className="text-2xl mb-1">📄</div>
                    <div className="text-[9px] font-bold uppercase" style={{ color: "var(--accent-light)" }}>
                      {current.artworkFileType ?? "FILE"}
                    </div>
                    <div className="text-[8px] truncate px-2 max-w-full" style={{ color: "var(--text-tertiary)" }}>
                      {current.artworkName}
                    </div>
                  </div>
                )}

                {/* Drop overlay */}
                {dragOver && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20 rounded-2xl"
                    style={{ background: "rgba(99,102,241,0.2)", border: "3px dashed var(--accent)" }}>
                    <span className="text-5xl mb-2">📥</span>
                    <div className="text-sm font-semibold" style={{ color: "var(--accent-light)" }}>
                      Drop artwork for {activeZone.label}
                    </div>
                  </div>
                )}

                </div>{/* close 3D rotating container */}
              </div>
            </div>

            {/* Colour bar + image strip */}
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
                          <div className="px-1.5 py-0.5 rounded text-[8px] font-medium whitespace-nowrap"
                            style={{ background: "rgba(0,0,0,0.85)", color: "white" }}>{c.name}</div>
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
            {colorImages.length > 1 && (
              <div className="px-4 pb-3">
                <div className="flex gap-1.5 overflow-x-auto justify-center">
                  {colorImages.slice(0, 14).map((img, i) => {
                    const isA = displayImage === img.url;
                    return (
                      <button key={i} onClick={() => {
                        const m = productDetail.colors.find((c) => c.name.toLowerCase() === img.color?.toLowerCase());
                        if (m) setActiveColorId(m.id);
                        switchView("front");
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
              {([
                { key: "design" as RTab, label: "Design" },
                { key: "artwork" as RTab, label: "Artwork" },
                { key: "notes" as RTab, label: "Notes" },
              ]).map((t) => (
                <button key={t.key} onClick={() => setRightTab(t.key)}
                  className="flex-1 py-2.5 text-xs font-semibold transition-colors relative"
                  style={{ color: rightTab === t.key ? "var(--accent-light)" : "var(--text-tertiary)" }}>
                  {t.label}
                  {rightTab === t.key && (
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
                      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{activeZone.label}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                        {VIEWS.find((v) => v.key === activeZone.view)?.label} view · {garmentType}
                      </div>
                    </div>
                    {current && (current.decorationMethod || current.artworkUrl) && (
                      <button onClick={clearDesign}
                        className="text-[10px] px-2 py-1 rounded hover:bg-white/5" style={{ color: "var(--danger)" }}>
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Process / decoration method */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                      Decoration Process
                    </div>
                    <div className="space-y-1">
                      {PROCESSES.map((proc) => {
                        const isA = current?.decorationMethod === proc.key;
                        return (
                          <button key={proc.key}
                            onClick={() => updateDesign({ decorationMethod: proc.key })}
                            className="w-full text-left px-3 py-2 rounded-lg border transition-all flex items-center justify-between"
                            style={{
                              borderColor: isA ? "var(--accent)" : "var(--border)",
                              background: isA ? "var(--accent-soft)" : "transparent",
                            }}>
                            <div>
                              <div className="text-xs font-medium" style={{ color: isA ? "var(--accent-light)" : "var(--text-primary)" }}>
                                {proc.label}
                              </div>
                              <div className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>{proc.desc}</div>
                            </div>
                            {isA && (
                              <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                style={{ background: "var(--accent)" }}>
                                <span className="text-[10px] text-white">✓</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stitch count — embroidery only */}
                  {current?.decorationMethod === "WEMB" && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                        Stitch Count
                      </div>
                      <input type="number" min={0} step={100}
                        value={current.stitchCount ?? ""}
                        onChange={(e) => updateDesign({ stitchCount: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="e.g. 7500"
                        className="input w-full text-sm font-mono"
                        style={{ padding: "6px 10px" }} />
                      <div className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                        Stitch count affects pricing and production time
                      </div>
                    </div>
                  )}

                  {/* Position & size */}
                  {current?.artworkUrl && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                        Position & Size
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { label: "X Position", field: "x" as const },
                          { label: "Y Position", field: "y" as const },
                          { label: "Width", field: "w" as const },
                          { label: "Height", field: "h" as const },
                        ]).map(({ label, field }) => (
                          <div key={field} className="space-y-1">
                            <label className="text-[9px] font-medium" style={{ color: "var(--text-tertiary)" }}>{label} (%)</label>
                            <input type="number" min={0} max={100} step={1}
                              value={Math.round(current[field])}
                              onChange={(e) => updateDesign({ [field]: clamp(Number(e.target.value), 0, 100) })}
                              className="input w-full text-xs font-mono text-center"
                              style={{ padding: "4px 6px" }} />
                          </div>
                        ))}
                      </div>
                      <button onClick={() => {
                        updateDesign({ x: activeZone.x, y: activeZone.y, w: activeZone.w, h: activeZone.h });
                      }} className="text-[10px] font-medium hover:underline" style={{ color: "var(--accent-light)" }}>
                        Reset to default position
                      </button>
                    </div>
                  )}

                  {/* Attached artwork summary */}
                  {current?.artworkUrl && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                        Attached Artwork
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl border"
                        style={{ borderColor: "rgba(99,102,241,0.3)", background: "var(--accent-soft)" }}>
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0 flex items-center justify-center">
                          {current.artworkUrl.startsWith("data:image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={current.artworkUrl} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <div className="text-center">
                              <div className="text-lg">📄</div>
                              <div className="text-[7px] font-bold uppercase" style={{ color: "#666" }}>
                                {current.artworkFileType ?? "FILE"}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {current.artworkName ?? "Artwork"}
                          </div>
                          <div className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                            Assigned to {activeZone.label}
                          </div>
                        </div>
                        <button
                          onClick={() => updateDesign({ artworkUrl: undefined, artworkName: undefined, artworkFileType: undefined })}
                          className="text-[10px] px-1.5 py-1 rounded hover:bg-white/5"
                          style={{ color: "var(--danger)" }}>✕</button>
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
                    <input ref={fileInputRef} type="file" multiple
                      accept="image/*,.dst,.pes,.jef,.exp,.vp3,.hus,.pdf" className="hidden"
                      onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />
                    <div className="text-3xl mb-1.5">📁</div>
                    <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      Click to upload artwork
                    </div>
                    <div className="text-[9px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                      PNG · JPG · SVG · PDF · DST · PES · JEF — Max 10MB
                    </div>
                    <div className="text-[9px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      Or drag & drop onto the garment preview
                    </div>
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
                            <button key={i}
                              onClick={() => updateDesign({
                                artworkUrl: file.url, artworkName: file.name, artworkFileType: file.ext,
                              })}
                              className="w-full flex items-center gap-2.5 p-2 rounded-lg border transition-all hover:bg-white/5 text-left"
                              style={{
                                borderColor: isAssigned ? "var(--accent)" : "var(--border)",
                                background: isAssigned ? "var(--accent-soft)" : "transparent",
                              }}>
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
                                <div className="text-[11px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                                  {file.name}
                                </div>
                                <div className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                                  {isAssigned ? `Assigned to ${activeZone.label}` : `Click to assign to ${activeZone.label}`}
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
                      <div className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                        Upload embroidery files (.dst, .pes) or<br />image artwork (.png, .jpg, .svg)
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── NOTES TAB ── */}
              {rightTab === "notes" && (
                <>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                      Design Notes — {activeZone.label}
                    </div>
                    <textarea
                      value={current?.notes ?? ""}
                      onChange={(e) => updateDesign({ notes: e.target.value })}
                      placeholder={`Special instructions for ${activeZone.label}...\n\ne.g. "Match PMS 186C red"\n"Scale logo to 8cm wide"\n"Position 3cm below collar"`}
                      rows={8}
                      className="input w-full resize-y text-sm" />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                      Quick Notes
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Match PMS colours exactly",
                        "Scale to fit",
                        "Centre aligned",
                        "Left aligned",
                        "White underbase required",
                        "Remove background",
                        "Mirror for left/right",
                      ].map((q) => (
                        <button key={q}
                          onClick={() => updateDesign({ notes: (current?.notes ? current.notes + "\n" : "") + q })}
                          className="px-2 py-1 rounded text-[9px] font-medium hover:bg-white/5 border transition-colors"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
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
        <div className="flex items-center justify-between px-5 py-3 border-t shrink-0"
          style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.12)" }}>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {configuredZones.length === 0 ? (
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Click a zone on the garment, choose a process, and upload artwork
              </span>
            ) : (
              configuredZones.map((d) => (
                <div key={d.placement}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-light)" }}>
                  {zones.find((z) => z.key === d.placement)?.label ?? d.placement}
                  {d.decorationMethod && (
                    <span className="opacity-70">
                      · {PROCESSES.find((p) => p.key === d.decorationMethod)?.label ?? d.decorationMethod}
                    </span>
                  )}
                  {d.artworkName && " 📎"}
                  {d.stitchCount && (
                    <span className="opacity-60 font-mono text-[8px]">{d.stitchCount.toLocaleString()} st</span>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 shrink-0 ml-3">
            <button onClick={onClose}
              className="btn text-sm px-4"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button onClick={handleApply} className="btn btn--primary text-sm px-5">
              Apply Design{configuredZones.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}