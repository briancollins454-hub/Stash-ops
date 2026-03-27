/**
 * ═══════════════════════════════════════════════════════════
 *  Stash Embroidery Engine
 *  Native embroidery digitizing, estimation & production tools
 * ═══════════════════════════════════════════════════════════
 */

import { logger } from "../lib/logger";

/* ── Stitch Types ── */

export type StitchType = "satin" | "tatami" | "fill" | "run" | "motif" | "stem" | "cross" | "chain";

export interface StitchProfile {
  type: StitchType;
  label: string;
  densityRange: { min: number; max: number; default: number }; // stitches per cm
  minWidth: number;   // mm — minimum recommendable width
  maxWidth: number;   // mm — maximum recommendable width
  pullCompensation: number; // percentage to add for fabric pull (0-30)
  underlayRequired: boolean;
  speedFactor: number; // relative to base speed (1.0 = normal)
  threadConsumptionFactor: number; // relative thread usage (1.0 = normal)
  description: string;
}

export const STITCH_PROFILES: Record<StitchType, StitchProfile> = {
  satin: {
    type: "satin",
    label: "Satin Stitch",
    densityRange: { min: 3, max: 8, default: 5 },
    minWidth: 0.5,
    maxWidth: 12,
    pullCompensation: 15,
    underlayRequired: true,
    speedFactor: 0.85,
    threadConsumptionFactor: 1.3,
    description: "Smooth, shiny parallel stitches. Best for lettering, thin shapes, borders.",
  },
  tatami: {
    type: "tatami",
    label: "Tatami / Fill",
    densityRange: { min: 3, max: 6, default: 4.5 },
    minWidth: 3,
    maxWidth: 500,
    pullCompensation: 10,
    underlayRequired: true,
    speedFactor: 1.0,
    threadConsumptionFactor: 1.0,
    description: "Interlocking rows of stitches. Best for large fill areas.",
  },
  fill: {
    type: "fill",
    label: "Complex Fill",
    densityRange: { min: 2.5, max: 6, default: 4 },
    minWidth: 5,
    maxWidth: 500,
    pullCompensation: 12,
    underlayRequired: true,
    speedFactor: 0.9,
    threadConsumptionFactor: 1.1,
    description: "Advanced fill with pattern support. For complex shapes.",
  },
  run: {
    type: "run",
    label: "Run / Outline",
    densityRange: { min: 3, max: 5, default: 4 },
    minWidth: 0.1,
    maxWidth: 1,
    pullCompensation: 0,
    underlayRequired: false,
    speedFactor: 1.2,
    threadConsumptionFactor: 0.3,
    description: "Single-line stitch. For outlines and fine detail.",
  },
  motif: {
    type: "motif",
    label: "Motif Stitch",
    densityRange: { min: 2, max: 5, default: 3 },
    minWidth: 5,
    maxWidth: 500,
    pullCompensation: 8,
    underlayRequired: false,
    speedFactor: 0.8,
    threadConsumptionFactor: 0.9,
    description: "Repeating decorative pattern fills.",
  },
  stem: {
    type: "stem",
    label: "Stem Stitch",
    densityRange: { min: 3, max: 6, default: 4 },
    minWidth: 0.5,
    maxWidth: 3,
    pullCompensation: 5,
    underlayRequired: false,
    speedFactor: 0.9,
    threadConsumptionFactor: 0.6,
    description: "Twisted rope-like line stitch. For organic lines and borders.",
  },
  cross: {
    type: "cross",
    label: "Cross Stitch",
    densityRange: { min: 2, max: 4, default: 3 },
    minWidth: 5,
    maxWidth: 500,
    pullCompensation: 5,
    underlayRequired: false,
    speedFactor: 0.7,
    threadConsumptionFactor: 1.2,
    description: "X-pattern fill simulating hand cross stitch.",
  },
  chain: {
    type: "chain",
    label: "Chain Stitch",
    densityRange: { min: 2, max: 5, default: 3.5 },
    minWidth: 1,
    maxWidth: 8,
    pullCompensation: 8,
    underlayRequired: false,
    speedFactor: 0.75,
    threadConsumptionFactor: 1.4,
    description: "Looped chain-link stitch. Textured, traditional look.",
  },
};

/* ── Underlay Types ── */

export type UnderlayType = "centre_run" | "edge_run" | "zigzag" | "tatami" | "none";

export interface UnderlayProfile {
  type: UnderlayType;
  label: string;
  stitchCountFactor: number; // additional stitch count as factor of main area
  description: string;
}

export const UNDERLAY_PROFILES: Record<UnderlayType, UnderlayProfile> = {
  centre_run: {
    type: "centre_run",
    label: "Centre Run",
    stitchCountFactor: 0.08,
    description: "Single line down the centre. Minimum underlay for satin columns.",
  },
  edge_run: {
    type: "edge_run",
    label: "Edge Run",
    stitchCountFactor: 0.12,
    description: "Runs along both edges. Stabilises satin columns.",
  },
  zigzag: {
    type: "zigzag",
    label: "Zigzag",
    stitchCountFactor: 0.20,
    description: "Zigzag pattern underlay. Good for medium-density fills.",
  },
  tatami: {
    type: "tatami",
    label: "Tatami Underlay",
    stitchCountFactor: 0.30,
    description: "Full fill underlay at lower density. Maximum stability for large fills.",
  },
  none: {
    type: "none",
    label: "No Underlay",
    stitchCountFactor: 0,
    description: "No underlay. Only for run stitches and light fabrics.",
  },
};

/* ── Fabric Compensation Profiles ── */

export interface FabricProfile {
  key: string;
  label: string;
  pullCompensationModifier: number; // multiplier on base pull compensation
  underlayRecommendation: UnderlayType;
  minDensity: number; // minimum stitch density recommended
  description: string;
}

export const FABRIC_PROFILES: Record<string, FabricProfile> = {
  cotton: { key: "cotton", label: "Cotton / Woven", pullCompensationModifier: 1.0, underlayRecommendation: "centre_run", minDensity: 4, description: "Standard woven cotton. Normal settings." },
  polyester: { key: "polyester", label: "Polyester / Synthetic", pullCompensationModifier: 0.8, underlayRecommendation: "edge_run", minDensity: 4.5, description: "Synthetic fabrics. Slightly less pull." },
  fleece: { key: "fleece", label: "Fleece / Sweatshirt", pullCompensationModifier: 1.3, underlayRecommendation: "zigzag", minDensity: 4, description: "Thick fleece. Needs more underlay and compensation." },
  knit: { key: "knit", label: "Knit / Jersey", pullCompensationModifier: 1.5, underlayRecommendation: "zigzag", minDensity: 3.5, description: "Stretchy knits. High pull compensation needed." },
  pique: { key: "pique", label: "Pique / Polo", pullCompensationModifier: 1.2, underlayRecommendation: "edge_run", minDensity: 4, description: "Polo shirt pique fabric. Moderate compensation." },
  nylon: { key: "nylon", label: "Nylon / Ripstop", pullCompensationModifier: 0.7, underlayRecommendation: "centre_run", minDensity: 5, description: "Thin nylon. Dense stitching to prevent gaps." },
  denim: { key: "denim", label: "Denim", pullCompensationModifier: 0.9, underlayRecommendation: "centre_run", minDensity: 4, description: "Dense woven denim. Near-normal settings." },
  leather: { key: "leather", label: "Leather / Faux Leather", pullCompensationModifier: 0.5, underlayRecommendation: "none", minDensity: 5, description: "No pull compensation. Needle holes permanent." },
  towel: { key: "towel", label: "Towelling / Terry", pullCompensationModifier: 1.4, underlayRecommendation: "tatami", minDensity: 3.5, description: "Thick terry cloth. Heavy underlay needed to float above pile." },
  cap: { key: "cap", label: "Cap / Structured", pullCompensationModifier: 0.6, underlayRecommendation: "centre_run", minDensity: 5, description: "Structured caps with buckram. Minimal pull, high density." },
};

/* ── Machine Profiles ── */

export interface MachineProfile {
  key: string;
  label: string;
  maxSpeed: number; // stitches per minute
  maxHeads: number;
  hoopSizes: { name: string; widthMm: number; heightMm: number }[];
  formats: string[]; // supported file formats
  maxJumpLength: number; // mm before requiring trim
  trimCapable: boolean;
  sequinCapable: boolean;
}

export const MACHINE_PROFILES: Record<string, MachineProfile> = {
  tajima: {
    key: "tajima",
    label: "Tajima TMEZ",
    maxSpeed: 1200,
    maxHeads: 15,
    hoopSizes: [
      { name: "Standard", widthMm: 360, heightMm: 500 },
      { name: "Cap", widthMm: 130, heightMm: 60 },
      { name: "Small", widthMm: 200, heightMm: 200 },
      { name: "Jumbo", widthMm: 500, heightMm: 450 },
    ],
    formats: ["dst", "tbf"],
    maxJumpLength: 12,
    trimCapable: true,
    sequinCapable: false,
  },
  barudan: {
    key: "barudan",
    label: "Barudan BEYS",
    maxSpeed: 1100,
    maxHeads: 20,
    hoopSizes: [
      { name: "Standard", widthMm: 300, heightMm: 440 },
      { name: "Cap", widthMm: 120, heightMm: 55 },
      { name: "Large", widthMm: 400, heightMm: 500 },
    ],
    formats: ["dst", "fdr", "u01"],
    maxJumpLength: 12,
    trimCapable: true,
    sequinCapable: false,
  },
  brother: {
    key: "brother",
    label: "Brother PR Series",
    maxSpeed: 1000,
    maxHeads: 6,
    hoopSizes: [
      { name: "Standard", widthMm: 300, heightMm: 200 },
      { name: "Large", widthMm: 360, heightMm: 360 },
      { name: "Cap", widthMm: 130, heightMm: 60 },
      { name: "Border", widthMm: 100, heightMm: 300 },
    ],
    formats: ["pes", "dst"],
    maxJumpLength: 7,
    trimCapable: true,
    sequinCapable: false,
  },
  generic: {
    key: "generic",
    label: "Generic / Other",
    maxSpeed: 1000,
    maxHeads: 1,
    hoopSizes: [
      { name: "Standard", widthMm: 300, heightMm: 200 },
      { name: "Large", widthMm: 400, heightMm: 400 },
    ],
    formats: ["dst"],
    maxJumpLength: 12,
    trimCapable: true,
    sequinCapable: false,
  },
};

/* ═══════════════════════════════════════════════════════════
   Stitch Count Estimator
   ═══════════════════════════════════════════════════════════ */

export interface StitchEstimateInput {
  widthMm: number;
  heightMm: number;
  fillPercentage?: number; // 0-100, how much of the bounding box is filled (default 70)
  stitchType: StitchType;
  density?: number; // stitches per cm (overrides default)
  underlay?: UnderlayType;
  fabricType?: string;
  includeOutline?: boolean;
  outlineWidthMm?: number;
  colourCount?: number;
}

export interface StitchEstimateResult {
  totalStitches: number;
  fillStitches: number;
  underlayStitches: number;
  outlineStitches: number;
  trimCount: number;
  colourChanges: number;
  jumpStitches: number;
  effectiveDensity: number;
  pullCompensation: number;
  warnings: string[];
}

export function estimateStitchCount(input: StitchEstimateInput): StitchEstimateResult {
  const profile = STITCH_PROFILES[input.stitchType];
  const fabric = input.fabricType ? FABRIC_PROFILES[input.fabricType] : FABRIC_PROFILES.cotton;
  const underlay = input.underlay
    ? UNDERLAY_PROFILES[input.underlay]
    : UNDERLAY_PROFILES[profile.underlayRequired ? (fabric?.underlayRecommendation ?? "centre_run") : "none"];

  const warnings: string[] = [];

  // Effective density
  const density = input.density ?? profile.densityRange.default;
  const clampedDensity = Math.max(profile.densityRange.min, Math.min(profile.densityRange.max, density));
  if (density !== clampedDensity) {
    warnings.push(`Density adjusted from ${density} to ${clampedDensity} (valid range: ${profile.densityRange.min}-${profile.densityRange.max})`);
  }

  // Width/height in cm
  const widthCm = input.widthMm / 10;
  const heightCm = input.heightMm / 10;
  const areaCm2 = widthCm * heightCm;

  // Fill percentage
  const fillPct = (input.fillPercentage ?? 70) / 100;
  const filledAreaCm2 = areaCm2 * fillPct;

  // Pull compensation
  const basePull = profile.pullCompensation;
  const fabricMod = fabric?.pullCompensationModifier ?? 1.0;
  const pullCompensation = basePull * fabricMod;

  // Apply pull compensation to dimensions
  const compensatedWidthCm = widthCm * (1 + pullCompensation / 100);

  // Calculate fill stitches
  // For fill/tatami: rows = height / (1/density), stitches per row = width * density
  let fillStitches: number;
  if (input.stitchType === "run" || input.stitchType === "stem") {
    // Line stitches — perimeter based
    const perimeterCm = 2 * (compensatedWidthCm + heightCm);
    fillStitches = Math.round(perimeterCm * clampedDensity * 10); // 10x for detail
  } else if (input.stitchType === "satin") {
    // Satin — column based (stitches swing across width)
    const lengthCm = Math.max(compensatedWidthCm, heightCm);
    const columnWidthCm = Math.min(compensatedWidthCm, heightCm);
    fillStitches = Math.round(lengthCm * clampedDensity * columnWidthCm * 10 * fillPct);
  } else {
    // Tatami/fill/motif — area based
    fillStitches = Math.round(filledAreaCm2 * clampedDensity * clampedDensity * profile.threadConsumptionFactor);
  }

  // Underlay stitches
  const underlayStitches = Math.round(fillStitches * underlay.stitchCountFactor);

  // Outline stitches
  let outlineStitches = 0;
  if (input.includeOutline) {
    const perimeterCm = 2 * (compensatedWidthCm + heightCm);
    const outlineWidthCm = (input.outlineWidthMm ?? 1.5) / 10;
    // Run stitch outline or satin outline
    outlineStitches = Math.round(perimeterCm * 4 * (outlineWidthCm > 0.2 ? 2 : 1));
  }

  // Colour changes & trims
  const colourChanges = Math.max(0, (input.colourCount ?? 1) - 1);
  const trimCount = colourChanges + (input.includeOutline ? 1 : 0);
  const jumpStitches = trimCount * 3; // avg 3 jump stitches per colour change

  const totalStitches = fillStitches + underlayStitches + outlineStitches + jumpStitches;

  // Warnings
  if (input.widthMm < profile.minWidth) {
    warnings.push(`Design width (${input.widthMm}mm) below recommended minimum (${profile.minWidth}mm) for ${profile.label}`);
  }
  if (input.widthMm > profile.maxWidth) {
    warnings.push(`Design width (${input.widthMm}mm) exceeds recommended maximum (${profile.maxWidth}mm) for ${profile.label}`);
  }
  if (clampedDensity < (fabric?.minDensity ?? 0)) {
    warnings.push(`Density (${clampedDensity}) below minimum recommended (${fabric?.minDensity}) for ${fabric?.label}`);
  }

  return {
    totalStitches,
    fillStitches,
    underlayStitches,
    outlineStitches,
    trimCount,
    colourChanges,
    jumpStitches,
    effectiveDensity: clampedDensity,
    pullCompensation,
    warnings,
  };
}

/* ═══════════════════════════════════════════════════════════
   Production Time Estimator
   ═══════════════════════════════════════════════════════════ */

export interface ProductionTimeInput {
  totalStitches: number;
  colourChanges: number;
  trimCount: number;
  machine?: string;
  speedPercentage?: number; // 0-100, default 80 (machines rarely run at 100%)
  hoopingTimeSec?: number; // time to hoop garment (default 30s)
  quantity: number;
  heads?: number; // number of heads running simultaneously
}

export interface ProductionTimeResult {
  stitchTimeMs: number;
  colourChangeTimeMs: number;
  trimTimeMs: number;
  hoopingTimeMs: number;
  perGarmentMs: number;
  totalBatchMs: number;
  totalBatchFormatted: string;
  perGarmentFormatted: string;
  effectiveSpeed: number;
  garmentPerHour: number;
}

export function estimateProductionTime(input: ProductionTimeInput): ProductionTimeResult {
  const machine = input.machine ? MACHINE_PROFILES[input.machine] : MACHINE_PROFILES.generic;
  const speedPct = (input.speedPercentage ?? 80) / 100;
  const effectiveSpeed = Math.round((machine?.maxSpeed ?? 1000) * speedPct); // stitches per minute
  const heads = Math.min(input.heads ?? 1, machine?.maxHeads ?? 1);
  const hoopingTimeSec = input.hoopingTimeSec ?? 30;

  // Stitch time (per garment)
  const stitchTimeMs = (input.totalStitches / effectiveSpeed) * 60 * 1000;

  // Colour change time (avg 5 seconds per change on modern machines)
  const colourChangeTimeMs = input.colourChanges * 5000;

  // Trim time (avg 1.5 seconds per trim)
  const trimTimeMs = input.trimCount * 1500;

  // Hooping time
  const hoopingTimeMs = hoopingTimeSec * 1000;

  // Per garment total
  const perGarmentMs = stitchTimeMs + colourChangeTimeMs + trimTimeMs + hoopingTimeMs;

  // Total batch (divide sewing time by heads, hooping is per-garment regardless)
  const sewingPerGarment = stitchTimeMs + colourChangeTimeMs + trimTimeMs;
  const totalBatchMs = (sewingPerGarment / heads) * input.quantity + hoopingTimeMs * input.quantity;

  const garmentPerHour = totalBatchMs > 0 ? Math.round((3600000 / (totalBatchMs / input.quantity)) * 10) / 10 : 0;

  return {
    stitchTimeMs,
    colourChangeTimeMs,
    trimTimeMs,
    hoopingTimeMs,
    perGarmentMs,
    totalBatchMs,
    totalBatchFormatted: formatDuration(totalBatchMs),
    perGarmentFormatted: formatDuration(perGarmentMs),
    effectiveSpeed,
    garmentPerHour,
  };
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/* ═══════════════════════════════════════════════════════════
   Thread Usage Calculator
   ═══════════════════════════════════════════════════════════ */

export interface ThreadUsageInput {
  totalStitches: number;
  stitchType: StitchType;
  avgStitchLengthMm?: number; // default calculated from type
  fabricThicknessMm?: number; // default 1.5mm
  colourCount?: number;
}

export interface ThreadUsageResult {
  topThreadMetres: number;
  bobbinThreadMetres: number;
  totalThreadMetres: number;
  topThreadPerColourMetres: number;
  estimatedConesNeeded: number; // based on 1000m mini cones
  estimatedBobbinsNeeded: number; // based on 150m pre-wound bobbins
}

export function calculateThreadUsage(input: ThreadUsageInput): ThreadUsageResult {
  const profile = STITCH_PROFILES[input.stitchType];

  // Average stitch length varies by type
  const avgStitchLengthMm = input.avgStitchLengthMm ?? (() => {
    switch (input.stitchType) {
      case "satin": return 3.5;
      case "tatami": return 3.0;
      case "fill": return 3.0;
      case "run": return 2.5;
      case "motif": return 4.0;
      case "stem": return 2.0;
      case "cross": return 3.5;
      case "chain": return 4.5;
      default: return 3.0;
    }
  })();

  const fabricThickness = input.fabricThicknessMm ?? 1.5;

  // Top thread: stitch length + fabric thickness (thread goes through fabric)
  const topThreadPerStitch = (avgStitchLengthMm + fabricThickness * 2) / 1000; // metres
  const topThreadMetres = Math.round(input.totalStitches * topThreadPerStitch * profile.threadConsumptionFactor * 10) / 10;

  // Bobbin thread: roughly 50-60% of top thread
  const bobbinThreadMetres = Math.round(topThreadMetres * 0.55 * 10) / 10;

  const totalThreadMetres = Math.round((topThreadMetres + bobbinThreadMetres) * 10) / 10;

  const colourCount = input.colourCount ?? 1;
  const topThreadPerColourMetres = Math.round((topThreadMetres / colourCount) * 10) / 10;

  // Mini king cones are typically 1000m, pre-wound bobbins ~150m
  const estimatedConesNeeded = Math.ceil(topThreadPerColourMetres / 1000) * colourCount;
  const estimatedBobbinsNeeded = Math.ceil(bobbinThreadMetres / 150);

  return {
    topThreadMetres,
    bobbinThreadMetres,
    totalThreadMetres,
    topThreadPerColourMetres,
    estimatedConesNeeded,
    estimatedBobbinsNeeded,
  };
}

/* ═══════════════════════════════════════════════════════════
   Cost Estimator
   ═══════════════════════════════════════════════════════════ */

export interface CostEstimateInput {
  totalStitches: number;
  colourChanges: number;
  productionTimeMs: number;
  threadMetres: number;
  quantity: number;
  // Pricing config
  ratePerThousandStitches?: number; // £ per 1000 stitches (default £0.80)
  setupFee?: number; // £ one-time setup / digitising fee (default £25)
  minCharge?: number; // £ minimum per-garment charge (default £3)
  threadCostPerMetre?: number; // £ (default £0.003)
  machineHourRate?: number; // £ per machine hour (default £45)
  isRepeatOrder?: boolean; // no setup fee for repeats
}

export interface CostEstimateResult {
  setupCost: number;
  stitchCost: number;
  threadCost: number;
  machineCost: number;
  perGarmentCost: number;
  totalCost: number;
  priceBreakdown: { label: string; amount: number }[];
}

export function estimateCost(input: CostEstimateInput): CostEstimateResult {
  const ratePerK = input.ratePerThousandStitches ?? 0.80;
  const setupFee = input.isRepeatOrder ? 0 : (input.setupFee ?? 25);
  const minCharge = input.minCharge ?? 3;
  const threadCostPerM = input.threadCostPerMetre ?? 0.003;
  const machineHourRate = input.machineHourRate ?? 45;

  const stitchCost = (input.totalStitches / 1000) * ratePerK;
  const threadCost = input.threadMetres * threadCostPerM;
  const machineCost = (input.productionTimeMs / 3600000) * machineHourRate;

  const rawPerGarment = Math.max(stitchCost + threadCost, minCharge);
  const perGarmentCost = Math.round(rawPerGarment * 100) / 100;
  const totalCost = Math.round((perGarmentCost * input.quantity + setupFee) * 100) / 100;

  return {
    setupCost: setupFee,
    stitchCost: Math.round(stitchCost * 100) / 100,
    threadCost: Math.round(threadCost * 100) / 100,
    machineCost: Math.round(machineCost * 100) / 100,
    perGarmentCost,
    totalCost,
    priceBreakdown: [
      ...(setupFee > 0 ? [{ label: "Setup / Digitising", amount: setupFee }] : []),
      { label: `Embroidery (${(input.totalStitches / 1000).toFixed(1)}k stitches × £${ratePerK.toFixed(2)}/k)`, amount: Math.round(stitchCost * 100) / 100 },
      { label: "Thread consumption", amount: Math.round(threadCost * 100) / 100 },
      { label: `Quantity × ${input.quantity}`, amount: Math.round(perGarmentCost * input.quantity * 100) / 100 },
    ],
  };
}

/* ═══════════════════════════════════════════════════════════
   Name Drop / Personalisation Engine
   ═══════════════════════════════════════════════════════════ */

export interface NameDropInput {
  names: string[];
  fontSizeMm: number; // height in mm (typical: 8-15mm for names)
  stitchType?: StitchType; // default "satin" for small text
  maxWidthMm?: number; // maximum width constraint
  density?: number;
  fabricType?: string;
}

export interface NameDropResult {
  items: {
    name: string;
    estimatedWidthMm: number;
    estimatedHeightMm: number;
    stitchCount: number;
    warnings: string[];
  }[];
  totalStitches: number;
  averageStitchesPerName: number;
  longestName: string;
  maxWidthMm: number;
}

export function estimateNameDrops(input: NameDropInput): NameDropResult {
  const items: NameDropResult["items"] = [];
  let totalStitches = 0;
  let maxWidth = 0;
  let longestName = "";

  for (const name of input.names) {
    const charCount = name.replace(/\s/g, "").length;
    const spaceCount = (name.match(/\s/g) || []).length;

    // Estimate width: each character ~60-80% of height width, spaces ~40%
    const charWidthMm = input.fontSizeMm * 0.7;
    const spaceWidthMm = input.fontSizeMm * 0.4;
    const estimatedWidthMm = Math.round(charCount * charWidthMm + spaceCount * spaceWidthMm);
    const estimatedHeightMm = input.fontSizeMm;

    const warnings: string[] = [];
    if (input.maxWidthMm && estimatedWidthMm > input.maxWidthMm) {
      warnings.push(`Name "${name}" (${estimatedWidthMm}mm) exceeds max width (${input.maxWidthMm}mm)`);
    }
    if (input.fontSizeMm < 5) {
      warnings.push("Font size below 5mm may not be readable in embroidery");
    }

    // Estimate stitches for this name
    const estimate = estimateStitchCount({
      widthMm: estimatedWidthMm,
      heightMm: estimatedHeightMm,
      fillPercentage: 50, // text is ~50% filled
      stitchType: input.stitchType ?? "satin",
      density: input.density,
      fabricType: input.fabricType,
      includeOutline: false,
      colourCount: 1,
    });

    items.push({
      name,
      estimatedWidthMm,
      estimatedHeightMm,
      stitchCount: estimate.totalStitches,
      warnings,
    });

    totalStitches += estimate.totalStitches;
    if (estimatedWidthMm > maxWidth) {
      maxWidth = estimatedWidthMm;
      longestName = name;
    }
  }

  return {
    items,
    totalStitches,
    averageStitchesPerName: items.length > 0 ? Math.round(totalStitches / items.length) : 0,
    longestName,
    maxWidthMm: maxWidth,
  };
}

/* ═══════════════════════════════════════════════════════════
   DST File Generator (Tajima format)
   ═══════════════════════════════════════════════════════════ */

// DST uses relative moves in 0.1mm units
// Commands: normal stitch, jump stitch, colour change, end

export interface DstStitch {
  dx: number; // 0.1mm increments
  dy: number;
  type: "stitch" | "jump" | "trim" | "colour_change" | "end";
}

export function generateDstHeader(label: string, stitchCount: number, colourChanges: number, extents: { minX: number; minY: number; maxX: number; maxY: number }): Buffer {
  const header = Buffer.alloc(512, 0x20); // 512 bytes, space-filled

  // Write header fields
  const writeField = (offset: number, tag: string, value: string) => {
    const str = `${tag}:${value}\r`;
    header.write(str, offset, "ascii");
  };

  writeField(0, "LA", label.substring(0, 16).padEnd(16));
  writeField(20, "ST", String(stitchCount).padStart(7));
  writeField(30, "CO", String(colourChanges).padStart(3));
  writeField(36, "+X", String(Math.abs(extents.maxX)).padStart(5));
  writeField(44, "-X", String(Math.abs(extents.minX)).padStart(5));
  writeField(52, "+Y", String(Math.abs(extents.maxY)).padStart(5));
  writeField(60, "-Y", String(Math.abs(extents.minY)).padStart(5));

  // AX, AY — end point offsets (set to 0)
  writeField(68, "AX", "+    0");
  writeField(77, "AY", "+    0");

  // MX, MY — previous design offset (not used)
  writeField(86, "MX", "+    0");
  writeField(95, "MY", "+    0");

  // PD — ? (always "******")
  writeField(104, "PD", "******");

  return header;
}

export function encodeDstStitch(stitch: DstStitch): Buffer {
  if (stitch.type === "end") {
    return Buffer.from([0x00, 0x00, 0xF3]);
  }

  // Clamp to DST range (-121 to +121 in 0.1mm)
  const dx = Math.max(-121, Math.min(121, Math.round(stitch.dx)));
  const dy = Math.max(-121, Math.min(121, Math.round(stitch.dy)));

  let b0 = 0;
  let b1 = 0;
  let b2 = 0;

  // Encode Y (inverted in DST)
  const y = -dy;
  if (y > 0) {
    if (y & 1) b0 |= 0x01;
    if (y & 2) b0 |= 0x02;
    if (y & 4) b0 |= 0x04;
    if (y & 8) b1 |= 0x01;
    if (y & 16) b1 |= 0x02;
    if (y & 32) b1 |= 0x04;
    if (y & 64) b2 |= 0x01;
    if (y & 128) b2 |= 0x02;
  } else if (y < 0) {
    const ay = -y;
    if (ay & 1) b0 |= 0x01;
    if (ay & 2) b0 |= 0x02;
    if (ay & 4) b0 |= 0x04;
    if (ay & 8) b1 |= 0x01;
    if (ay & 16) b1 |= 0x02;
    if (ay & 32) b1 |= 0x04;
    if (ay & 64) b2 |= 0x01;
    if (ay & 128) b2 |= 0x02;
    b0 |= 0x08; // negative y flag
    b1 |= 0x08;
    b2 |= 0x04;
  }

  // Encode X
  if (dx > 0) {
    if (dx & 1) b0 |= 0x10;
    if (dx & 2) b0 |= 0x20;
    if (dx & 4) b0 |= 0x40;
    if (dx & 8) b1 |= 0x10;
    if (dx & 16) b1 |= 0x20;
    if (dx & 32) b1 |= 0x40;
    if (dx & 64) b2 |= 0x10;
    if (dx & 128) b2 |= 0x20;
  } else if (dx < 0) {
    const ax = -dx;
    if (ax & 1) b0 |= 0x10;
    if (ax & 2) b0 |= 0x20;
    if (ax & 4) b0 |= 0x40;
    if (ax & 8) b1 |= 0x10;
    if (ax & 16) b1 |= 0x20;
    if (ax & 32) b1 |= 0x40;
    if (ax & 64) b2 |= 0x10;
    if (ax & 128) b2 |= 0x20;
    b0 |= 0x80; // negative x flag
    b1 |= 0x80;
    b2 |= 0x08;
  }

  // Set stitch type bits
  if (stitch.type === "jump") {
    b2 |= 0x80; // jump bit
  } else if (stitch.type === "colour_change") {
    b2 |= 0xC0; // colour change = jump + stop
  } else if (stitch.type === "trim") {
    b2 |= 0x80; // treated as jump in DST
  }

  // Normal stitch must have bit 7 of b2 clear
  // b2 bit 6 set for normal stitch
  if (stitch.type === "stitch") {
    b2 |= 0x03; // required bits for normal stitch
  }

  return Buffer.from([b0, b1, b2]);
}

/* ═══════════════════════════════════════════════════════════
   Full Estimate Pipeline
   ═══════════════════════════════════════════════════════════ */

export interface FullEstimateInput {
  placements: {
    zone: string;
    widthMm: number;
    heightMm: number;
    fillPercentage?: number;
    stitchType: StitchType;
    density?: number;
    underlay?: UnderlayType;
    colourCount?: number;
    includeOutline?: boolean;
    artworkName?: string;
  }[];
  fabricType?: string;
  machine?: string;
  speedPercentage?: number;
  quantity: number;
  heads?: number;
  nameDrops?: NameDropInput;
  // Pricing
  ratePerThousandStitches?: number;
  setupFee?: number;
  isRepeatOrder?: boolean;
}

export interface FullEstimateResult {
  placements: {
    zone: string;
    artworkName?: string;
    stitches: StitchEstimateResult;
    threadUsage: ThreadUsageResult;
  }[];
  nameDrops?: NameDropResult;
  totals: {
    totalStitches: number;
    totalColourChanges: number;
    totalTrims: number;
  };
  production: ProductionTimeResult;
  cost: CostEstimateResult;
  threadUsage: ThreadUsageResult;
  warnings: string[];
}

export function generateFullEstimate(input: FullEstimateInput): FullEstimateResult {
  const allWarnings: string[] = [];
  let totalStitches = 0;
  let totalColourChanges = 0;
  let totalTrims = 0;

  const placements = input.placements.map((p) => {
    const stitches = estimateStitchCount({
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      fillPercentage: p.fillPercentage,
      stitchType: p.stitchType,
      density: p.density,
      underlay: p.underlay,
      fabricType: input.fabricType,
      includeOutline: p.includeOutline,
      colourCount: p.colourCount,
    });

    const threadUsage = calculateThreadUsage({
      totalStitches: stitches.totalStitches,
      stitchType: p.stitchType,
      colourCount: p.colourCount,
    });

    totalStitches += stitches.totalStitches;
    totalColourChanges += stitches.colourChanges;
    totalTrims += stitches.trimCount;
    allWarnings.push(...stitches.warnings);

    return { zone: p.zone, artworkName: p.artworkName, stitches, threadUsage };
  });

  // Name drops
  let nameDropResult: NameDropResult | undefined;
  if (input.nameDrops) {
    nameDropResult = estimateNameDrops(input.nameDrops);
    totalStitches += nameDropResult.totalStitches;
    allWarnings.push(...nameDropResult.items.flatMap((i) => i.warnings));
  }

  // Thread usage for total
  const totalThreadUsage = calculateThreadUsage({
    totalStitches,
    stitchType: input.placements[0]?.stitchType ?? "tatami",
    colourCount: input.placements.reduce((sum, p) => sum + (p.colourCount ?? 1), 0),
  });

  // Production time
  const production = estimateProductionTime({
    totalStitches,
    colourChanges: totalColourChanges,
    trimCount: totalTrims,
    machine: input.machine,
    speedPercentage: input.speedPercentage,
    quantity: input.quantity,
    heads: input.heads,
  });

  // Cost
  const cost = estimateCost({
    totalStitches,
    colourChanges: totalColourChanges,
    productionTimeMs: production.perGarmentMs,
    threadMetres: totalThreadUsage.totalThreadMetres,
    quantity: input.quantity,
    ratePerThousandStitches: input.ratePerThousandStitches,
    setupFee: input.setupFee,
    isRepeatOrder: input.isRepeatOrder,
  });

  logger.info({
    totalStitches,
    placements: placements.length,
    quantity: input.quantity,
    productionTime: production.totalBatchFormatted,
    totalCost: cost.totalCost,
  }, "[EmbroideryEngine] Full estimate generated");

  return {
    placements,
    nameDrops: nameDropResult,
    totals: { totalStitches, totalColourChanges, totalTrims },
    production,
    cost,
    threadUsage: totalThreadUsage,
    warnings: allWarnings,
  };
}
