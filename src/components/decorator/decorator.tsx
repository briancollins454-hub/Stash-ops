"use client";

import { useEffect, useMemo, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDecoratorStore } from "./store";
import { CanvasEngine } from "./canvas-engine";
import { ViewSidebar } from "./view-sidebar";
import { Toolbar } from "./toolbar";
import { PropertiesPanel } from "./properties-panel";
import type { DesignConfig, DesignerProductDetail } from "./types";

/* ═══════════════════════════════════════════════════════════
   Decorator — full-screen decoration studio
   ═══════════════════════════════════════════════════════════ */

interface DecoratorProps {
  open: boolean;
  onClose: () => void;
  onApply: (designs: DesignConfig[]) => void;
  productDetail: DesignerProductDetail;
  selectedColorId?: number;
  initialDesigns?: DesignConfig[];
  accountId?: string;
}

export function Decorator({
  open,
  onClose,
  onApply,
  productDetail,
  selectedColorId: initColorId,
  initialDesigns,
  accountId,
}: DecoratorProps) {
  const { init, exportDesigns, activeView, garmentColorHex, garmentType, selectedColorId, isDirty, product } = useDecoratorStore(
    useShallow((s) => ({
      init: s.init,
      exportDesigns: s.exportDesigns,
      activeView: s.activeView,
      garmentColorHex: s.garmentColorHex,
      garmentType: s.garmentType,
      selectedColorId: s.selectedColorId,
      isDirty: s.isDirty,
      product: s.product,
    }))
  );

  // Initialize store when opened
  useEffect(() => {
    if (open && productDetail) {
      init(productDetail, initColorId, initialDesigns);
    }
  }, [open, productDetail, initColorId, initialDesigns, init]);

  // Resolve background image URL for current view + colour
  const backgroundImageUrl = useMemo(() => {
    if (!product?.images) return undefined;
    const imgs = product.images;

    // Map view to image type
    const viewToType: Record<string, string> = {
      front: "front",
      back: "back",
      left: "side",
      right: "side",
    };
    const imgType = viewToType[activeView] ?? "front";

    // Get selected colour name for matching
    const selColor = product.colors.find((c) => c.id === selectedColorId);
    const colorName = selColor?.name?.toLowerCase();

    // Fuzzy colour match — handles "Navy/red" vs "Navy", "Baby Pink" vs "BabyPink"
    const colorMatch = (imgColor?: string) => {
      if (!colorName || !imgColor) return false;
      const ic = imgColor.toLowerCase().replace(/\s+/g, "");
      const cn = colorName.replace(/\s+/g, "");
      return ic === cn || cn.split("/").some((part) => ic === part.trim().replace(/\s+/g, ""));
    };

    // 1) Exact colour + view match — best case
    if (selColor) {
      const exact = imgs.find((i) => i.type === imgType && colorMatch(i.color));
      if (exact) return exact.url;
    }

    // 2) Front view: fallback chain
    if (activeView === "front") {
      if (selColor) {
        const cm = imgs.find((i) => i.type === "front" && colorMatch(i.color));
        if (cm) return cm.url;
      }
      const genericFront = imgs.find((i) => i.type === "front");
      if (genericFront) return genericFront.url;
      const gallery = imgs.find((i) => i.type === "gallery");
      if (gallery) return gallery.url;
      return imgs[0]?.url;
    }

    // 3) Non-front views: colour-matched only, else undefined (show colour fill)
    const typeMatch = imgs.find((i) => i.type === imgType && colorMatch(i.color));
    if (typeMatch) return typeMatch.url;

    // Try any image of the right type even without colour match
    const anyType = imgs.find((i) => i.type === imgType);
    if (anyType) return anyType.url;

    return undefined;
  }, [product, activeView, selectedColorId]);

  const handleApply = useCallback(() => {
    const designs = exportDesigns();
    onApply(designs);
  }, [exportDesigns, onApply]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm("You have unsaved changes. Discard and close?");
      if (!confirmed) return;
    }
    onClose();
  }, [isDirty, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "#0a0a14" }}
    >
      {/* Header */}
      <div
        className="flex h-12 shrink-0 items-center justify-between px-4"
        style={{ background: "rgba(15,15,25,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 text-xs transition-all hover:brightness-125"
            style={{ color: "var(--text-tertiary, #64748b)" }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="h-5 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          <span className="text-sm font-bold" style={{ color: "var(--text-primary, #f1f5f9)" }}>
            Decoration Studio
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--accent-light, #a5b4fc)" }}>
            {productDetail.productCode}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Configured zones count */}
          <ConfiguredBadge />

          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-1.5 text-xs font-medium transition-all hover:brightness-125"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary, #94a3b8)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold transition-all hover:brightness-125"
            style={{ background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.4)" }}
          >
            Apply Design
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar />

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <ViewSidebar />

        {/* Canvas */}
        <CanvasEngine
          view={activeView}
          backgroundImageUrl={backgroundImageUrl}
          garmentColorHex={garmentColorHex}
          garmentType={garmentType}
        />

        {/* Right panel */}
        <PropertiesPanel accountId={accountId} />
      </div>

      {/* Footer */}
      <div
        className="flex h-10 shrink-0 items-center justify-between px-4"
        style={{ background: "rgba(15,15,25,0.98)", borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-4">
          <FooterInfo />
        </div>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-tertiary, #64748b)" }}>
          <span>⌘Z Undo</span>
          <span>⌘⇧Z Redo</span>
          <span>⌘D Duplicate</span>
          <span>⌫ Delete</span>
          <span>Arrow keys nudge</span>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function ConfiguredBadge() {
  const objects = useDecoratorStore((s) => s.objects);
  const zoneConfigs = useDecoratorStore((s) => s.zoneConfigs);
  const zoneCount = useDecoratorStore((s) => s.zones.length);

  const configuredCount = useMemo(() => {
    const keys = new Set<string>();
    for (const o of objects) keys.add(o.zoneKey);
    for (const [k, v] of Object.entries(zoneConfigs)) {
      if (v.decorationMethod) keys.add(k);
    }
    return keys.size;
  }, [objects, zoneConfigs]);

  if (configuredCount === 0) return null;

  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
      style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.25)" }}
    >
      {configuredCount}/{zoneCount} zones configured
    </span>
  );
}

function FooterInfo() {
  const objectCount = useDecoratorStore((s) => s.objects.length);
  const activeZoneKey = useDecoratorStore((s) => s.activeZoneKey);
  const zones = useDecoratorStore((s) => s.zones);
  const activeZone = zones.find((z) => z.key === activeZoneKey);

  return (
    <>
      <span className="text-[11px]" style={{ color: "var(--text-tertiary, #64748b)" }}>
        {objectCount} object{objectCount !== 1 ? "s" : ""}
      </span>
      {activeZone && (
        <>
          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.08)" }}>|</span>
          <span className="text-[11px]" style={{ color: "var(--text-tertiary, #64748b)" }}>
            Zone: {activeZone.label}
            {activeZone.actualWidthMm && activeZone.actualHeightMm && (
              <> ({activeZone.actualWidthMm}×{activeZone.actualHeightMm}mm)</>
            )}
          </span>
        </>
      )}
    </>
  );
}
