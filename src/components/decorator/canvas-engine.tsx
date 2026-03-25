"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { Canvas, Rect, FabricText, FabricImage, FabricObject, ActiveSelection } from "fabric";
import { useShallow } from "zustand/react/shallow";
import { useDecoratorStore } from "./store";
import type { ViewKey, DesignObject, ZoneDef } from "./types";
import { clamp } from "./types";

/* ═══════════════════════════════════════════════════════════
   Fabric.js Canvas Engine
   ═══════════════════════════════════════════════════════════ */

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 1000;

// Convert % position to canvas pixels
function pctToCanvas(pct: number, dim: number): number {
  return (pct / 100) * dim;
}

// Convert canvas pixels to % position
function canvasToPct(px: number, dim: number): number {
  return (px / dim) * 100;
}

interface CanvasEngineProps {
  view: ViewKey;
  backgroundImageUrl?: string;
  garmentColorHex: string;
  garmentType: string;
}

export function CanvasEngine({ view, backgroundImageUrl, garmentColorHex, garmentType }: CanvasEngineProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUpdatingFromStore = useRef(false);
  const objectMapRef = useRef<Map<string, FabricObject>>(new Map());
  const [canvasReady, setCanvasReady] = useState(false);

  const {
    objects,
    zones,
    activeZoneKey,
    selectedObjectIds,
    showZones,
    showGrid,
    zoom,
    activeTool,
    selectObject,
    clearSelection,
    updateObject,
    pushHistory,
  } = useDecoratorStore(
    useShallow((s) => ({
      objects: s.objects,
      zones: s.zones,
      activeZoneKey: s.activeZoneKey,
      selectedObjectIds: s.selectedObjectIds,
      showZones: s.showZones,
      showGrid: s.showGrid,
      zoom: s.zoom,
      activeTool: s.activeTool,
      selectObject: s.selectObject,
      clearSelection: s.clearSelection,
      updateObject: s.updateObject,
      pushHistory: s.pushHistory,
    }))
  );

  const viewObjects = useMemo(() => {
    const viewZoneKeys = new Set(zones.filter((z) => z.view === view).map((z) => z.key));
    return objects.filter((o) => viewZoneKeys.has(o.zoneKey));
  }, [objects, zones, view]);
  const viewZones = zones.filter((z) => z.view === view);

  /* ── Initialize Fabric canvas ── */
  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return;

    const canvas = new Canvas(canvasElRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: "#1e1e2e",
      preserveObjectStacking: true,
      selection: true,
      controlsAboveOverlay: true,
      stopContextMenu: true,
    });

    // Custom selection style
    canvas.selectionColor = "rgba(99, 102, 241, 0.15)";
    canvas.selectionBorderColor = "#6366f1";
    canvas.selectionLineWidth = 1;

    fabricRef.current = canvas;
    setCanvasReady(true);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      objectMapRef.current.clear();
      setCanvasReady(false);
    };
  }, []);

  /* ── Handle canvas events ── */
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleSelectionCreated = (e: { selected: FabricObject[] }) => {
      if (isUpdatingFromStore.current) return;
      const ids = e.selected
        .map((obj) => (obj as FabricObject & { _designObjectId?: string })._designObjectId)
        .filter(Boolean) as string[];
      if (ids.length === 1) selectObject(ids[0]);
      else if (ids.length > 1) {
        clearSelection();
        ids.forEach((id) => selectObject(id, true));
      }
    };

    const handleSelectionUpdated = (e: { selected: FabricObject[] }) => {
      if (isUpdatingFromStore.current) return;
      const ids = e.selected
        .map((obj) => (obj as FabricObject & { _designObjectId?: string })._designObjectId)
        .filter(Boolean) as string[];
      clearSelection();
      ids.forEach((id) => selectObject(id, true));
    };

    const handleSelectionCleared = () => {
      if (isUpdatingFromStore.current) return;
      clearSelection();
    };

    const handleObjectModified = (e: { target?: FabricObject }) => {
      if (isUpdatingFromStore.current || !e.target) return;
      const target = e.target as FabricObject & { _designObjectId?: string };
      if (!target._designObjectId) return;

      pushHistory();

      const left = target.left ?? 0;
      const top = target.top ?? 0;
      const width = (target.width ?? 0) * (target.scaleX ?? 1);
      const height = (target.height ?? 0) * (target.scaleY ?? 1);
      const angle = target.angle ?? 0;

      updateObject(target._designObjectId, {
        x: canvasToPct(left, CANVAS_WIDTH),
        y: canvasToPct(top, CANVAS_HEIGHT),
        w: canvasToPct(width, CANVAS_WIDTH),
        h: canvasToPct(height, CANVAS_HEIGHT),
        rotation: angle,
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on("selection:created", handleSelectionCreated as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on("selection:updated", handleSelectionUpdated as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on("selection:cleared", handleSelectionCleared as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvas.on("object:modified", handleObjectModified as any);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off("selection:created", handleSelectionCreated as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off("selection:updated", handleSelectionUpdated as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off("selection:cleared", handleSelectionCleared as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.off("object:modified", handleObjectModified as any);
    };
  }, [canvasReady, selectObject, clearSelection, updateObject, pushHistory]);

  /* ── Render background image ── */
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvasReady) return;

    // Remove existing background objects
    const existing = canvas.getObjects().filter((o) =>
      (o as FabricObject & { _isBackground?: boolean })._isBackground
    );
    existing.forEach((o) => canvas.remove(o));

    if (backgroundImageUrl) {
      FabricImage.fromURL(backgroundImageUrl, { crossOrigin: "anonymous" }).then((img) => {
        if (!fabricRef.current) return;
        const scale = Math.min(
          CANVAS_WIDTH / (img.width ?? CANVAS_WIDTH),
          CANVAS_HEIGHT / (img.height ?? CANVAS_HEIGHT)
        );
        img.set({
          scaleX: scale,
          scaleY: scale,
          left: (CANVAS_WIDTH - (img.width ?? 0) * scale) / 2,
          top: (CANVAS_HEIGHT - (img.height ?? 0) * scale) / 2,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
        (img as FabricObject & { _isBackground?: boolean })._isBackground = true;
        canvas.insertAt(0, img);
        canvas.requestRenderAll();
      }).catch(() => {
        // Image failed to load — use garment silhouette color fill
        renderColorBackground(canvas, garmentColorHex);
      });
    } else {
      renderColorBackground(canvas, garmentColorHex);
    }
  }, [backgroundImageUrl, garmentColorHex, canvasReady, view]);

  /* ── Render zone boundaries ── */
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvasReady) return;

    // Remove existing zone rects
    const existing = canvas.getObjects().filter((o) =>
      (o as FabricObject & { _isZone?: boolean })._isZone
    );
    existing.forEach((o) => canvas.remove(o));

    if (!showZones) {
      canvas.requestRenderAll();
      return;
    }

    for (const zone of viewZones) {
      const isActive = zone.key === activeZoneKey;
      const rect = new Rect({
        left: pctToCanvas(zone.x, CANVAS_WIDTH),
        top: pctToCanvas(zone.y, CANVAS_HEIGHT),
        width: pctToCanvas(zone.w, CANVAS_WIDTH),
        height: pctToCanvas(zone.h, CANVAS_HEIGHT),
        fill: isActive ? "rgba(99, 102, 241, 0.08)" : "transparent",
        stroke: isActive ? "#6366f1" : "rgba(148, 163, 184, 0.3)",
        strokeWidth: isActive ? 2 : 1,
        strokeDashArray: isActive ? undefined : [6, 4],
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      (rect as FabricObject & { _isZone?: boolean })._isZone = true;
      canvas.add(rect);
    }

    canvas.requestRenderAll();
  }, [viewZones, activeZoneKey, showZones, canvasReady]);

  /* ── Render grid ── */
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvasReady) return;

    const existing = canvas.getObjects().filter((o) =>
      (o as FabricObject & { _isGrid?: boolean })._isGrid
    );
    existing.forEach((o) => canvas.remove(o));

    if (!showGrid) {
      canvas.requestRenderAll();
      return;
    }

    const step = 50;
    for (let x = step; x < CANVAS_WIDTH; x += step) {
      const line = new Rect({
        left: x, top: 0, width: 0.5, height: CANVAS_HEIGHT,
        fill: "rgba(148, 163, 184, 0.1)",
        selectable: false, evented: false, excludeFromExport: true,
      });
      (line as FabricObject & { _isGrid?: boolean })._isGrid = true;
      canvas.add(line);
    }
    for (let y = step; y < CANVAS_HEIGHT; y += step) {
      const line = new Rect({
        left: 0, top: y, width: CANVAS_WIDTH, height: 0.5,
        fill: "rgba(148, 163, 184, 0.1)",
        selectable: false, evented: false, excludeFromExport: true,
      });
      (line as FabricObject & { _isGrid?: boolean })._isGrid = true;
      canvas.add(line);
    }

    // Centre lines
    const cx = new Rect({
      left: CANVAS_WIDTH / 2, top: 0, width: 1, height: CANVAS_HEIGHT,
      fill: "rgba(99, 102, 241, 0.2)",
      selectable: false, evented: false, excludeFromExport: true,
    });
    (cx as FabricObject & { _isGrid?: boolean })._isGrid = true;
    canvas.add(cx);

    const cy = new Rect({
      left: 0, top: CANVAS_HEIGHT / 2, width: CANVAS_WIDTH, height: 1,
      fill: "rgba(99, 102, 241, 0.2)",
      selectable: false, evented: false, excludeFromExport: true,
    });
    (cy as FabricObject & { _isGrid?: boolean })._isGrid = true;
    canvas.add(cy);

    canvas.requestRenderAll();
  }, [showGrid, canvasReady]);

  /* ── Sync design objects from store to canvas ── */
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvasReady) return;

    isUpdatingFromStore.current = true;

    // Remove design objects that are no longer in the view
    const currentFabricIds = new Set(viewObjects.map((o) => o.id));
    const toRemove: FabricObject[] = [];
    for (const [id, fObj] of objectMapRef.current) {
      if (!currentFabricIds.has(id)) {
        toRemove.push(fObj);
        objectMapRef.current.delete(id);
      }
    }
    toRemove.forEach((o) => canvas.remove(o));

    // Add or update objects
    const objectPromises: Promise<void>[] = [];

    for (const dObj of viewObjects) {
      const existing = objectMapRef.current.get(dObj.id);
      if (existing) {
        // Check if image URL changed (e.g. conversion completed) — need to recreate
        const currentUrl = (existing as FabricObject & { _imageUrl?: string })._imageUrl;
        const newUrl = dObj.previewUrl ?? dObj.imageUrl;
        if (dObj.type === "image" && newUrl && currentUrl !== newUrl) {
          // URL changed — remove old, recreate
          canvas.remove(existing);
          objectMapRef.current.delete(dObj.id);
          const p = createFabricObject(canvas, dObj).then((fObj) => {
            if (fObj) {
              (fObj as FabricObject & { _imageUrl?: string })._imageUrl = newUrl;
              objectMapRef.current.set(dObj.id, fObj);
              canvas.add(fObj);
            }
          });
          objectPromises.push(p);
        } else {
          // Update position/size
          updateFabricObject(existing, dObj);
        }
      } else {
        // Create new fabric object
        const p = createFabricObject(canvas, dObj).then((fObj) => {
          if (fObj) {
            const imgUrl = dObj.previewUrl ?? dObj.imageUrl;
            if (imgUrl) (fObj as FabricObject & { _imageUrl?: string })._imageUrl = imgUrl;
            objectMapRef.current.set(dObj.id, fObj);
            canvas.add(fObj);
          }
        });
        objectPromises.push(p);
      }
    }

    if (objectPromises.length > 0) {
      Promise.all(objectPromises).then(() => {
        canvas.requestRenderAll();
        isUpdatingFromStore.current = false;
      });
    } else {
      canvas.requestRenderAll();
      isUpdatingFromStore.current = false;
    }
  }, [viewObjects, canvasReady]);

  /* ── Handle selection from store ── */
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvasReady) return;

    isUpdatingFromStore.current = true;

    if (selectedObjectIds.length === 0) {
      canvas.discardActiveObject();
    } else if (selectedObjectIds.length === 1) {
      const fObj = objectMapRef.current.get(selectedObjectIds[0]);
      if (fObj) canvas.setActiveObject(fObj);
    } else {
      const fObjs = selectedObjectIds
        .map((id) => objectMapRef.current.get(id))
        .filter(Boolean) as FabricObject[];
      if (fObjs.length > 0) {
        const sel = new ActiveSelection(fObjs, { canvas });
        canvas.setActiveObject(sel);
      }
    }

    canvas.requestRenderAll();
    isUpdatingFromStore.current = false;
  }, [selectedObjectIds, canvasReady]);

  /* ── Zoom ── */
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !canvasReady) return;
    canvas.setZoom(zoom);
    canvas.setDimensions({
      width: CANVAS_WIDTH * zoom,
      height: CANVAS_HEIGHT * zoom,
    });
  }, [zoom, canvasReady]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const store = useDecoratorStore.getState();

      if (e.key === "Delete" || e.key === "Backspace") {
        store.deleteSelected();
        e.preventDefault();
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        store.undo();
        e.preventDefault();
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        store.redo();
        e.preventDefault();
      }
      if (e.key === "d" && (e.metaKey || e.ctrlKey)) {
        store.duplicateSelected();
        e.preventDefault();
      }
      if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
        const viewObjs = store.getObjectsForView(store.activeView);
        viewObjs.forEach((o) => store.selectObject(o.id, true));
        e.preventDefault();
      }

      // Arrow nudge
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const delta = e.shiftKey ? 1 : 0.25;
        const selected = store.selectedObjectIds;
        if (selected.length === 0) return;
        e.preventDefault();
        for (const id of selected) {
          const obj = store.objects.find((o) => o.id === id);
          if (!obj || obj.locked) continue;
          const changes: Partial<DesignObject> = {};
          if (e.key === "ArrowUp")    changes.y = clamp(obj.y - delta, 0, 100 - obj.h);
          if (e.key === "ArrowDown")  changes.y = clamp(obj.y + delta, 0, 100 - obj.h);
          if (e.key === "ArrowLeft")  changes.x = clamp(obj.x - delta, 0, 100 - obj.w);
          if (e.key === "ArrowRight") changes.x = clamp(obj.x + delta, 0, 100 - obj.w);
          store.updateObject(id, changes);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ── Handle mouse wheel zoom ── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const store = useDecoratorStore.getState();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      store.setZoom(store.zoom + delta);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center overflow-auto"
      style={{ flex: 1, background: "#13131f" }}
    >
      <div
        style={{
          width: CANVAS_WIDTH * zoom,
          height: CANVAS_HEIGHT * zoom,
          position: "relative",
        }}
      >
        <canvas ref={canvasElRef} />

        {/* Zone labels overlay */}
        {showZones && viewZones.map((zone) => {
          const isActive = zone.key === activeZoneKey;
          return (
            <div
              key={zone.key}
              onClick={() => useDecoratorStore.getState().setActiveZone(zone.key)}
              style={{
                position: "absolute",
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                transform: "translate(0, -20px)",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  fontSize: 10 * zoom,
                  lineHeight: 1,
                  padding: `${2 * zoom}px ${6 * zoom}px`,
                  borderRadius: 3,
                  background: isActive ? "#6366f1" : "rgba(30, 30, 46, 0.8)",
                  color: isActive ? "#fff" : "rgba(148, 163, 184, 0.7)",
                  whiteSpace: "nowrap",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {zone.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function renderColorBackground(canvas: Canvas, hex: string) {
  const bg = new Rect({
    left: CANVAS_WIDTH * 0.1,
    top: CANVAS_HEIGHT * 0.05,
    width: CANVAS_WIDTH * 0.8,
    height: CANVAS_HEIGHT * 0.9,
    fill: hex + "22",
    stroke: hex + "44",
    strokeWidth: 1,
    rx: 8,
    ry: 8,
    selectable: false,
    evented: false,
    excludeFromExport: true,
  });
  (bg as FabricObject & { _isBackground?: boolean })._isBackground = true;
  canvas.insertAt(0, bg);
  canvas.requestRenderAll();
}

async function createFabricObject(canvas: Canvas, dObj: DesignObject): Promise<FabricObject | null> {
  const left = pctToCanvas(dObj.x, CANVAS_WIDTH);
  const top = pctToCanvas(dObj.y, CANVAS_HEIGHT);
  const width = pctToCanvas(dObj.w, CANVAS_WIDTH);
  const height = pctToCanvas(dObj.h, CANVAS_HEIGHT);

  const commonProps = {
    left,
    top,
    angle: dObj.rotation,
    opacity: dObj.opacity,
    flipX: dObj.flipH,
    flipY: dObj.flipV,
    selectable: !dObj.locked,
    evented: !dObj.locked,
    lockMovementX: dObj.locked,
    lockMovementY: dObj.locked,
    hasControls: !dObj.locked,
    // Custom styling for controls
    cornerColor: "#6366f1",
    cornerStrokeColor: "#4f46e5",
    cornerSize: 8,
    cornerStyle: "circle" as const,
    transparentCorners: false,
    borderColor: "#6366f1",
    borderScaleFactor: 1.5,
    padding: 4,
  };

  if (dObj.type === "text") {
    const text = new FabricText(dObj.text ?? "Text", {
      ...commonProps,
      width,
      fontSize: dObj.fontSize ?? 24,
      fontFamily: dObj.fontFamily ?? "Plus Jakarta Sans",
      fontWeight: dObj.fontWeight ?? "normal",
      fontStyle: dObj.fontStyle ?? "normal",
      underline: dObj.underline ?? false,
      textAlign: dObj.textAlign ?? "center",
      fill: dObj.fill ?? "#ffffff",
      stroke: dObj.stroke,
      strokeWidth: dObj.strokeWidth ?? 0,
      lineHeight: dObj.lineHeight ?? 1.2,
      charSpacing: (dObj.letterSpacing ?? 0) * 10,
    });

    // Scale to fit requested height
    const naturalH = text.height ?? height;
    if (naturalH > 0) {
      const scale = height / naturalH;
      text.set({ scaleX: scale, scaleY: scale });
    }

    (text as FabricObject & { _designObjectId?: string })._designObjectId = dObj.id;
    return text;
  }

  if (dObj.type === "image") {
    const url = dObj.previewUrl ?? dObj.imageUrl;

    // If we have a renderable URL, load it
    if (url) {
      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
        const imgW = img.width ?? width;
        const imgH = img.height ?? height;

        let sx = width / imgW;
        let sy = height / imgH;

        // Preserve aspect ratio — use uniform scale fitting within bounding box
        if (dObj.lockAspect || true) {
          const uniformScale = Math.min(sx, sy);
          sx = uniformScale;
          sy = uniformScale;
        }

        img.set({
          ...commonProps,
          scaleX: sx,
          scaleY: sy,
        });
        if (dObj.lockAspect) {
          img.setControlsVisibility({ mb: false, mt: false, ml: false, mr: false });
        }
        (img as FabricObject & { _designObjectId?: string })._designObjectId = dObj.id;
        return img;
      } catch {
        // Falls through to placeholder below
      }
    }

    // Placeholder for non-renderable files (EPS, AI, DST, etc.)
    const placeholder = new Rect({
      ...commonProps,
      width,
      height,
      fill: "rgba(99, 102, 241, 0.15)",
      stroke: "#6366f1",
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      rx: 4,
      ry: 4,
    });
    (placeholder as FabricObject & { _designObjectId?: string })._designObjectId = dObj.id;

    // Add filename label on top of placeholder
    const label = new FabricText(dObj.imageName ?? "Artwork", {
      left: left + width / 2,
      top: top + height / 2,
      originX: "center",
      originY: "center",
      fontSize: 12,
      fontFamily: "Plus Jakarta Sans",
      fill: "#a5b4fc",
      selectable: false,
      evented: false,
    });
    (label as FabricObject & { _isZone?: boolean })._isZone = true; // So it gets cleaned up with zones
    canvas.add(label);

    return placeholder;
  }

  return null;
}

function updateFabricObject(fObj: FabricObject, dObj: DesignObject) {
  const left = pctToCanvas(dObj.x, CANVAS_WIDTH);
  const top = pctToCanvas(dObj.y, CANVAS_HEIGHT);
  const width = pctToCanvas(dObj.w, CANVAS_WIDTH);
  const height = pctToCanvas(dObj.h, CANVAS_HEIGHT);

  fObj.set({
    left,
    top,
    angle: dObj.rotation,
    opacity: dObj.opacity,
    flipX: dObj.flipH,
    flipY: dObj.flipV,
    selectable: !dObj.locked,
    evented: !dObj.locked,
  });

  if (dObj.type === "text" && fObj instanceof FabricText) {
    fObj.set({
      text: dObj.text ?? "Text",
      fontSize: dObj.fontSize ?? 24,
      fontFamily: dObj.fontFamily ?? "Plus Jakarta Sans",
      fontWeight: dObj.fontWeight ?? "normal",
      fontStyle: dObj.fontStyle ?? "normal",
      underline: dObj.underline ?? false,
      textAlign: dObj.textAlign ?? "center",
      fill: dObj.fill ?? "#ffffff",
      stroke: dObj.stroke,
      strokeWidth: dObj.strokeWidth ?? 0,
      lineHeight: dObj.lineHeight ?? 1.2,
      charSpacing: (dObj.letterSpacing ?? 0) * 10,
    });
    const naturalH = fObj.height ?? height;
    if (naturalH > 0) {
      const scale = height / naturalH;
      fObj.set({ scaleX: scale, scaleY: scale });
    }
  } else if (dObj.type === "image") {
    const imgW = fObj.width ?? width;
    const imgH = fObj.height ?? height;
    let sx = width / imgW;
    let sy = height / imgH;
    // Preserve aspect ratio — uniform scale
    const uniformScale = Math.min(sx, sy);
    sx = uniformScale;
    sy = uniformScale;
    fObj.set({ scaleX: sx, scaleY: sy });
  }

  fObj.setCoords();
}
