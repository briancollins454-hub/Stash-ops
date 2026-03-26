/* ═══════════════════════════════════════════════════════════
   Decorator System — Core Types
   ═══════════════════════════════════════════════════════════ */

import type { DesignConfig, DesignerProductDetail } from "@/components/quotes/designer-modal";

// Re-export for convenience
export type { DesignConfig, DesignerProductDetail };

/* ── Views ── */

export type ViewKey = "front" | "back" | "left" | "right";

export const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "left", label: "Left Sleeve" },
  { key: "right", label: "Right Sleeve" },
];

/* ── Decoration Methods ── */

export const DECORATION_METHODS = [
  { key: "WEMB", label: "Embroidery",   icon: "🧵", hasStitchCount: true,  requiresVector: false, supportsGradients: false, maxColors: 15,  minDpi: 0 },
  { key: "DTF",  label: "DTF",          icon: "🖨️", hasStitchCount: false, requiresVector: false, supportsGradients: true,  maxColors: 999, minDpi: 200 },
  { key: "DTG",  label: "DTG",          icon: "🎯", hasStitchCount: false, requiresVector: false, supportsGradients: true,  maxColors: 999, minDpi: 150 },
  { key: "TRF",  label: "Transfer",     icon: "♨️", hasStitchCount: false, requiresVector: false, supportsGradients: true,  maxColors: 999, minDpi: 200 },
  { key: "RHS",  label: "Screen Print", icon: "🖼️", hasStitchCount: false, requiresVector: false, supportsGradients: false, maxColors: 8,   minDpi: 300 },
  { key: "SUB",  label: "Sublimation",  icon: "🌈", hasStitchCount: false, requiresVector: false, supportsGradients: true,  maxColors: 999, minDpi: 200 },
  { key: "VNL",  label: "Vinyl/Flex",   icon: "✂️", hasStitchCount: false, requiresVector: true,  supportsGradients: false, maxColors: 3,   minDpi: 0 },
] as const;

export type MethodKey = typeof DECORATION_METHODS[number]["key"];

/* ── Zone Definitions ── */

export interface ZoneDef {
  key: string;
  label: string;
  view: ViewKey;
  x: number; y: number; w: number; h: number;
  actualWidthMm?: number;
  actualHeightMm?: number;
}

export const ZONE_TEMPLATES: Record<string, ZoneDef[]> = {
  tshirt: [
    { key: "left_chest",         label: "Left Chest",    view: "front", x: 42, y: 18, w: 36, h: 32, actualWidthMm: 180, actualHeightMm: 224 },
    { key: "right_chest",        label: "Right Chest",   view: "front", x: 18, y: 18, w: 36, h: 32, actualWidthMm: 180, actualHeightMm: 224 },
    { key: "centre_chest",       label: "Centre Chest",  view: "front", x: 22, y: 20, w: 52, h: 26, actualWidthMm: 260, actualHeightMm: 182 },
    { key: "main_body",          label: "Main Body",     view: "front", x: 16, y: 18, w: 64, h: 48, actualWidthMm: 320, actualHeightMm: 336 },
    { key: "full_back",          label: "Full Back",     view: "back",  x: 18, y: 18, w: 60, h: 48, actualWidthMm: 300, actualHeightMm: 336 },
    { key: "left_sleeve_short",  label: "Left Sleeve",   view: "left",  x: 28, y: 18, w: 30, h: 22, actualWidthMm: 150, actualHeightMm: 154 },
    { key: "right_sleeve_short", label: "Right Sleeve",  view: "right", x: 40, y: 18, w: 30, h: 22, actualWidthMm: 150, actualHeightMm: 154 },
  ],
  hoodie: [
    { key: "left_chest",         label: "Left Chest",    view: "front", x: 42, y: 22, w: 36, h: 32, actualWidthMm: 187, actualHeightMm: 230 },
    { key: "right_chest",        label: "Right Chest",   view: "front", x: 18, y: 22, w: 36, h: 32, actualWidthMm: 187, actualHeightMm: 230 },
    { key: "centre_chest",       label: "Centre Chest",  view: "front", x: 22, y: 24, w: 52, h: 26, actualWidthMm: 270, actualHeightMm: 187 },
    { key: "main_body",          label: "Main Body",     view: "front", x: 16, y: 20, w: 64, h: 48, actualWidthMm: 333, actualHeightMm: 346 },
    { key: "full_back",          label: "Full Back",     view: "back",  x: 18, y: 20, w: 60, h: 48, actualWidthMm: 312, actualHeightMm: 346 },
    { key: "left_sleeve_long",   label: "Left Sleeve",   view: "left",  x: 22, y: 14, w: 34, h: 38, actualWidthMm: 177, actualHeightMm: 274 },
    { key: "right_sleeve_long",  label: "Right Sleeve",  view: "right", x: 42, y: 14, w: 34, h: 38, actualWidthMm: 177, actualHeightMm: 274 },
    { key: "hood",               label: "Hood",          view: "back",  x: 30, y: 2,  w: 36, h: 18, actualWidthMm: 187, actualHeightMm: 130 },
  ],
  polo: [
    { key: "left_chest",         label: "Left Chest",    view: "front", x: 42, y: 18, w: 36, h: 32, actualWidthMm: 180, actualHeightMm: 224 },
    { key: "right_chest",        label: "Right Chest",   view: "front", x: 18, y: 18, w: 36, h: 32, actualWidthMm: 180, actualHeightMm: 224 },
    { key: "main_body",          label: "Main Body",     view: "front", x: 20, y: 22, w: 56, h: 42, actualWidthMm: 280, actualHeightMm: 294 },
    { key: "full_back",          label: "Full Back",     view: "back",  x: 18, y: 18, w: 60, h: 48, actualWidthMm: 300, actualHeightMm: 336 },
    { key: "left_sleeve_short",  label: "Left Sleeve",   view: "left",  x: 28, y: 18, w: 30, h: 22, actualWidthMm: 150, actualHeightMm: 154 },
    { key: "right_sleeve_short", label: "Right Sleeve",  view: "right", x: 40, y: 18, w: 30, h: 22, actualWidthMm: 150, actualHeightMm: 154 },
  ],
  jacket: [
    { key: "left_chest",         label: "Left Chest",    view: "front", x: 42, y: 20, w: 36, h: 32, actualWidthMm: 194, actualHeightMm: 234 },
    { key: "right_chest",        label: "Right Chest",   view: "front", x: 18, y: 20, w: 36, h: 32, actualWidthMm: 194, actualHeightMm: 234 },
    { key: "main_body",          label: "Main Body",     view: "front", x: 20, y: 24, w: 56, h: 42, actualWidthMm: 302, actualHeightMm: 307 },
    { key: "full_back",          label: "Full Back",     view: "back",  x: 18, y: 18, w: 60, h: 48, actualWidthMm: 324, actualHeightMm: 350 },
    { key: "left_sleeve_long",   label: "Left Sleeve",   view: "left",  x: 22, y: 14, w: 34, h: 38, actualWidthMm: 184, actualHeightMm: 277 },
    { key: "right_sleeve_long",  label: "Right Sleeve",  view: "right", x: 42, y: 14, w: 34, h: 38, actualWidthMm: 184, actualHeightMm: 277 },
  ],
  trousers: [
    { key: "left_leg_front",     label: "Left Leg Front",  view: "front", x: 48, y: 30, w: 18, h: 22, actualWidthMm: 72,  actualHeightMm: 198 },
    { key: "right_leg_front",    label: "Right Leg Front", view: "front", x: 30, y: 30, w: 18, h: 22, actualWidthMm: 72,  actualHeightMm: 198 },
    { key: "left_leg_back",      label: "Left Leg Back",   view: "back",  x: 48, y: 30, w: 18, h: 22, actualWidthMm: 72,  actualHeightMm: 198 },
    { key: "backside",           label: "Backside",        view: "back",  x: 24, y: 10, w: 48, h: 26, actualWidthMm: 192, actualHeightMm: 234 },
  ],
  skirt: [
    { key: "front_panel",        label: "Front",           view: "front", x: 22, y: 10, w: 52, h: 45, actualWidthMm: 200, actualHeightMm: 200 },
    { key: "back_panel",         label: "Back",            view: "back",  x: 22, y: 10, w: 52, h: 45, actualWidthMm: 200, actualHeightMm: 200 },
    { key: "left_hip",           label: "Left Hip",        view: "front", x: 58, y: 8,  w: 20, h: 22, actualWidthMm: 80,  actualHeightMm: 100 },
    { key: "right_hip",          label: "Right Hip",       view: "front", x: 18, y: 8,  w: 20, h: 22, actualWidthMm: 80,  actualHeightMm: 100 },
  ],
  headwear: [
    { key: "headwear_front",     label: "Front Panel",  view: "front", x: 20, y: 20, w: 56, h: 40, actualWidthMm: 168, actualHeightMm: 80  },
    { key: "headwear_back",      label: "Back Panel",   view: "back",  x: 20, y: 20, w: 56, h: 40, actualWidthMm: 168, actualHeightMm: 80  },
  ],
  bag: [
    { key: "bag_front",          label: "Front", view: "front", x: 15, y: 20, w: 66, h: 50, actualWidthMm: 264, actualHeightMm: 225 },
    { key: "bag_back",           label: "Back",  view: "back",  x: 15, y: 20, w: 66, h: 50, actualWidthMm: 264, actualHeightMm: 225 },
  ],
};

/* ── Size Presets ── */

export const SIZE_PRESETS = [
  { label: "Left Chest 15×15",     wcm: 15, hcm: 15 },
  { label: "Right Chest 15×15",    wcm: 15, hcm: 15 },
  { label: "Centre Chest 28×20",   wcm: 28, hcm: 20 },
  { label: "Full Front 30×38",     wcm: 30, hcm: 38 },
  { label: "Full Back 33×60",      wcm: 33, hcm: 60 },
  { label: "Sleeve 15×20",         wcm: 15, hcm: 20 },
  { label: "Sponsor Logo 30×20",   wcm: 30, hcm: 20 },
  { label: "Small Badge 4×4",      wcm: 4,  hcm: 4  },
  { label: "Large Badge 10×10",    wcm: 10, hcm: 10 },
  { label: "Hood 20×10",           wcm: 20, hcm: 10 },
  { label: "Pocket 6×6",           wcm: 6,  hcm: 6  },
];

/* ── Garment Reference Dimensions (cm) ── */

export const GARMENT_REF_CM: Record<string, { w: number; h: number }> = {
  tshirt:   { w: 50, h: 70 },
  hoodie:   { w: 52, h: 72 },
  polo:     { w: 50, h: 70 },
  jacket:   { w: 54, h: 73 },
  trousers: { w: 40, h: 90 },
  skirt:    { w: 38, h: 45 },
  headwear: { w: 30, h: 20 },
  bag:      { w: 40, h: 45 },
};

/* ── Design Object (canvas layer) ── */

export interface DesignObject {
  id: string;
  zoneKey: string;
  type: "text" | "image";
  // Position relative to canvas (0-100%)
  x: number; y: number;
  w: number; h: number;
  rotation: number;
  flipH: boolean; flipV: boolean;
  lockAspect: boolean;
  opacity: number;
  locked: boolean;
  // Text-specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  underline?: boolean;
  textAlign?: "left" | "center" | "right";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  lineHeight?: number;
  letterSpacing?: number;
  // Image-specific
  imageUrl?: string;
  imageName?: string;
  imageFileType?: string;
  previewUrl?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  uploadId?: string;
}

/* ── Uploaded File ── */

export interface UploadedFile {
  id: string;
  name: string;
  url: string;            // data URL or blob URL
  isImage: boolean;
  ext: string;
  previewUrl?: string;    // converted preview for non-renderable
  naturalWidth?: number;
  naturalHeight?: number;
}

/* ── Undo action ── */

export interface HistoryEntry {
  objects: DesignObject[];
  zoneConfigs: Record<string, ZoneConfig>;
}

/* ── Per-zone decoration config ── */

export interface ZoneConfig {
  decorationMethod: string;
  stitchCount?: number;
  colorCount?: number;
  threadColors?: string;
  dimensionWcm?: number;
  dimensionHcm?: number;
  notes?: string;
}

/* ── Garment type detection ── */

export function detectGarmentType(category?: string, productName?: string): string {
  const text = `${category ?? ""} ${productName ?? ""}`.toLowerCase();
  if (/hoodie|hooded|sweat|fleece|pullover/.test(text)) return "hoodie";
  if (/polo/.test(text)) return "polo";
  if (/jacket|coat|softshell|gilet|bodywarmer/.test(text)) return "jacket";
  if (/skort|skirt/.test(text)) return "skirt";
  if (/trouser|jogger|legging/.test(text)) return "trousers";
  if (/\bshorts\b/.test(text) && !/short\s*sleeve/.test(text)) return "trousers";
  if (/\bcap\b|\bhat\b|beanie|headwear|bucket/.test(text)) return "headwear";
  if (/bag|tote|backpack|rucksack|holdall|duffel/.test(text)) return "bag";
  return "tshirt";
}

/* ── Helpers ── */

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return `rgba(148,163,184,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(148,163,184,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const MIN_SIZE_PCT = 4;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
export const VECTOR_EXTENSIONS = new Set(["eps", "ai", "pdf", "cdr"]);
export const EMBROIDERY_EXTENSIONS = new Set(["dst", "pes", "jef", "exp", "vp3", "hus", "emb"]);
