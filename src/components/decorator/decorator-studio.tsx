"use client";

import {
  startTransition,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { cx } from "@/lib/presentation";
import type {
  DecoratorLayer,
  DecoratorProduct,
  DecoratorTemplate,
} from "@/lib/types";

type DragState = {
  id: string;
  pointerOriginX: number;
  pointerOriginY: number;
  layerOriginX: number;
  layerOriginY: number;
};

const studioThemes = {
  "PD-01": {
    stage:
      "radial-gradient(circle at 8% 14%, rgba(255,124,74,0.28), transparent 24%), radial-gradient(circle at 88% 10%, rgba(255,206,95,0.2), transparent 24%), linear-gradient(160deg, #11161f 0%, #0b1018 42%, #0a0f16 100%)",
    garment:
      "linear-gradient(180deg, rgba(248,240,230,1) 0%, rgba(224,214,201,1) 42%, rgba(187,174,159,1) 100%)",
    accent: "#ff7c4a",
    accentSoft: "rgba(255,124,74,0.22)",
    accentText: "#ffd8c9",
    proofLabel: "Ecom drop fit",
  },
  "PD-02": {
    stage:
      "radial-gradient(circle at 12% 12%, rgba(35,184,170,0.25), transparent 24%), radial-gradient(circle at 84% 16%, rgba(255,188,92,0.18), transparent 22%), linear-gradient(160deg, #0e1820 0%, #101d28 42%, #121f2a 100%)",
    garment:
      "linear-gradient(180deg, rgba(57,87,80,1) 0%, rgba(40,65,60,1) 42%, rgba(23,39,36,1) 100%)",
    accent: "#23b8aa",
    accentSoft: "rgba(35,184,170,0.2)",
    accentText: "#bbf1eb",
    proofLabel: "Retail capsule fit",
  },
} as const;

const templateSignals = {
  "TMP-1": {
    proofVersion: "Proof v04",
    printMethod: "Embroidery + screen",
  },
  "TMP-2": {
    proofVersion: "Proof v07",
    printMethod: "Oversize plastisol",
  },
} as const;

const fallbackProduct: DecoratorProduct = {
  id: "PD-01",
  name: "Decorator offline",
  brand: "Stash",
  sku: "STASH-FALLBACK",
  garmentColor: "Graphite",
  decorationArea: { width: 320, height: 240 },
};

const fallbackTemplate: DecoratorTemplate = {
  id: "TMP-1",
  name: "Fallback template",
  description: "Studio data not loaded yet.",
  layers: [
    {
      id: "LY-FALLBACK",
      name: "Placeholder",
      type: "text",
      color: "#f4efe7",
      x: 52,
      y: 72,
      width: 160,
      rotation: 0,
      opacity: 0.78,
      content: "Awaiting data",
    },
  ],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatZoneDimension(size: number) {
  return `${(size / 28).toFixed(1)} in`;
}

function clampLayersToDecorationArea(
  currentLayers: DecoratorLayer[],
  decorationArea: { width: number; height: number },
) {
  return currentLayers.map((layer) => {
    const nextWidth = clamp(layer.width, 48, Math.max(120, decorationArea.width - 20));

    return {
      ...layer,
      width: nextWidth,
      x: clamp(layer.x, 0, decorationArea.width - nextWidth),
      y: clamp(layer.y, 0, decorationArea.height - 42),
    };
  });
}

type DecoratorStudioProps = {
  products: DecoratorProduct[];
  templates: DecoratorTemplate[];
};

export function DecoratorStudio({
  products,
  templates,
}: DecoratorStudioProps) {
  const hasStudioData = products.length > 0 && templates.length > 0;
  const initialProduct = products[0] ?? fallbackProduct;
  const initialTemplate = templates[0] ?? fallbackTemplate;

  const [productId, setProductId] = useState(initialProduct.id);
  const [templateId, setTemplateId] = useState(initialTemplate.id);
  const [layers, setLayers] = useState<DecoratorLayer[]>(initialTemplate.layers);
  const [selectedLayerId, setSelectedLayerId] = useState(
    initialTemplate.layers[0]?.id ?? "",
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [stageGlow, setStageGlow] = useState({
    x: 52,
    y: 22,
    intensity: 0.4,
  });

  const product = useMemo(() => {
    const nextProduct = products.find((item) => item.id === productId);
    return nextProduct ?? products[0] ?? fallbackProduct;
  }, [productId, products]);
  const activeTemplate = useMemo(
    () =>
      templates.find((template) => template.id === templateId) ??
      templates[0] ??
      fallbackTemplate,
    [templateId, templates],
  );

  const theme = studioThemes[product.id as keyof typeof studioThemes] ?? studioThemes["PD-01"];
  const templateSignal =
    templateSignals[activeTemplate.id as keyof typeof templateSignals] ?? templateSignals["TMP-1"];
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId);
  const maxLayerWidth = Math.max(120, product.decorationArea.width - 20);
  const selectedLayerIndex =
    layers.length === 0
      ? 0
      : Math.max(layers.findIndex((layer) => layer.id === selectedLayerId) + 1, 1);
  const areaWidthLabel = formatZoneDimension(product.decorationArea.width);
  const areaHeightLabel = formatZoneDimension(product.decorationArea.height);

  const coverageScore = useMemo(
    () =>
      Math.min(
        98,
        Math.round(
          (layers.reduce((sum, layer) => sum + layer.width, 0) /
            (product.decorationArea.width * 1.7)) *
            100,
        ),
      ),
    [layers, product.decorationArea.width],
  );

  const averageOpacity = useMemo(
    () => {
      if (layers.length === 0) {
        return 0;
      }

      return Math.round(
        (layers.reduce((sum, layer) => sum + layer.opacity, 0) / layers.length) *
          100,
      );
    },
    [layers],
  );

  const applyTemplate = (nextTemplateId: string) => {
    const nextTemplate =
      templates.find((template) => template.id === nextTemplateId) ??
      templates[0];

    startTransition(() => {
      setTemplateId(nextTemplate.id);
      setLayers(clampLayersToDecorationArea(nextTemplate.layers, product.decorationArea));
      setSelectedLayerId(nextTemplate.layers[0]?.id ?? "");
    });
  };

  const centerSelectedLayer = () => {
    if (!selectedLayer) {
      return;
    }

    setLayers((currentLayers) =>
      currentLayers.map((layer) =>
        layer.id === selectedLayer.id
          ? {
              ...layer,
              x: Math.round((product.decorationArea.width - layer.width) / 2),
              y: Math.round((product.decorationArea.height - 42) / 2),
            }
          : layer,
      ),
    );
  };

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    if (!dragState) {
      return;
    }

    const dx = event.clientX - dragState.pointerOriginX;
    const dy = event.clientY - dragState.pointerOriginY;

    setLayers((currentLayers) =>
      currentLayers.map((layer) => {
        if (layer.id !== dragState.id) {
          return layer;
        }

        const maxX = product.decorationArea.width - layer.width;
        const maxY = product.decorationArea.height - 42;

        return {
          ...layer,
          x: clamp(dragState.layerOriginX + dx, 0, maxX),
          y: clamp(dragState.layerOriginY + dy, 0, maxY),
        };
      }),
    );
  });

  const handleStagePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setStageGlow({
      x: clamp(x, 0, 100),
      y: clamp(y, 0, 100),
      intensity: 0.72,
    });
  };

  const handleStagePointerLeave = () => {
    setStageGlow((current) => ({
      ...current,
      intensity: 0.38,
    }));
  };

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handlePointerUp = () => setDragState(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState]);

  return (
    <div className="space-y-5">
      <section className="surface-raised p-4 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="min-w-0">
            <p className="eyebrow">Design Operating Room</p>
            <h2 className="mt-3 break-words pb-[0.16em] text-[clamp(1.8rem,4vw,3.2rem)] leading-[1.12] tracking-[-0.02em] [font-family:var(--font-display)]" style={{ color: "var(--text-primary)" }}>
              Precision designer. No Deco UI.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
              Keep the entire customization experience inside Stash while your
              backend controls proof payloads, approvals, and production data.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="pill pill--ghost">{product.sku}</span>
              <span className="pill pill--ghost">{templateSignal.proofVersion}</span>
              <span className="pill pill--ghost">{templateSignal.printMethod}</span>
              <span className="pill pill--ghost">{layers.length} layers</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
            <div className="card px-4 py-3">
              <p className="eyebrow">Coverage</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
                {coverageScore}%
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${coverageScore}%`,
                    background: `linear-gradient(90deg, ${theme.accent}, #efbb52)`,
                  }}
                />
              </div>
            </div>
            <div className="card px-4 py-3">
              <p className="eyebrow">Opacity Average</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
                {averageOpacity}%
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
                {theme.proofLabel}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)] 2xl:grid-cols-[290px_minmax(0,1fr)_320px]">
        <aside className="space-y-4">
          <div className="surface p-4">
            <p className="eyebrow">Garments</p>
            <div className="mt-4 space-y-2.5">
              {products.map((item) => {
                const active = item.id === productId;
                const itemTheme = studioThemes[item.id as keyof typeof studioThemes];

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      startTransition(() => {
                        setProductId(item.id);
                        setLayers((currentLayers) =>
                          clampLayersToDecorationArea(
                            currentLayers,
                            item.decorationArea,
                          ),
                        );
                      })
                    }
                    className={cx(
                      "w-full rounded-xl border px-3.5 py-3 text-left transition",
                      active
                        ? "border-[var(--border-active)] bg-[var(--bg-surface-hover)]"
                        : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-surface-hover)]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 h-10 w-10 rounded-xl border border-white/18"
                        style={{ background: itemTheme.garment }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-5" style={{ color: "var(--text-primary)" }}>
                          {item.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                          {item.brand} · {item.garmentColor}
                        </p>
                        <p className="mt-1.5 text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
                          {item.sku}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="surface p-4">
            <p className="eyebrow">Templates</p>
            <div className="mt-4 space-y-2.5">
              {templates.map((template) => {
                const active = template.id === templateId;
                const signal =
                  templateSignals[template.id as keyof typeof templateSignals];

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.id)}
                    className={cx(
                      "w-full rounded-xl border px-3.5 py-3 text-left transition",
                      active
                        ? "border-[var(--border-active)] bg-[var(--bg-surface-hover)]"
                        : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-surface-hover)]",
                    )}
                  >
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{template.name}</p>
                    <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                      {template.description}
                    </p>
                    <p className="mt-1.5 text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
                      {signal.printMethod}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section
          className="studio-stage-interactive relative overflow-hidden rounded-[2rem] border border-white/10 p-4 sm:p-5 lg:p-6"
          onPointerMove={handleStagePointerMove}
          onPointerLeave={handleStagePointerLeave}
          style={
            {
              background: theme.stage,
              "--mouse-x": `${stageGlow.x}%`,
              "--mouse-y": `${stageGlow.y}%`,
              "--glow-strength": stageGlow.intensity.toString(),
            } as CSSProperties
          }
        >
          <div
            className="studio-orb studio-orb--one"
            style={{ background: `${theme.accent}66` }}
          />
          <div
            className="studio-orb studio-orb--two"
            style={{ background: `${theme.accent}33` }}
          />
          <div
            className="studio-orb studio-orb--three"
            style={{ background: "rgba(122, 209, 255, 0.28)" }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_25px,rgba(255,255,255,0.04)_26px),linear-gradient(90deg,transparent_25px,rgba(255,255,255,0.04)_26px)] bg-[size:26px_26px] opacity-30" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.12),transparent_38%)]" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: theme.accent }}
              />
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                Live canvas
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="studio-glass-chip rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/75">
                {areaWidthLabel} x {areaHeightLabel}
              </span>
              <span className="studio-glass-chip rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/75">
                {templateSignal.proofVersion}
              </span>
            </div>
          </div>

          <div className="studio-canvas-shell relative mt-5 flex min-h-[520px] items-center justify-center overflow-hidden rounded-[1.6rem] p-4 sm:min-h-[620px] sm:p-5 lg:min-h-[700px]">
            <div className="studio-floating-chip pointer-events-none absolute left-4 top-4 rounded-[1rem] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/70">
              Drag and place
            </div>
            <div className="studio-floating-chip pointer-events-none absolute right-4 top-4 rounded-[1rem] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/70">
              {theme.proofLabel}
            </div>

            <div className="relative mx-auto h-[500px] w-full max-w-[420px] sm:h-[560px]">
              <div
                className="absolute inset-x-8 top-0 h-16 rounded-b-[2.6rem] border-x border-b border-white/10"
                style={{ background: "rgba(0,0,0,0.18)" }}
              />
              <div
                className="absolute -left-8 top-[110px] h-[150px] w-[88px] rotate-[18deg] rounded-[2.3rem] border border-white/12"
                style={{ background: theme.garment }}
              />
              <div
                className="absolute -right-8 top-[110px] h-[150px] w-[88px] -rotate-[18deg] rounded-[2.3rem] border border-white/12"
                style={{ background: theme.garment }}
              />
              <div
                className="absolute inset-x-0 top-8 bottom-0 rounded-[3.2rem] border border-white/12 shadow-[0_30px_64px_rgba(0,0,0,0.28)]"
                style={{ background: theme.garment }}
              >
                <div className="absolute inset-x-[13%] top-[16%] h-px bg-white/25" />
                <div className="absolute inset-x-[12%] top-[23%] h-px bg-black/10" />
                <div className="absolute bottom-0 left-[18%] right-[18%] h-24 rounded-t-[1.7rem] border-x border-t border-black/10 bg-white/5" />
              </div>

              <div
                className="absolute left-1/2 top-[110px] -translate-x-1/2 rounded-[1.6rem] border border-dashed border-white/20 bg-black/24 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                style={{
                  width: product.decorationArea.width,
                  height: product.decorationArea.height,
                }}
              >
                <div className="pointer-events-none absolute inset-4 rounded-[1.2rem] border border-white/8" />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/8" />
                <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/8" />

                {layers.map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    onPointerDown={(event) => {
                      setSelectedLayerId(layer.id);
                      setDragState({
                        id: layer.id,
                        pointerOriginX: event.clientX,
                        pointerOriginY: event.clientY,
                        layerOriginX: layer.x,
                        layerOriginY: layer.y,
                      });
                    }}
                    className={cx(
                      "absolute cursor-grab rounded-[0.9rem] border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] active:cursor-grabbing",
                      layer.id === selectedLayerId
                        ? "border-white/35 bg-white/15 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_14px_32px_rgba(0,0,0,0.26)]"
                        : "border-white/15 bg-black/34 hover:border-white/24 hover:bg-black/45",
                    )}
                    style={{
                      left: layer.x,
                      top: layer.y,
                      width: layer.width,
                      color: layer.color,
                      opacity: layer.opacity,
                      transform: `rotate(${layer.rotation}deg)`,
                    }}
                  >
                    <span className="block break-words leading-[1.35]">{layer.content}</span>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="studio-accent-chip pointer-events-none absolute bottom-8 left-8 rounded-[1.2rem] px-3 py-2 text-xs"
              style={{
                background: theme.accentSoft,
                color: theme.accentText,
              }}
            >
              {templateSignal.printMethod}
            </div>
          </div>
        </section>

        <aside className="space-y-4 xl:col-span-2 2xl:col-span-1">
          <div className="surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="eyebrow">Layers</p>
              <span className="pill pill--ghost">
                {selectedLayerIndex}/{layers.length}
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              {layers.map((layer, index) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={cx(
                    "w-full rounded-xl border px-3.5 py-3 text-left transition",
                    layer.id === selectedLayerId
                      ? "border-[var(--border-active)] bg-[var(--bg-surface-hover)]"
                      : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-surface-hover)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {layer.name}
                      </p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
                        {layer.type}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="eyebrow">Selected Layer</p>
              <button
                type="button"
                onClick={centerSelectedLayer}
                className="pill pill--ghost transition hover:border-[rgba(255,255,255,0.14)] hover:text-[var(--text-primary)]"
              >
                Center
              </button>
            </div>

            {selectedLayer ? (
              <div className="mt-4 space-y-4">
                <div className="card px-3.5 py-3">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {selectedLayer.name}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {selectedLayer.content}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary)" }}>
                    <span>x {Math.round(selectedLayer.x)}</span>
                    <span>y {Math.round(selectedLayer.y)}</span>
                    <span>w {Math.round(selectedLayer.width)}</span>
                  </div>
                </div>

                <label className="block">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span>Width</span>
                    <span className="pill pill--ghost">{Math.round(selectedLayer.width)} px</span>
                  </div>
                  <input
                    type="range"
                    min={48}
                    max={maxLayerWidth}
                    value={selectedLayer.width}
                    onChange={(event) =>
                      setLayers((currentLayers) =>
                        currentLayers.map((layer) =>
                          layer.id === selectedLayer.id
                            ? {
                                ...layer,
                                width: clamp(Number(event.target.value), 48, maxLayerWidth),
                                x: clamp(
                                  layer.x,
                                  0,
                                  product.decorationArea.width -
                                    clamp(
                                      Number(event.target.value),
                                      48,
                                      maxLayerWidth,
                                    ),
                                ),
                              }
                            : layer,
                        ),
                      )
                    }
                    className="studio-range mt-3"
                  />
                </label>

                <label className="block">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span>Rotation</span>
                    <span className="pill pill--ghost">{selectedLayer.rotation} deg</span>
                  </div>
                  <input
                    type="range"
                    min={-20}
                    max={20}
                    value={selectedLayer.rotation}
                    onChange={(event) =>
                      setLayers((currentLayers) =>
                        currentLayers.map((layer) =>
                          layer.id === selectedLayer.id
                            ? {
                                ...layer,
                                rotation: Number(event.target.value),
                              }
                            : layer,
                        ),
                      )
                    }
                    className="studio-range mt-3"
                  />
                </label>

                <label className="block">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span>Opacity</span>
                    <span className="pill pill--ghost">{Math.round(selectedLayer.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={1}
                    step={0.05}
                    value={selectedLayer.opacity}
                    onChange={(event) =>
                      setLayers((currentLayers) =>
                        currentLayers.map((layer) =>
                          layer.id === selectedLayer.id
                            ? {
                                ...layer,
                                opacity: Number(event.target.value),
                              }
                            : layer,
                        ),
                      )
                    }
                    className="studio-range mt-3"
                  />
                </label>
              </div>
            ) : null}
          </div>

          <div className="surface p-4">
            <p className="eyebrow">Production Packet</p>
              <div className="mt-4 space-y-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                <div className="card flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span>Decoration Area</span>
                  <span className="font-medium sm:max-w-[65%] sm:text-right" style={{ color: "var(--text-primary)" }}>
                    {areaWidthLabel} x {areaHeightLabel}
                  </span>
                </div>
                <div className="card flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span>Template</span>
                  <span className="font-medium sm:max-w-[65%] sm:text-right" style={{ color: "var(--text-primary)" }}>
                    {activeTemplate.name}
                  </span>
                </div>
                <div className="card flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span>Proof Version</span>
                  <span className="font-medium sm:max-w-[65%] sm:text-right" style={{ color: "var(--text-primary)" }}>
                    {templateSignal.proofVersion}
                  </span>
                </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
