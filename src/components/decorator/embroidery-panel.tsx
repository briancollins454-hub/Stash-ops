"use client";

/**
 * ═══════════════════════════════════════════════════════════
 *  Embroidery Panel — integrated into decorator properties
 *  Stitch estimation, thread picker, cost calculator, name drops
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { StitchPreview, type StitchRenderType } from "./stitch-preview";

/* ── Types mirroring the backend engine ── */

interface StitchEstimateResult {
  totalStitches: number;
  fillStitches: number;
  underlayStitches: number;
  outlineStitches: number;
  trimCount: number;
  colourChanges: number;
  effectiveDensity: number;
  pullCompensation: number;
  warnings: string[];
}

interface ProductionTimeResult {
  perGarmentMs: number;
  totalBatchMs: number;
  totalBatchFormatted: string;
  perGarmentFormatted: string;
  effectiveSpeed: number;
  garmentPerHour: number;
}

interface CostResult {
  setupCost: number;
  perGarmentCost: number;
  totalCost: number;
  priceBreakdown: { label: string; amount: number }[];
}

interface ThreadUsageResult {
  topThreadMetres: number;
  bobbinThreadMetres: number;
  totalThreadMetres: number;
}

interface ThreadColour {
  code: string;
  name: string;
  hex: string;
  brand: string;
  range: string;
  isMetallic?: boolean;
}

/* ── Stitch Types ── */

const STITCH_TYPES: { key: StitchRenderType; label: string; icon: string; desc: string }[] = [
  { key: "satin", label: "Satin", icon: "═", desc: "Smooth parallel stitches — lettering & borders" },
  { key: "tatami", label: "Tatami", icon: "≡", desc: "Interlocking fill — large areas" },
  { key: "fill", label: "Complex Fill", icon: "▤", desc: "Advanced pattern fills — complex shapes" },
  { key: "run", label: "Run/Outline", icon: "─", desc: "Single line — outlines & detail" },
  { key: "cross", label: "Cross Stitch", icon: "✕", desc: "X-pattern — decorative fills" },
];

const UNDERLAY_TYPES = [
  { key: "auto", label: "Auto (Recommended)" },
  { key: "centre_run", label: "Centre Run" },
  { key: "edge_run", label: "Edge Run" },
  { key: "zigzag", label: "Zigzag" },
  { key: "tatami", label: "Tatami Underlay" },
  { key: "none", label: "None" },
];

const FABRIC_TYPES = [
  { key: "cotton", label: "Cotton / Woven" },
  { key: "polyester", label: "Polyester" },
  { key: "fleece", label: "Fleece / Sweatshirt" },
  { key: "knit", label: "Knit / Jersey" },
  { key: "pique", label: "Pique / Polo" },
  { key: "nylon", label: "Nylon / Ripstop" },
  { key: "denim", label: "Denim" },
  { key: "cap", label: "Cap / Structured" },
  { key: "towel", label: "Towelling" },
];

const MACHINES = [
  { key: "tajima", label: "Tajima TMEZ" },
  { key: "barudan", label: "Barudan BEYS" },
  { key: "brother", label: "Brother PR" },
  { key: "generic", label: "Generic / Other" },
];

/* Thread brand summaries */
const THREAD_BRANDS = [
  { key: "madeira", label: "Madeira" },
  { key: "isacord", label: "Isacord" },
  { key: "marathon", label: "Marathon" },
];

/* ── Backend API URL ── */
const API = process.env.NEXT_PUBLIC_BACKEND_URL || "https://stash-api-production-7f18.up.railway.app/api";

/* ═══════════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════════ */

interface EmbroideryPanelProps {
  zoneKey: string;
  widthMm: number;
  heightMm: number;
  artworkUrl?: string;
  colourCount?: number;
  quantity?: number;
  onStitchCountChange?: (count: number) => void;
  onCostChange?: (cost: number) => void;
}

/* ═══════════════════════════════════════════════════════════
   Main Panel
   ═══════════════════════════════════════════════════════════ */

export function EmbroideryPanel({
  zoneKey,
  widthMm,
  heightMm,
  artworkUrl,
  colourCount = 1,
  quantity = 1,
  onStitchCountChange,
  onCostChange,
}: EmbroideryPanelProps) {
  const [activeSection, setActiveSection] = useState<"stitch" | "thread" | "cost" | "preview" | "namedrop">("stitch");

  // Stitch settings
  const [stitchType, setStitchType] = useState<StitchRenderType>("satin");
  const [density, setDensity] = useState(5);
  const [angle, setAngle] = useState(0);
  const [fillPercentage, setFillPercentage] = useState(70);
  const [underlay, setUnderlay] = useState("auto");
  const [fabricType, setFabricType] = useState("cotton");
  const [includeOutline, setIncludeOutline] = useState(true);

  // Production settings
  const [machine, setMachine] = useState("tajima");
  const [speed, setSpeed] = useState(80);
  const [heads, setHeads] = useState(1);

  // Cost settings
  const [ratePerK, setRatePerK] = useState(0.80);
  const [setupFee, setSetupFee] = useState(25);
  const [isRepeat, setIsRepeat] = useState(false);

  // Thread
  const [selectedBrand, setSelectedBrand] = useState("madeira");
  const [threadSearch, setThreadSearch] = useState("");
  const [selectedThreads, setSelectedThreads] = useState<ThreadColour[]>([]);
  const [threadResults, setThreadResults] = useState<ThreadColour[]>([]);

  // Estimates (computed locally — matching backend engine logic)
  const estimate = useMemo(() => {
    return localEstimateStitches({
      widthMm, heightMm, fillPercentage, stitchType, density,
      underlay: underlay === "auto" ? undefined : underlay,
      fabricType, includeOutline, colourCount,
    });
  }, [widthMm, heightMm, fillPercentage, stitchType, density, underlay, fabricType, includeOutline, colourCount]);

  const production = useMemo(() => {
    return localEstimateTime({
      totalStitches: estimate.totalStitches,
      colourChanges: estimate.colourChanges,
      trimCount: estimate.trimCount,
      machine, speedPercentage: speed, quantity, heads,
    });
  }, [estimate, machine, speed, quantity, heads]);

  const cost = useMemo(() => {
    return localEstimateCost({
      totalStitches: estimate.totalStitches,
      colourChanges: estimate.colourChanges,
      productionTimeMs: production.perGarmentMs,
      threadMetres: estimate.totalStitches * 0.005, // rough thread estimate
      quantity, ratePerK, setupFee, isRepeat,
    });
  }, [estimate, production, quantity, ratePerK, setupFee, isRepeat]);

  // Stable refs for callbacks to prevent infinite re-render loops
  const stitchCountRef = useRef(onStitchCountChange);
  stitchCountRef.current = onStitchCountChange;
  const costChangeRef = useRef(onCostChange);
  costChangeRef.current = onCostChange;

  // Callbacks — only fire when the computed value changes, not when the callback ref changes
  useEffect(() => {
    stitchCountRef.current?.(estimate.totalStitches);
  }, [estimate.totalStitches]);

  useEffect(() => {
    costChangeRef.current?.(cost.totalCost);
  }, [cost.totalCost]);

  // Thread search
  const handleThreadSearch = useCallback(async (q: string) => {
    setThreadSearch(q);
    if (q.length < 2) { setThreadResults([]); return; }
    try {
      const res = await fetch(`${API}/v1/embroidery/threads?search=${encodeURIComponent(q)}&brand=${selectedBrand}`);
      if (res.ok) setThreadResults(await res.json());
    } catch { /* ignore */ }
  }, [selectedBrand]);

  const sections: { key: typeof activeSection; label: string; icon: string }[] = [
    { key: "stitch", label: "Stitching", icon: "🧵" },
    { key: "thread", label: "Thread", icon: "🎨" },
    { key: "cost", label: "Costing", icon: "💰" },
    { key: "preview", label: "Preview", icon: "👁" },
    { key: "namedrop", label: "Names", icon: "📝" },
  ];

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Stitches</div>
            <div className="text-sm font-semibold text-indigo-300">
              {(estimate.totalStitches / 1000).toFixed(1)}k
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Time</div>
            <div className="text-sm font-semibold text-emerald-300">
              {production.perGarmentFormatted}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Cost</div>
            <div className="text-sm font-semibold text-amber-300">
              £{cost.perGarmentCost.toFixed(2)}
            </div>
          </div>
        </div>
        {estimate.warnings.length > 0 && (
          <div className="mt-2 space-y-1">
            {estimate.warnings.map((w, i) => (
              <div key={i} className="text-[10px] text-amber-400/70">⚠ {w}</div>
            ))}
          </div>
        )}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className="flex items-center gap-1 whitespace-nowrap rounded px-2 py-1.5 text-[10px] font-medium transition-all"
            style={
              activeSection === s.key
                ? { background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }
                : { color: "rgba(255,255,255,0.4)" }
            }
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Section content */}
      {activeSection === "stitch" && (
        <StitchSection
          stitchType={stitchType}
          density={density}
          angle={angle}
          fillPercentage={fillPercentage}
          underlay={underlay}
          fabricType={fabricType}
          includeOutline={includeOutline}
          estimate={estimate}
          onStitchType={setStitchType}
          onDensity={setDensity}
          onAngle={setAngle}
          onFillPercentage={setFillPercentage}
          onUnderlay={setUnderlay}
          onFabricType={setFabricType}
          onIncludeOutline={setIncludeOutline}
        />
      )}

      {activeSection === "thread" && (
        <ThreadSection
          selectedBrand={selectedBrand}
          threadSearch={threadSearch}
          threadResults={threadResults}
          selectedThreads={selectedThreads}
          onBrandChange={setSelectedBrand}
          onSearch={handleThreadSearch}
          onSelectThread={(t) => setSelectedThreads((prev) => [...prev, t])}
          onRemoveThread={(code) => setSelectedThreads((prev) => prev.filter((t) => t.code !== code))}
        />
      )}

      {activeSection === "cost" && (
        <CostSection
          estimate={estimate}
          production={production}
          cost={cost}
          quantity={quantity}
          machine={machine}
          speed={speed}
          heads={heads}
          ratePerK={ratePerK}
          setupFee={setupFee}
          isRepeat={isRepeat}
          onMachine={setMachine}
          onSpeed={setSpeed}
          onHeads={setHeads}
          onRatePerK={setRatePerK}
          onSetupFee={setSetupFee}
          onIsRepeat={setIsRepeat}
        />
      )}

      {activeSection === "preview" && artworkUrl && (
        <PreviewSection
          artworkUrl={artworkUrl}
          stitchType={stitchType}
          density={density}
          angle={angle}
          threadColour={selectedThreads[0]?.hex}
        />
      )}

      {activeSection === "namedrop" && (
        <NameDropSection
          fabricType={fabricType}
          stitchType={stitchType}
          density={density}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Stitch Section
   ═══════════════════════════════════════════════════════════ */

function StitchSection({
  stitchType, density, angle, fillPercentage, underlay, fabricType, includeOutline, estimate,
  onStitchType, onDensity, onAngle, onFillPercentage, onUnderlay, onFabricType, onIncludeOutline,
}: {
  stitchType: StitchRenderType;
  density: number;
  angle: number;
  fillPercentage: number;
  underlay: string;
  fabricType: string;
  includeOutline: boolean;
  estimate: StitchEstimateResult;
  onStitchType: (v: StitchRenderType) => void;
  onDensity: (v: number) => void;
  onAngle: (v: number) => void;
  onFillPercentage: (v: number) => void;
  onUnderlay: (v: string) => void;
  onFabricType: (v: string) => void;
  onIncludeOutline: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Stitch type buttons */}
      <Label text="Stitch Type" />
      <div className="grid grid-cols-2 gap-1.5">
        {STITCH_TYPES.map((s) => (
          <button
            key={s.key}
            onClick={() => onStitchType(s.key)}
            className="rounded-md p-2 text-left transition-all"
            style={
              stitchType === s.key
                ? { background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }
            }
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{s.icon}</span>
              <span className="text-[11px] font-medium text-white/80">{s.label}</span>
            </div>
            <div className="mt-0.5 text-[9px] text-white/30">{s.desc}</div>
          </button>
        ))}
      </div>

      {/* Density slider */}
      <div>
        <Label text={`Density: ${density} st/cm`} />
        <input
          type="range"
          min={2}
          max={8}
          step={0.5}
          value={density}
          onChange={(e) => onDensity(parseFloat(e.target.value))}
          className="w-full accent-indigo-500"
        />
        <div className="flex justify-between text-[9px] text-white/30">
          <span>Loose</span>
          <span>Dense</span>
        </div>
      </div>

      {/* Angle */}
      <div>
        <Label text={`Stitch Angle: ${angle}°`} />
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={angle}
          onChange={(e) => onAngle(parseInt(e.target.value))}
          className="w-full accent-indigo-500"
        />
      </div>

      {/* Fill percentage */}
      <div>
        <Label text={`Fill Coverage: ${fillPercentage}%`} />
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={fillPercentage}
          onChange={(e) => onFillPercentage(parseInt(e.target.value))}
          className="w-full accent-indigo-500"
        />
      </div>

      {/* Fabric type */}
      <div>
        <Label text="Fabric Type" />
        <select
          value={fabricType}
          onChange={(e) => onFabricType(e.target.value)}
          className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[11px] text-white/80"
        >
          {FABRIC_TYPES.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Underlay */}
      <div>
        <Label text="Underlay" />
        <select
          value={underlay}
          onChange={(e) => onUnderlay(e.target.value)}
          className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[11px] text-white/80"
        >
          {UNDERLAY_TYPES.map((u) => (
            <option key={u.key} value={u.key}>{u.label}</option>
          ))}
        </select>
      </div>

      {/* Include outline */}
      <label className="flex items-center gap-2 text-[11px] text-white/70">
        <input
          type="checkbox"
          checked={includeOutline}
          onChange={(e) => onIncludeOutline(e.target.checked)}
          className="accent-indigo-500"
        />
        Include outline stitch
      </label>

      {/* Stitch breakdown */}
      <div className="rounded border border-white/10 bg-white/[0.02] p-2 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Stitch Breakdown</div>
        <Row label="Fill stitches" value={estimate.fillStitches.toLocaleString()} />
        <Row label="Underlay stitches" value={estimate.underlayStitches.toLocaleString()} />
        <Row label="Outline stitches" value={estimate.outlineStitches.toLocaleString()} />
        <Row label="Colour changes" value={String(estimate.colourChanges)} />
        <Row label="Pull compensation" value={`${estimate.pullCompensation.toFixed(1)}%`} />
        <div className="border-t border-white/10 pt-1 mt-1">
          <Row label="Total stitches" value={estimate.totalStitches.toLocaleString()} bold />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Thread Section
   ═══════════════════════════════════════════════════════════ */

function ThreadSection({
  selectedBrand, threadSearch, threadResults, selectedThreads,
  onBrandChange, onSearch, onSelectThread, onRemoveThread,
}: {
  selectedBrand: string;
  threadSearch: string;
  threadResults: ThreadColour[];
  selectedThreads: ThreadColour[];
  onBrandChange: (v: string) => void;
  onSearch: (v: string) => void;
  onSelectThread: (t: ThreadColour) => void;
  onRemoveThread: (code: string) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Brand selector */}
      <Label text="Thread Brand" />
      <div className="flex gap-1">
        {THREAD_BRANDS.map((b) => (
          <button
            key={b.key}
            onClick={() => onBrandChange(b.key)}
            className="rounded px-2.5 py-1 text-[10px] font-medium transition-all"
            style={
              selectedBrand === b.key
                ? { background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }
                : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.06)" }
            }
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={threadSearch}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search threads (name or code)..."
        className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[11px] text-white/80 placeholder:text-white/30"
      />

      {/* Search results */}
      {threadResults.length > 0 && (
        <div className="max-h-40 space-y-0.5 overflow-y-auto rounded border border-white/10 bg-white/[0.02] p-1">
          {threadResults.map((t) => (
            <button
              key={`${t.brand}-${t.code}`}
              onClick={() => onSelectThread(t)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-all hover:bg-white/[0.05]"
            >
              <div
                className="h-4 w-4 shrink-0 rounded-full border border-white/20"
                style={{ background: t.hex }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-white/80">{t.name}</div>
                <div className="text-[9px] text-white/40">{t.brand} {t.code}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected threads */}
      <div>
        <Label text={`Selected Colours (${selectedThreads.length})`} />
        {selectedThreads.length === 0 ? (
          <div className="text-[10px] text-white/30 italic">No threads selected yet</div>
        ) : (
          <div className="space-y-0.5">
            {selectedThreads.map((t, i) => (
              <div
                key={`${t.code}-${i}`}
                className="flex items-center gap-2 rounded bg-white/[0.03] px-2 py-1"
              >
                <div className="text-[10px] text-white/40 font-mono w-4">{i + 1}</div>
                <div
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
                  style={{ background: t.hex }}
                />
                <div className="flex-1 text-[10px] text-white/70">{t.name}</div>
                <div className="text-[9px] text-white/30 font-mono">{t.code}</div>
                <button
                  onClick={() => onRemoveThread(t.code)}
                  className="text-[10px] text-red-400/60 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Colour palette for quick add */}
      <div>
        <Label text="Quick Colours" />
        <div className="flex flex-wrap gap-1">
          {QUICK_COLOURS.map((c) => (
            <button
              key={c.hex}
              onClick={() => onSelectThread({ code: c.code, name: c.name, hex: c.hex, brand: selectedBrand, range: "quick" })}
              className="h-5 w-5 rounded-sm border border-white/10 transition-all hover:scale-125 hover:border-white/30"
              style={{ background: c.hex }}
              title={c.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Cost Section
   ═══════════════════════════════════════════════════════════ */

function CostSection({
  estimate, production, cost, quantity,
  machine, speed, heads, ratePerK, setupFee, isRepeat,
  onMachine, onSpeed, onHeads, onRatePerK, onSetupFee, onIsRepeat,
}: {
  estimate: StitchEstimateResult;
  production: ProductionTimeResult;
  cost: CostResult;
  quantity: number;
  machine: string;
  speed: number;
  heads: number;
  ratePerK: number;
  setupFee: number;
  isRepeat: boolean;
  onMachine: (v: string) => void;
  onSpeed: (v: number) => void;
  onHeads: (v: number) => void;
  onRatePerK: (v: number) => void;
  onSetupFee: (v: number) => void;
  onIsRepeat: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Machine */}
      <div>
        <Label text="Machine" />
        <select
          value={machine}
          onChange={(e) => onMachine(e.target.value)}
          className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[11px] text-white/80"
        >
          {MACHINES.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Speed & Heads */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label text={`Speed: ${speed}%`} />
          <input
            type="range"
            min={40}
            max={100}
            step={5}
            value={speed}
            onChange={(e) => onSpeed(parseInt(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>
        <div>
          <Label text="Heads" />
          <input
            type="number"
            min={1}
            max={20}
            value={heads}
            onChange={(e) => onHeads(parseInt(e.target.value) || 1)}
            className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[11px] text-white/80"
          />
        </div>
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label text="Rate per 1k stitches (£)" />
          <input
            type="number"
            min={0.1}
            max={5}
            step={0.05}
            value={ratePerK}
            onChange={(e) => onRatePerK(parseFloat(e.target.value) || 0.8)}
            className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[11px] text-white/80"
          />
        </div>
        <div>
          <Label text="Setup fee (£)" />
          <input
            type="number"
            min={0}
            max={200}
            step={5}
            value={setupFee}
            onChange={(e) => onSetupFee(parseFloat(e.target.value) || 0)}
            className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[11px] text-white/80"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-[11px] text-white/70">
        <input
          type="checkbox"
          checked={isRepeat}
          onChange={(e) => onIsRepeat(e.target.checked)}
          className="accent-indigo-500"
        />
        Repeat order (no setup fee)
      </label>

      {/* Production summary */}
      <div className="rounded border border-white/10 bg-white/[0.02] p-2 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Production</div>
        <Row label="Per garment" value={production.perGarmentFormatted} />
        <Row label="Effective speed" value={`${production.effectiveSpeed} spm`} />
        <Row label="Garments/hour" value={String(production.garmentPerHour)} />
        <Row label={`Batch (×${quantity})`} value={production.totalBatchFormatted} />
      </div>

      {/* Cost breakdown */}
      <div className="rounded border border-emerald-500/20 bg-emerald-500/[0.03] p-2 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-emerald-400/60 mb-1">Cost Breakdown</div>
        {cost.priceBreakdown.map((p, i) => (
          <Row key={i} label={p.label} value={`£${p.amount.toFixed(2)}`} />
        ))}
        <div className="border-t border-emerald-500/20 pt-1 mt-1">
          <Row label="Per garment" value={`£${cost.perGarmentCost.toFixed(2)}`} bold />
          <Row label="Total" value={`£${cost.totalCost.toFixed(2)}`} bold />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Preview Section
   ═══════════════════════════════════════════════════════════ */

function PreviewSection({
  artworkUrl, stitchType, density, angle, threadColour,
}: {
  artworkUrl: string;
  stitchType: StitchRenderType;
  density: number;
  angle: number;
  threadColour?: string;
}) {
  const [showTexture, setShowTexture] = useState(true);
  const [previewStitch, setPreviewStitch] = useState(stitchType);
  const [previewDensity, setPreviewDensity] = useState(density);

  return (
    <div className="space-y-3">
      <Label text="Stitch Preview" />

      {/* Preview controls */}
      <div className="flex gap-1">
        {STITCH_TYPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setPreviewStitch(s.key)}
            className="rounded px-2 py-1 text-[10px] transition-all"
            style={
              previewStitch === s.key
                ? { background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }
                : { color: "rgba(255,255,255,0.4)" }
            }
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Preview canvas */}
      <div className="flex justify-center rounded-lg border border-white/10 bg-black/30 p-3">
        <StitchPreview
          imageUrl={artworkUrl}
          width={260}
          height={260}
          stitchType={previewStitch}
          density={previewDensity}
          angle={angle}
          threadColour={threadColour}
          showTexture={showTexture}
        />
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-[10px] text-white/60">
          <input
            type="checkbox"
            checked={showTexture}
            onChange={(e) => setShowTexture(e.target.checked)}
            className="accent-indigo-500"
          />
          Show stitch texture
        </label>
        <div className="flex-1">
          <input
            type="range"
            min={2}
            max={8}
            step={0.5}
            value={previewDensity}
            onChange={(e) => setPreviewDensity(parseFloat(e.target.value))}
            className="w-full accent-indigo-500"
            title="Preview density"
          />
        </div>
      </div>

      {/* Comparison */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1 text-[9px] text-white/40 text-center">Original</div>
          <div className="overflow-hidden rounded border border-white/10">
            <StitchPreview
              imageUrl={artworkUrl}
              width={130}
              height={130}
              showTexture={false}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 text-[9px] text-white/40 text-center">Embroidered</div>
          <div className="overflow-hidden rounded border border-indigo-500/30">
            <StitchPreview
              imageUrl={artworkUrl}
              width={130}
              height={130}
              stitchType={previewStitch}
              density={previewDensity}
              angle={angle}
              threadColour={threadColour}
              showTexture={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Name Drop Section
   ═══════════════════════════════════════════════════════════ */

function NameDropSection({
  fabricType, stitchType, density,
}: {
  fabricType: string;
  stitchType: StitchRenderType;
  density: number;
}) {
  const [names, setNames] = useState("");
  const [fontSize, setFontSize] = useState(10);
  const [maxWidth, setMaxWidth] = useState(120);

  const nameList = names.split("\n").map((n) => n.trim()).filter(Boolean);

  const result = useMemo(() => {
    if (nameList.length === 0) return null;
    return localEstimateNameDrops({
      names: nameList,
      fontSizeMm: fontSize,
      stitchType,
      maxWidthMm: maxWidth,
      density,
      fabricType,
    });
  }, [nameList, fontSize, stitchType, maxWidth, density, fabricType]);

  return (
    <div className="space-y-3">
      <Label text="Personalisation / Name Drops" />

      <div>
        <Label text="Enter names (one per line)" />
        <textarea
          value={names}
          onChange={(e) => setNames(e.target.value)}
          placeholder={"John Smith\nJane Doe\nAlex Johnson"}
          rows={5}
          className="w-full rounded border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[11px] text-white/80 placeholder:text-white/20 font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label text={`Font size: ${fontSize}mm`} />
          <input
            type="range"
            min={5}
            max={25}
            step={1}
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>
        <div>
          <Label text={`Max width: ${maxWidth}mm`} />
          <input
            type="range"
            min={40}
            max={300}
            step={10}
            value={maxWidth}
            onChange={(e) => setMaxWidth(parseInt(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>
      </div>

      {result && (
        <div className="space-y-2">
          {/* Summary */}
          <div className="rounded border border-white/10 bg-white/[0.02] p-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Name Drop Summary</div>
            <Row label="Total names" value={String(nameList.length)} />
            <Row label="Avg stitches/name" value={result.averageStitchesPerName.toLocaleString()} />
            <Row label="Total stitches" value={result.totalStitches.toLocaleString()} />
            <Row label="Longest name" value={result.longestName} />
            <Row label="Max width" value={`${result.maxWidthMm}mm`} />
          </div>

          {/* Individual names */}
          <div className="max-h-40 space-y-0.5 overflow-y-auto rounded border border-white/10 bg-white/[0.02] p-1">
            {result.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded px-2 py-0.5"
              >
                <div className="flex-1 text-[10px] text-white/70 truncate">{item.name}</div>
                <div className="text-[9px] text-white/40 font-mono">{item.estimatedWidthMm}mm</div>
                <div className="text-[9px] text-indigo-300 font-mono">{item.stitchCount.toLocaleString()}</div>
                {item.warnings.length > 0 && (
                  <span className="text-amber-400 text-[10px]" title={item.warnings.join("; ")}>⚠</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Shared UI Components
   ═══════════════════════════════════════════════════════════ */

function Label({ text }: { text: string }) {
  return <div className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">{text}</div>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-white/50">{label}</span>
      <span className={bold ? "font-semibold text-white/90" : "text-white/70 font-mono"}>{value}</span>
    </div>
  );
}

/* ── Quick colour palette ── */

const QUICK_COLOURS = [
  { code: "WHT", name: "White", hex: "#FFFFFF" },
  { code: "BLK", name: "Black", hex: "#000000" },
  { code: "RED", name: "Red", hex: "#CC0000" },
  { code: "NVY", name: "Navy", hex: "#000080" },
  { code: "RYL", name: "Royal Blue", hex: "#4169E1" },
  { code: "SKY", name: "Sky Blue", hex: "#87CEEB" },
  { code: "GRN", name: "Green", hex: "#228B22" },
  { code: "LGN", name: "Lime", hex: "#32CD32" },
  { code: "YLW", name: "Yellow", hex: "#FFD700" },
  { code: "ORG", name: "Orange", hex: "#FFA500" },
  { code: "PNK", name: "Pink", hex: "#FF69B4" },
  { code: "PRP", name: "Purple", hex: "#800080" },
  { code: "GRY", name: "Grey", hex: "#808080" },
  { code: "SLV", name: "Silver", hex: "#C0C0C0" },
  { code: "GLD", name: "Gold", hex: "#FFD700" },
  { code: "BRN", name: "Brown", hex: "#8B4513" },
  { code: "BRG", name: "Burgundy", hex: "#800020" },
  { code: "TLK", name: "Teal", hex: "#008080" },
];

/* ═══════════════════════════════════════════════════════════
   Local Estimation Functions
   (mirrors backend — runs client-side for instant feedback)
   ═══════════════════════════════════════════════════════════ */

const STITCH_DENSITY_DEFAULTS: Record<string, number> = {
  satin: 5, tatami: 4.5, fill: 4, run: 4, cross: 3,
};

const THREAD_CONSUMPTION: Record<string, number> = {
  satin: 1.3, tatami: 1.0, fill: 1.1, run: 0.3, cross: 1.2,
};

const PULL_COMP: Record<string, number> = {
  satin: 15, tatami: 10, fill: 12, run: 0, cross: 5,
};

const FABRIC_PULL_MOD: Record<string, number> = {
  cotton: 1.0, polyester: 0.8, fleece: 1.3, knit: 1.5,
  pique: 1.2, nylon: 0.7, denim: 0.9, cap: 0.6, towel: 1.4,
};

const UNDERLAY_FACTOR: Record<string, number> = {
  centre_run: 0.08, edge_run: 0.12, zigzag: 0.20, tatami: 0.30, none: 0,
};

function localEstimateStitches(input: {
  widthMm: number; heightMm: number; fillPercentage: number;
  stitchType: string; density: number; underlay?: string;
  fabricType: string; includeOutline: boolean; colourCount: number;
}): StitchEstimateResult {
  const d = input.density || STITCH_DENSITY_DEFAULTS[input.stitchType] || 4;
  const widthCm = input.widthMm / 10;
  const heightCm = input.heightMm / 10;
  const areaCm2 = widthCm * heightCm;
  const fillPct = input.fillPercentage / 100;
  const tc = THREAD_CONSUMPTION[input.stitchType] || 1;
  const basePull = PULL_COMP[input.stitchType] || 10;
  const fabricMod = FABRIC_PULL_MOD[input.fabricType] || 1;
  const pullCompensation = basePull * fabricMod;
  const compensatedWidthCm = widthCm * (1 + pullCompensation / 100);

  let fillStitches: number;
  if (input.stitchType === "run") {
    const perimeterCm = 2 * (compensatedWidthCm + heightCm);
    fillStitches = Math.round(perimeterCm * d * 10);
  } else if (input.stitchType === "satin") {
    const lengthCm = Math.max(compensatedWidthCm, heightCm);
    const columnWidthCm = Math.min(compensatedWidthCm, heightCm);
    fillStitches = Math.round(lengthCm * d * columnWidthCm * 10 * fillPct);
  } else {
    fillStitches = Math.round(areaCm2 * fillPct * d * d * tc);
  }

  const underlayKey = input.underlay || (input.stitchType === "run" ? "none" : "centre_run");
  const underlayStitches = Math.round(fillStitches * (UNDERLAY_FACTOR[underlayKey] || 0));

  let outlineStitches = 0;
  if (input.includeOutline) {
    const perimeterCm = 2 * (compensatedWidthCm + heightCm);
    outlineStitches = Math.round(perimeterCm * 4 * 2);
  }

  const colourChanges = Math.max(0, input.colourCount - 1);
  const trimCount = colourChanges + (input.includeOutline ? 1 : 0);
  const jumpStitches = trimCount * 3;
  const totalStitches = fillStitches + underlayStitches + outlineStitches + jumpStitches;

  const warnings: string[] = [];
  if (input.widthMm < 3 && input.stitchType === "satin") warnings.push("Design very narrow for satin stitch");
  if (totalStitches > 50000) warnings.push("High stitch count — check production time");

  return {
    totalStitches, fillStitches, underlayStitches, outlineStitches,
    trimCount, colourChanges, effectiveDensity: d, pullCompensation,
    warnings,
  };
}

const MACHINE_SPEEDS: Record<string, number> = {
  tajima: 1200, barudan: 1100, brother: 1000, generic: 1000,
};

function localEstimateTime(input: {
  totalStitches: number; colourChanges: number; trimCount: number;
  machine: string; speedPercentage: number; quantity: number; heads: number;
}): ProductionTimeResult {
  const maxSpeed = MACHINE_SPEEDS[input.machine] || 1000;
  const effectiveSpeed = Math.round(maxSpeed * (input.speedPercentage / 100));
  const stitchTimeMs = (input.totalStitches / effectiveSpeed) * 60 * 1000;
  const colourChangeTimeMs = input.colourChanges * 5000;
  const trimTimeMs = input.trimCount * 1500;
  const hoopingTimeMs = 30000;
  const perGarmentMs = stitchTimeMs + colourChangeTimeMs + trimTimeMs + hoopingTimeMs;
  const sewingPerGarment = stitchTimeMs + colourChangeTimeMs + trimTimeMs;
  const totalBatchMs = (sewingPerGarment / Math.max(1, input.heads)) * input.quantity + hoopingTimeMs * input.quantity;
  const garmentPerHour = totalBatchMs > 0 ? Math.round((3600000 / (totalBatchMs / input.quantity)) * 10) / 10 : 0;

  return {
    perGarmentMs,
    totalBatchMs,
    totalBatchFormatted: fmtDur(totalBatchMs),
    perGarmentFormatted: fmtDur(perGarmentMs),
    effectiveSpeed,
    garmentPerHour,
  };
}

function localEstimateCost(input: {
  totalStitches: number; colourChanges: number;
  productionTimeMs: number; threadMetres: number;
  quantity: number; ratePerK: number; setupFee: number; isRepeat: boolean;
}): CostResult {
  const setup = input.isRepeat ? 0 : input.setupFee;
  const stitchCost = (input.totalStitches / 1000) * input.ratePerK;
  const threadCost = input.threadMetres * 0.003;
  const minCharge = 3;
  const perGarmentCost = Math.round(Math.max(stitchCost + threadCost, minCharge) * 100) / 100;
  const totalCost = Math.round((perGarmentCost * input.quantity + setup) * 100) / 100;

  return {
    setupCost: setup,
    perGarmentCost,
    totalCost,
    priceBreakdown: [
      ...(setup > 0 ? [{ label: "Setup / Digitising", amount: setup }] : []),
      { label: `Embroidery (${(input.totalStitches / 1000).toFixed(1)}k × £${input.ratePerK.toFixed(2)})`, amount: Math.round(stitchCost * 100) / 100 },
      { label: "Thread", amount: Math.round(threadCost * 100) / 100 },
      { label: `Qty × ${input.quantity}`, amount: Math.round(perGarmentCost * input.quantity * 100) / 100 },
    ],
  };
}

function localEstimateNameDrops(input: {
  names: string[]; fontSizeMm: number; stitchType: string;
  maxWidthMm: number; density: number; fabricType: string;
}) {
  let totalStitches = 0;
  let maxWidth = 0;
  let longestName = "";

  const items = input.names.map((name) => {
    const charCount = name.replace(/\s/g, "").length;
    const spaceCount = (name.match(/\s/g) || []).length;
    const charWidthMm = input.fontSizeMm * 0.7;
    const spaceWidthMm = input.fontSizeMm * 0.4;
    const estimatedWidthMm = Math.round(charCount * charWidthMm + spaceCount * spaceWidthMm);
    const estimatedHeightMm = input.fontSizeMm;

    const warnings: string[] = [];
    if (estimatedWidthMm > input.maxWidthMm) {
      warnings.push(`"${name}" (${estimatedWidthMm}mm) exceeds max width`);
    }
    if (input.fontSizeMm < 5) {
      warnings.push("Font size below 5mm may not be readable");
    }

    const est = localEstimateStitches({
      widthMm: estimatedWidthMm,
      heightMm: estimatedHeightMm,
      fillPercentage: 50,
      stitchType: input.stitchType,
      density: input.density,
      fabricType: input.fabricType,
      includeOutline: false,
      colourCount: 1,
    });

    totalStitches += est.totalStitches;
    if (estimatedWidthMm > maxWidth) {
      maxWidth = estimatedWidthMm;
      longestName = name;
    }

    return { name, estimatedWidthMm, estimatedHeightMm, stitchCount: est.totalStitches, warnings };
  });

  return {
    items,
    totalStitches,
    averageStitchesPerName: items.length > 0 ? Math.round(totalStitches / items.length) : 0,
    longestName,
    maxWidthMm: maxWidth,
  };
}

function fmtDur(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
