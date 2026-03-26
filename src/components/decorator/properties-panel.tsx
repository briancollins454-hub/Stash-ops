"use client";

import { useState, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDecoratorStore } from "./store";
import {
  DECORATION_METHODS,
  SIZE_PRESETS,
  GARMENT_REF_CM,
  IMAGE_EXTENSIONS,
  VECTOR_EXTENSIONS,
  EMBROIDERY_EXTENSIONS,
  MAX_FILE_BYTES,
  fileExt,
  generateId,
  type DesignObject,
  type UploadedFile,
} from "./types";

/* ═══════════════════════════════════════════════════════════
   Properties Panel — right sidebar with tabs
   ═══════════════════════════════════════════════════════════ */

const QUICK_NOTES = [
  "Customer supplied artwork",
  "Artwork needs vectorising",
  "Match PMS colour exactly",
  "Use white underbase",
  "Check stitch count with digitiser",
  "Needs customer approval",
  "Rush job — priority",
  "Reorder — use previous setup",
];

const FONTS = [
  "Plus Jakarta Sans", "Inter", "Arial", "Helvetica", "Georgia",
  "Times New Roman", "Courier New", "Impact", "Verdana", "Trebuchet MS",
  "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald",
];

export function PropertiesPanel() {
  const {
    rightPanel,
    activeZoneKey,
    selectedObjectIds,
    objects,
    zones,
    zoneConfigs,
    garmentType,
    uploads,
    setRightPanel,
    updateObject,
    setZoneConfig,
    addText,
    addImage,
    addUpload,
    removeUpload,
    deleteSelected,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
  } = useDecoratorStore(
    useShallow((s) => ({
      rightPanel: s.rightPanel,
      activeZoneKey: s.activeZoneKey,
      selectedObjectIds: s.selectedObjectIds,
      objects: s.objects,
      zones: s.zones,
      zoneConfigs: s.zoneConfigs,
      garmentType: s.garmentType,
      uploads: s.uploads,
      setRightPanel: s.setRightPanel,
      updateObject: s.updateObject,
      setZoneConfig: s.setZoneConfig,
      addText: s.addText,
      addImage: s.addImage,
      addUpload: s.addUpload,
      removeUpload: s.removeUpload,
      deleteSelected: s.deleteSelected,
      bringForward: s.bringForward,
      sendBackward: s.sendBackward,
      bringToFront: s.bringToFront,
      sendToBack: s.sendToBack,
    }))
  );

  const activeZone = zones.find((z) => z.key === activeZoneKey);
  const selectedObj = selectedObjectIds.length === 1
    ? objects.find((o) => o.id === selectedObjectIds[0])
    : undefined;
  const config = zoneConfigs[activeZoneKey];
  const ref = GARMENT_REF_CM[garmentType] ?? { w: 50, h: 70 };

  const tabs: Array<{ key: typeof rightPanel; label: string }> = [
    { key: "properties", label: "Properties" },
    { key: "method", label: "Method" },
    { key: "artwork", label: "Artwork" },
    { key: "text", label: "Text" },
    { key: "notes", label: "Notes" },
  ];

  return (
    <div
      className="flex h-full w-[320px] shrink-0 flex-col overflow-hidden"
      style={{ background: "rgba(15,15,25,0.95)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Tab buttons */}
      <div className="flex shrink-0 overflow-x-auto border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setRightPanel(t.key)}
            className="whitespace-nowrap px-3 py-2.5 text-[11px] font-medium tracking-wider uppercase transition-all"
            style={
              rightPanel === t.key
                ? { color: "#a5b4fc", borderBottom: "2px solid #6366f1" }
                : { color: "var(--text-tertiary, #64748b)", borderBottom: "2px solid transparent" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {rightPanel === "properties" && (
          <PropertiesTab
            selectedObj={selectedObj}
            activeZone={activeZone}
            garmentRef={ref}
            onUpdate={updateObject}
            onBringForward={bringForward}
            onSendBackward={sendBackward}
            onBringToFront={bringToFront}
            onSendToBack={sendToBack}
            onDelete={deleteSelected}
          />
        )}
        {rightPanel === "method" && (
          <MethodTab
            zoneKey={activeZoneKey}
            config={config}
            onSetConfig={setZoneConfig}
          />
        )}
        {rightPanel === "artwork" && (
          <ArtworkTab
            zoneKey={activeZoneKey}
            uploads={uploads}
            onAddImage={addImage}
            onAddUpload={addUpload}
            onRemoveUpload={removeUpload}
          />
        )}
        {rightPanel === "text" && (
          <TextTab
            zoneKey={activeZoneKey}
            selectedObj={selectedObj}
            onAddText={addText}
            onUpdate={updateObject}
          />
        )}
        {rightPanel === "notes" && (
          <NotesTab
            zoneKey={activeZoneKey}
            config={config}
            onSetConfig={setZoneConfig}
          />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Properties Tab — transforms, size, layer order
   ═══════════════════════════════════════════════════════════ */

function PropertiesTab({
  selectedObj,
  activeZone,
  garmentRef,
  onUpdate,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onDelete,
}: {
  selectedObj?: DesignObject;
  activeZone?: { key: string; label: string; actualWidthMm?: number; actualHeightMm?: number };
  garmentRef: { w: number; h: number };
  onUpdate: (id: string, changes: Partial<DesignObject>) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onDelete: () => void;
}) {
  if (!selectedObj) {
    return (
      <div className="space-y-4">
        <EmptyState icon="↖" text="Select an object to see its properties" />
        {activeZone && (
          <div className="space-y-2">
            <SectionHeader>Active zone</SectionHeader>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary, #f1f5f9)" }}>{activeZone.label}</p>
            {activeZone.actualWidthMm && activeZone.actualHeightMm && (
              <p className="text-xs" style={{ color: "var(--text-tertiary, #64748b)" }}>
                Max: {activeZone.actualWidthMm}mm × {activeZone.actualHeightMm}mm
              </p>
            )}
          </div>
        )}
        <SizePresets garmentRef={garmentRef} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span
          className="rounded px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wider"
          style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}
        >
          {selectedObj.type}
        </span>
        {selectedObj.imageName && (
          <span className="truncate text-xs" style={{ color: "var(--text-secondary, #94a3b8)" }}>
            {selectedObj.imageName}
          </span>
        )}
      </div>

      {/* Position */}
      <div>
        <SectionHeader>Position & Size</SectionHeader>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="X %" value={selectedObj.x} onChange={(v) => onUpdate(selectedObj.id, { x: v })} min={0} max={100} step={0.5} />
          <NumField label="Y %" value={selectedObj.y} onChange={(v) => onUpdate(selectedObj.id, { y: v })} min={0} max={100} step={0.5} />
          <NumField label="W %" value={selectedObj.w} onChange={(v) => {
            if (selectedObj.lockAspect && selectedObj.w > 0) {
              const ratio = selectedObj.h / selectedObj.w;
              onUpdate(selectedObj.id, { w: v, h: +(v * ratio).toFixed(2) });
            } else {
              onUpdate(selectedObj.id, { w: v });
            }
          }} min={1} max={100} step={0.5} />
          <NumField label="H %" value={selectedObj.h} onChange={(v) => {
            if (selectedObj.lockAspect && selectedObj.h > 0) {
              const ratio = selectedObj.w / selectedObj.h;
              onUpdate(selectedObj.id, { h: v, w: +(v * ratio).toFixed(2) });
            } else {
              onUpdate(selectedObj.id, { h: v });
            }
          }} min={1} max={100} step={0.5} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumField label="W (cm)" value={+((selectedObj.w / 100) * garmentRef.w).toFixed(1)} onChange={(v) => {
            const wPct = (v / garmentRef.w) * 100;
            if (selectedObj.lockAspect && selectedObj.w > 0) {
              const ratio = selectedObj.h / selectedObj.w;
              onUpdate(selectedObj.id, { w: +wPct.toFixed(2), h: +(wPct * ratio).toFixed(2) });
            } else {
              onUpdate(selectedObj.id, { w: +wPct.toFixed(2) });
            }
          }} min={0.5} max={garmentRef.w} step={0.5} />
          <NumField label="H (cm)" value={+((selectedObj.h / 100) * garmentRef.h).toFixed(1)} onChange={(v) => {
            const hPct = (v / garmentRef.h) * 100;
            if (selectedObj.lockAspect && selectedObj.h > 0) {
              const ratio = selectedObj.w / selectedObj.h;
              onUpdate(selectedObj.id, { h: +hPct.toFixed(2), w: +(hPct * ratio).toFixed(2) });
            } else {
              onUpdate(selectedObj.id, { h: +hPct.toFixed(2) });
            }
          }} min={0.5} max={garmentRef.h} step={0.5} />
        </div>
      </div>

      {/* Rotation */}
      <div>
        <SectionHeader>Rotation</SectionHeader>
        <div className="flex items-center gap-2">
          <NumField label="°" value={selectedObj.rotation} onChange={(v) => onUpdate(selectedObj.id, { rotation: v })} min={-360} max={360} step={1} />
          <button onClick={() => onUpdate(selectedObj.id, { rotation: 0 })} className="text-xs underline" style={{ color: "var(--text-tertiary, #64748b)" }}>Reset</button>
        </div>
      </div>

      {/* Flip / Lock */}
      <div>
        <SectionHeader>Transform</SectionHeader>
        <div className="flex flex-wrap gap-2">
          <SmallToggle
            label="Flip H"
            active={selectedObj.flipH}
            onClick={() => onUpdate(selectedObj.id, { flipH: !selectedObj.flipH })}
          />
          <SmallToggle
            label="Flip V"
            active={selectedObj.flipV}
            onClick={() => onUpdate(selectedObj.id, { flipV: !selectedObj.flipV })}
          />
          <SmallToggle
            label="Lock Aspect"
            active={selectedObj.lockAspect}
            onClick={() => onUpdate(selectedObj.id, { lockAspect: !selectedObj.lockAspect })}
          />
          <SmallToggle
            label="Lock Position"
            active={selectedObj.locked}
            onClick={() => onUpdate(selectedObj.id, { locked: !selectedObj.locked })}
          />
        </div>
      </div>

      {/* Opacity */}
      <div>
        <SectionHeader>Opacity</SectionHeader>
        <input
          type="range"
          min={0} max={1} step={0.05}
          value={selectedObj.opacity}
          onChange={(e) => onUpdate(selectedObj.id, { opacity: parseFloat(e.target.value) })}
          className="w-full accent-indigo-500"
        />
        <p className="text-[11px]" style={{ color: "var(--text-tertiary, #64748b)" }}>{Math.round(selectedObj.opacity * 100)}%</p>
      </div>

      {/* Layer ordering */}
      <div>
        <SectionHeader>Layer Order</SectionHeader>
        <div className="flex gap-1">
          <SmallBtn label="↑ Front" onClick={() => onBringToFront(selectedObj.id)} />
          <SmallBtn label="↑" onClick={() => onBringForward(selectedObj.id)} />
          <SmallBtn label="↓" onClick={() => onSendBackward(selectedObj.id)} />
          <SmallBtn label="↓ Back" onClick={() => onSendToBack(selectedObj.id)} />
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="w-full rounded-lg px-3 py-2 text-xs font-medium transition-all hover:brightness-125"
        style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        Delete selected
      </button>

      <SizePresets garmentRef={garmentRef} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Method Tab — decoration method + method-specific fields
   ═══════════════════════════════════════════════════════════ */

function MethodTab({
  zoneKey,
  config,
  onSetConfig,
}: {
  zoneKey: string;
  config?: { decorationMethod?: string; stitchCount?: number; colorCount?: number; threadColors?: string; dimensionWcm?: number; dimensionHcm?: number };
  onSetConfig: (key: string, cfg: Record<string, unknown>) => void;
}) {
  const method = config?.decorationMethod ?? "";
  const methodDef = DECORATION_METHODS.find((m) => m.key === method);

  return (
    <div className="space-y-4">
      <SectionHeader>Decoration Method</SectionHeader>
      <div className="grid grid-cols-2 gap-1.5">
        {DECORATION_METHODS.map((m) => (
          <button
            key={m.key}
            onClick={() => onSetConfig(zoneKey, { decorationMethod: m.key })}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all"
            style={
              method === m.key
                ? { background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.4)" }
                : { background: "rgba(255,255,255,0.03)", color: "var(--text-secondary, #94a3b8)", border: "1px solid rgba(255,255,255,0.06)" }
            }
          >
            <span>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* Method-specific fields */}
      {methodDef && (
        <div className="space-y-3 rounded-xl p-3" style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.1)" }}>
          <p className="text-xs font-semibold" style={{ color: "#a5b4fc" }}>{methodDef.label} Settings</p>

          {methodDef.hasStitchCount && (
            <NumField
              label="Stitch count"
              value={config?.stitchCount ?? 0}
              onChange={(v) => onSetConfig(zoneKey, { stitchCount: v })}
              min={0}
              max={999999}
              step={100}
            />
          )}

          <NumField
            label="Colours"
            value={config?.colorCount ?? 1}
            onChange={(v) => onSetConfig(zoneKey, { colorCount: v })}
            min={1}
            max={methodDef.maxColors}
            step={1}
          />

          <div>
            <label className="block text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--text-tertiary, #64748b)" }}>
              Thread/PMS Colours
            </label>
            <input
              type="text"
              value={config?.threadColors ?? ""}
              onChange={(e) => onSetConfig(zoneKey, { threadColors: e.target.value })}
              placeholder="e.g. PMS 186C, PMS 289C"
              className="w-full rounded-lg px-3 py-1.5 text-xs outline-none transition-all focus:ring-1 focus:ring-[#6366f1]"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary, #f1f5f9)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>



          {/* Method constraints info */}
          <div className="text-[11px] space-y-0.5" style={{ color: "var(--text-tertiary, #64748b)" }}>
            {methodDef.maxColors < 999 && <p>Max {methodDef.maxColors} colours</p>}
            {methodDef.minDpi > 0 && <p>Min {methodDef.minDpi} DPI</p>}
            {methodDef.requiresVector && <p>⚠ Requires vector artwork</p>}
            {!methodDef.supportsGradients && <p>No gradients supported</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Artwork Tab — upload, file list, add to zone
   ═══════════════════════════════════════════════════════════ */

function ArtworkTab({
  zoneKey,
  uploads,
  onAddImage,
  onAddUpload,
  onRemoveUpload,
}: {
  zoneKey: string;
  uploads: UploadedFile[];
  onAddImage: (zoneKey: string, upload: UploadedFile) => string;
  onAddUpload: (file: UploadedFile) => void;
  onRemoveUpload: (id: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_BYTES) continue;

      const ext = fileExt(file.name);
      const isImage = IMAGE_EXTENSIONS.has(ext);
      const isVector = VECTOR_EXTENSIONS.has(ext);
      const isEmbroidery = EMBROIDERY_EXTENSIONS.has(ext);

      if (!isImage && !isVector && !isEmbroidery) continue;

      const id = generateId();

      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const url = e.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const upload: UploadedFile = {
              id,
              name: file.name,
              url,
              isImage: true,
              ext,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
            };
            onAddUpload(upload);
          };
          img.src = url;
        };
        reader.readAsDataURL(file);
      } else {
        // Vector or embroidery files — would need server-side conversion
        // For now, create a placeholder
        const upload: UploadedFile = {
          id,
          name: file.name,
          url: "",
          isImage: false,
          ext,
        };
        onAddUpload(upload);

        // Attempt to convert via backend API
        const reader2 = new FileReader();
        reader2.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          if (!dataUrl) return;
          fetch("/api/convert-artwork", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: dataUrl, filename: file.name }),
          })
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
              if (data?.previewUrl) {
                // Load the preview image to get natural dimensions
                const previewImg = new Image();
                previewImg.onload = () => {
                  const store = useDecoratorStore.getState();
                  store.updateUpload(id, {
                    previewUrl: data.previewUrl,
                    isImage: true,
                    url: data.previewUrl,
                    naturalWidth: previewImg.naturalWidth,
                    naturalHeight: previewImg.naturalHeight,
                  });
                };
                previewImg.onerror = () => {
                  // Still update even if we can't get dimensions
                  const store = useDecoratorStore.getState();
                  store.updateUpload(id, { previewUrl: data.previewUrl, isImage: true, url: data.previewUrl });
                };
                previewImg.src = data.previewUrl;
              }
            })
            .catch(() => { /* conversion not available yet */ });
        };
        reader2.readAsDataURL(file);
      }
    }
  }, [onAddUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div className="space-y-4">
      <SectionHeader>Upload Artwork</SectionHeader>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all"
        style={{
          borderColor: dragging ? "#6366f1" : "rgba(255,255,255,0.1)",
          background: dragging ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
        }}
      >
        <p className="text-2xl mb-1">📁</p>
        <p className="text-xs font-medium" style={{ color: "var(--text-secondary, #94a3b8)" }}>
          Drop files here or click to browse
        </p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-tertiary, #64748b)" }}>
          PNG, JPG, SVG, PDF, EPS, AI, DST, PES
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.eps,.ai,.pdf,.cdr,.dst,.pes,.jef,.exp,.vp3,.hus,.emb"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Uploaded files */}
      {uploads.length > 0 && (
        <div className="space-y-1">
          <SectionHeader>Uploaded Files ({uploads.length})</SectionHeader>
          {uploads.map((u) => (
            <div
              key={u.id}
              className="group flex items-center gap-2 rounded-lg px-3 py-2 transition-all hover:brightness-110"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {/* Thumbnail */}
              {u.isImage && (u.previewUrl || u.url) ? (
                <img src={u.previewUrl || u.url} alt="" className="h-8 w-8 rounded object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded text-xs font-bold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                  {u.ext.toUpperCase().slice(0, 3)}
                </div>
              )}

              {/* File info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium" style={{ color: "var(--text-primary, #f1f5f9)" }}>{u.name}</p>
                {u.naturalWidth && u.naturalHeight && (
                  <p className="text-[10px]" style={{ color: "var(--text-tertiary, #64748b)" }}>{u.naturalWidth}×{u.naturalHeight}</p>
                )}
              </div>

              {/* Actions */}
              <button
                onClick={() => onAddImage(zoneKey, u)}
                className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold transition-all hover:brightness-125"
                style={{ background: "rgba(16,185,129,0.15)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.3)" }}
              >
                Place
              </button>
              <button
                onClick={() => onRemoveUpload(u.id)}
                className="shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "#fca5a5" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Text Tab — font, size, colour, alignment, add text
   ═══════════════════════════════════════════════════════════ */

function TextTab({
  zoneKey,
  selectedObj,
  onAddText,
  onUpdate,
}: {
  zoneKey: string;
  selectedObj?: DesignObject;
  onAddText: (zoneKey: string) => string;
  onUpdate: (id: string, changes: Partial<DesignObject>) => void;
}) {
  const isText = selectedObj?.type === "text";

  return (
    <div className="space-y-4">
      {/* Add text button */}
      <button
        onClick={() => onAddText(zoneKey)}
        className="w-full rounded-lg px-4 py-2.5 text-xs font-semibold transition-all hover:brightness-125"
        style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
      >
        + Add Text to Zone
      </button>

      {isText && selectedObj && (
        <div className="space-y-3">
          <SectionHeader>Text Content</SectionHeader>
          <textarea
            value={selectedObj.text ?? ""}
            onChange={(e) => onUpdate(selectedObj.id, { text: e.target.value })}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6366f1] resize-none"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary, #f1f5f9)", border: "1px solid rgba(255,255,255,0.08)" }}
          />

          <SectionHeader>Font</SectionHeader>
          <select
            value={selectedObj.fontFamily ?? "Plus Jakarta Sans"}
            onChange={(e) => onUpdate(selectedObj.id, { fontFamily: e.target.value })}
            className="w-full rounded-lg px-3 py-1.5 text-xs outline-none"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary, #f1f5f9)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {FONTS.map((f) => (
              <option key={f} value={f} style={{ background: "#1e1e2e" }}>{f}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <NumField
              label="Font Size"
              value={selectedObj.fontSize ?? 24}
              onChange={(v) => onUpdate(selectedObj.id, { fontSize: v })}
              min={6} max={200} step={1}
            />
            <NumField
              label="Line Height"
              value={selectedObj.lineHeight ?? 1.2}
              onChange={(v) => onUpdate(selectedObj.id, { lineHeight: v })}
              min={0.8} max={3} step={0.1}
            />
          </div>

          <NumField
            label="Letter Spacing"
            value={selectedObj.letterSpacing ?? 0}
            onChange={(v) => onUpdate(selectedObj.id, { letterSpacing: v })}
            min={-5} max={20} step={0.5}
          />

          <SectionHeader>Style</SectionHeader>
          <div className="flex flex-wrap gap-1.5">
            <SmallToggle
              label="Bold"
              active={selectedObj.fontWeight === "bold"}
              onClick={() => onUpdate(selectedObj.id, { fontWeight: selectedObj.fontWeight === "bold" ? "normal" : "bold" })}
            />
            <SmallToggle
              label="Italic"
              active={selectedObj.fontStyle === "italic"}
              onClick={() => onUpdate(selectedObj.id, { fontStyle: selectedObj.fontStyle === "italic" ? "normal" : "italic" })}
            />
            <SmallToggle
              label="Underline"
              active={selectedObj.underline === true}
              onClick={() => onUpdate(selectedObj.id, { underline: !selectedObj.underline })}
            />
          </div>

          <SectionHeader>Alignment</SectionHeader>
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <SmallToggle
                key={a}
                label={a.charAt(0).toUpperCase() + a.slice(1)}
                active={selectedObj.textAlign === a}
                onClick={() => onUpdate(selectedObj.id, { textAlign: a })}
              />
            ))}
          </div>

          <SectionHeader>Colour</SectionHeader>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={selectedObj.fill ?? "#ffffff"}
              onChange={(e) => onUpdate(selectedObj.id, { fill: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
            />
            <input
              type="text"
              value={selectedObj.fill ?? "#ffffff"}
              onChange={(e) => onUpdate(selectedObj.id, { fill: e.target.value })}
              className="flex-1 rounded-lg px-3 py-1.5 text-xs font-mono outline-none"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary, #f1f5f9)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>

          {/* Outline */}
          <SectionHeader>Outline</SectionHeader>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={selectedObj.stroke ?? "#000000"}
              onChange={(e) => onUpdate(selectedObj.id, { stroke: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
            />
            <NumField
              label="Width"
              value={selectedObj.strokeWidth ?? 0}
              onChange={(v) => onUpdate(selectedObj.id, { strokeWidth: v })}
              min={0} max={10} step={0.5}
            />
          </div>
        </div>
      )}

      {!isText && (
        <EmptyState icon="T" text="Select a text object or add new text to this zone" />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Notes Tab
   ═══════════════════════════════════════════════════════════ */

function NotesTab({
  zoneKey,
  config,
  onSetConfig,
}: {
  zoneKey: string;
  config?: { notes?: string };
  onSetConfig: (key: string, cfg: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader>Production Notes — {zoneKey}</SectionHeader>
      <textarea
        value={config?.notes ?? ""}
        onChange={(e) => onSetConfig(zoneKey, { notes: e.target.value })}
        rows={6}
        placeholder="Add notes for production..."
        className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all focus:ring-1 focus:ring-[#6366f1] resize-none"
        style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary, #f1f5f9)", border: "1px solid rgba(255,255,255,0.08)" }}
      />

      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wide" style={{ color: "var(--text-tertiary, #64748b)" }}>Quick add</p>
        <div className="flex flex-wrap gap-1">
          {QUICK_NOTES.map((n) => (
            <button
              key={n}
              onClick={() => {
                const current = config?.notes ?? "";
                const sep = current.trim() ? "\n" : "";
                onSetConfig(zoneKey, { notes: current + sep + n });
              }}
              className="rounded px-2 py-1 text-[11px] transition-all hover:brightness-125"
              style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-secondary, #94a3b8)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Shared micro-components
   ═══════════════════════════════════════════════════════════ */

function SizePresets({ garmentRef }: { garmentRef: { w: number; h: number } }) {
  const store = useDecoratorStore.getState();
  return (
    <div>
      <SectionHeader>Size Presets</SectionHeader>
      <div className="flex flex-wrap gap-1">
        {SIZE_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              const sel = store.selectedObjectIds;
              if (sel.length !== 1) return;
              const wPct = (p.wcm / garmentRef.w) * 100;
              const hPct = (p.hcm / garmentRef.h) * 100;
              store.pushHistory();
              store.updateObject(sel[0], { w: wPct, h: hPct });
            }}
            className="rounded px-2 py-1 text-[10px] transition-all hover:brightness-125"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-secondary, #94a3b8)", border: "1px solid rgba(255,255,255,0.06)" }}
            title={`${p.wcm}×${p.hcm} cm`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.18em] font-medium" style={{ color: "var(--text-tertiary, #64748b)" }}>
      {children}
    </p>
  );
}

function NumField({ label, value, onChange, min, max, step }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <label className="block text-[10px] tracking-wide mb-0.5" style={{ color: "var(--text-tertiary, #64748b)" }}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        min={min} max={max} step={step}
        className="w-full rounded-lg px-2 py-1 text-xs outline-none transition-all focus:ring-1 focus:ring-[#6366f1]"
        style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary, #f1f5f9)", border: "1px solid rgba(255,255,255,0.08)" }}
      />
    </div>
  );
}

function SmallToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all"
      style={
        active
          ? { background: "rgba(99,102,241,0.2)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.4)" }
          : { background: "rgba(255,255,255,0.03)", color: "var(--text-secondary, #94a3b8)", border: "1px solid rgba(255,255,255,0.06)" }
      }
    >
      {label}
    </button>
  );
}

function SmallBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded px-2 py-1 text-[11px] font-medium transition-all hover:brightness-125"
      style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-secondary, #94a3b8)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {label}
    </button>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="text-2xl">{icon}</span>
      <p className="text-xs" style={{ color: "var(--text-tertiary, #64748b)" }}>{text}</p>
    </div>
  );
}
