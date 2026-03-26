"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDecoratorStore } from "./store";
import { VIEWS, type ViewKey } from "./types";
import { colorToCss } from "@/lib/color-map";

/* ═══════════════════════════════════════════════════════════
   View Sidebar — left panel with views, zones, colour selector
   ═══════════════════════════════════════════════════════════ */

export function ViewSidebar() {
  const {
    product,
    activeView,
    activeZoneKey,
    zones,
    selectedColorId,
    zoneConfigs,
    objects,
    setActiveView,
    setActiveZone,
    setSelectedColor,
  } = useDecoratorStore(
    useShallow((s) => ({
      product: s.product,
      activeView: s.activeView,
      activeZoneKey: s.activeZoneKey,
      zones: s.zones,
      selectedColorId: s.selectedColorId,
      zoneConfigs: s.zoneConfigs,
      objects: s.objects,
      setActiveView: s.setActiveView,
      setActiveZone: s.setActiveZone,
      setSelectedColor: s.setSelectedColor,
    }))
  );

  const viewZones = zones.filter((z) => z.view === activeView);
  const configuredKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const o of objects) keys.add(o.zoneKey);
    for (const [k, v] of Object.entries(zoneConfigs)) {
      if (v.decorationMethod) keys.add(k);
    }
    return Array.from(keys);
  }, [objects, zoneConfigs]);

  const colors = product?.colors ?? [];
  const images = product?.images ?? [];

  // Build effective colour list
  const imageColorNames = new Set<string>();
  for (const img of images) {
    if (img.color && img.type === "front") imageColorNames.add(img.color);
  }
  const effectiveColors = colors.length > 0 ? colors : Array.from(imageColorNames).map((name, i) => ({
    id: -(i + 1),
    name,
  }));

  return (
    <div
      className="flex h-full w-[220px] shrink-0 flex-col overflow-y-auto"
      style={{ background: "rgba(15,15,25,0.95)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Product name */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary, #64748b)" }}>
          Product
        </p>
        <p className="mt-1 text-sm font-semibold truncate" style={{ color: "var(--text-primary, #f1f5f9)" }}>
          {product?.productName ?? "No product"}
        </p>
        {product?.productCode && (
          <p className="mt-0.5 text-xs font-mono" style={{ color: "var(--accent-light, #a5b4fc)" }}>
            {product.productCode}
          </p>
        )}
      </div>

      {/* Views */}
      <div className="px-3 pt-3 pb-1">
        <p className="px-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary, #64748b)" }}>
          Views
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1 px-3 pb-3">
        {VIEWS.filter((v) => zones.some((z) => z.view === v.key)).map((v) => {
          const isActive = activeView === v.key;
          const hasObjects = zones
            .filter((z) => z.view === v.key)
            .some((z) => configuredKeys.includes(z.key));
          return (
            <button
              key={v.key}
              onClick={() => setActiveView(v.key)}
              className="relative rounded-lg px-3 py-2 text-xs font-medium transition-all"
              style={
                isActive
                  ? { background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.4)" }
                  : { background: "rgba(255,255,255,0.03)", color: "var(--text-secondary, #94a3b8)", border: "1px solid rgba(255,255,255,0.06)" }
              }
            >
              {v.label}
              {hasObjects && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Zones for current view */}
      <div className="px-3 pb-1">
        <p className="px-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary, #64748b)" }}>
          Zones — {VIEWS.find((v) => v.key === activeView)?.label}
        </p>
      </div>
      <div className="flex flex-col gap-0.5 px-3 pb-3">
        {viewZones.map((zone) => {
          const isActive = zone.key === activeZoneKey;
          const isConfigured = configuredKeys.includes(zone.key);
          const config = zoneConfigs[zone.key];
          const objCount = objects.filter((o) => o.zoneKey === zone.key).length;
          return (
            <button
              key={zone.key}
              onClick={() => setActiveZone(zone.key)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-all"
              style={
                isActive
                  ? { background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }
                  : { background: "transparent", color: "var(--text-secondary, #94a3b8)", border: "1px solid transparent" }
              }
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: isConfigured ? "#10b981" : "rgba(148,163,184,0.3)" }}
              />
              <span className="flex-1 truncate font-medium">{zone.label}</span>
              {objCount > 0 && (
                <span className="shrink-0 text-[10px]" style={{ color: "var(--text-tertiary, #64748b)" }}>
                  {objCount}
                </span>
              )}
              {config?.decorationMethod && (
                <span className="shrink-0 text-[10px] font-mono" style={{ color: "var(--text-tertiary, #64748b)" }}>
                  {config.decorationMethod}
                </span>
              )}
            </button>
          );
        })}
        {viewZones.length === 0 && (
          <p className="px-3 py-2 text-xs" style={{ color: "var(--text-tertiary, #64748b)" }}>
            No zones on this view
          </p>
        )}
      </div>

      {/* Colour Palette */}
      {effectiveColors.length > 0 && (
        <div className="mt-auto border-t px-3 pt-3 pb-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="px-1 mb-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-tertiary, #64748b)" }}>
            Colour
          </p>
          <div className="flex flex-wrap gap-1.5">
            {effectiveColors.map((c) => {
              const hex = colorToCss(c.name) ?? "#94a3b8";
              const isActive = selectedColorId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedColor(c.id)}
                  title={c.name}
                  className="relative h-7 w-7 rounded-full transition-all"
                  style={{
                    background: hex,
                    border: isActive ? "2px solid #a5b4fc" : "2px solid rgba(255,255,255,0.1)",
                    boxShadow: isActive ? "0 0 0 2px rgba(99,102,241,0.4)" : undefined,
                  }}
                />
              );
            })}
          </div>
          {selectedColorId != null && effectiveColors.length > 0 && (
            <p className="mt-2 text-xs truncate" style={{ color: "var(--text-secondary, #94a3b8)" }}>
              {effectiveColors.find((c) => c.id === selectedColorId)?.name ?? "Unknown"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
