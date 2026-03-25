"use client";

import { create } from "zustand";
import {
  type ViewKey,
  type ZoneDef,
  type DesignObject,
  type UploadedFile,
  type ZoneConfig,
  type HistoryEntry,
  type DesignerProductDetail,
  type DesignConfig,
  ZONE_TEMPLATES,
  GARMENT_REF_CM,
  detectGarmentType,
  generateId,
  clamp,
  MIN_SIZE_PCT,
} from "./types";
import { colorToCss } from "@/lib/color-map";

/* ═══════════════════════════════════════════════════════════
   Store Shape
   ═══════════════════════════════════════════════════════════ */

export interface DecoratorState {
  // Product
  product: DesignerProductDetail | null;
  garmentType: string;
  selectedColorId: number | undefined;
  garmentColorHex: string;

  // Views & zones
  activeView: ViewKey;
  activeZoneKey: string;
  zones: ZoneDef[];

  // Design objects (all views)
  objects: DesignObject[];
  selectedObjectIds: string[];

  // Per-zone decoration config
  zoneConfigs: Record<string, ZoneConfig>;

  // Undo/redo
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // Files
  uploads: UploadedFile[];

  // UI state
  activeTool: "select" | "text" | "pan";
  rightPanel: "properties" | "method" | "artwork" | "text" | "notes";
  zoom: number;
  showZones: boolean;
  showGrid: boolean;

  // Dirty flag
  isDirty: boolean;

  // Actions
  init: (product: DesignerProductDetail, colorId?: number, initialDesigns?: DesignConfig[]) => void;
  setActiveView: (view: ViewKey) => void;
  setActiveZone: (key: string) => void;
  setSelectedColor: (id: number) => void;
  setActiveTool: (tool: "select" | "text" | "pan") => void;
  setRightPanel: (panel: "properties" | "method" | "artwork" | "text" | "notes") => void;
  setZoom: (z: number) => void;
  toggleZones: () => void;
  toggleGrid: () => void;

  // Object operations
  addObject: (obj: Omit<DesignObject, "id">) => string;
  updateObject: (id: string, changes: Partial<DesignObject>) => void;
  deleteObject: (id: string) => void;
  deleteSelected: () => void;
  selectObject: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  duplicateSelected: () => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  // Zone config
  setZoneConfig: (zoneKey: string, config: Partial<ZoneConfig>) => void;

  // File uploads
  addUpload: (file: UploadedFile) => void;
  removeUpload: (id: string) => void;
  updateUpload: (id: string, changes: Partial<UploadedFile>) => void;

  // Text
  addText: (zoneKey: string) => string;

  // Image
  addImage: (zoneKey: string, upload: UploadedFile) => string;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Export
  exportDesigns: () => DesignConfig[];

  // Computed helpers
  getObjectsForView: (view: ViewKey) => DesignObject[];
  getObjectsForZone: (zoneKey: string) => DesignObject[];
  getConfiguredZoneKeys: () => string[];
  getActiveZone: () => ZoneDef | undefined;
}

/* ═══════════════════════════════════════════════════════════
   Store Implementation
   ═══════════════════════════════════════════════════════════ */

const MAX_HISTORY = 50;

function resolveGarmentColor(product: DesignerProductDetail, colorId?: number): string {
  if (!colorId) return "#94a3b8";
  const color = product.colors.find((c) => c.id === colorId);
  if (!color) return "#94a3b8";
  const hex = colorToCss(color.name);
  return hex ?? "#94a3b8";
}

export const useDecoratorStore = create<DecoratorState>()((set, get) => ({
  // Initial state
  product: null,
  garmentType: "tshirt",
  selectedColorId: undefined,
  garmentColorHex: "#94a3b8",
  activeView: "front",
  activeZoneKey: "left_chest",
  zones: ZONE_TEMPLATES.tshirt,
  objects: [],
  selectedObjectIds: [],
  zoneConfigs: {},
  undoStack: [],
  redoStack: [],
  uploads: [],
  activeTool: "select",
  rightPanel: "properties",
  zoom: 1,
  showZones: true,
  showGrid: false,
  isDirty: false,

  /* ── Init ── */
  init: (product, colorId, initialDesigns) => {
    const garmentType = detectGarmentType(product.category, product.productName);
    const zones = ZONE_TEMPLATES[garmentType] ?? ZONE_TEMPLATES.tshirt;
    const selectedColorId = colorId ?? product.colors[0]?.id;
    const garmentColorHex = resolveGarmentColor(product, selectedColorId);

    // Convert initial DesignConfig[] to DesignObject[] + ZoneConfig[]
    const objects: DesignObject[] = [];
    const zoneConfigs: Record<string, ZoneConfig> = {};

    if (initialDesigns) {
      for (const d of initialDesigns) {
        // Create zone config
        zoneConfigs[d.placement] = {
          decorationMethod: d.decorationMethod,
          stitchCount: d.stitchCount,
          colorCount: d.colorCount,
          threadColors: d.threadColors,
          dimensionWcm: d.dimensionWcm,
          dimensionHcm: d.dimensionHcm,
          notes: d.notes,
        };

        // Create design object for artwork
        if (d.artworkUrl || d.previewUrl) {
          objects.push({
            id: generateId(),
            zoneKey: d.placement,
            type: "image",
            x: d.x, y: d.y, w: d.w, h: d.h,
            rotation: d.rotation ?? 0,
            flipH: d.flipH ?? false,
            flipV: d.flipV ?? false,
            lockAspect: d.lockAspect ?? true,
            opacity: 1,
            locked: false,
            imageUrl: d.artworkUrl,
            imageName: d.artworkName,
            imageFileType: d.artworkFileType,
            previewUrl: d.previewUrl,
          });
        }
      }
    }

    // If there are initial designs, start on the view/zone of the first one
    let startView: ViewKey = "front";
    let startZoneKey = zones[0]?.key ?? "left_chest";
    if (initialDesigns && initialDesigns.length > 0) {
      const firstPlacement = initialDesigns[0].placement;
      const firstZone = zones.find((z) => z.key === firstPlacement);
      if (firstZone) {
        startView = firstZone.view;
        startZoneKey = firstZone.key;
      }
    } else {
      // Default: first zone on front view
      const firstFront = zones.find((z) => z.view === "front");
      if (firstFront) startZoneKey = firstFront.key;
    }

    set({
      product,
      garmentType,
      zones,
      selectedColorId,
      garmentColorHex,
      activeView: startView,
      activeZoneKey: startZoneKey,
      objects,
      zoneConfigs,
      selectedObjectIds: [],
      undoStack: [],
      redoStack: [],
      uploads: [],
      activeTool: "select",
      rightPanel: "properties",
      zoom: 1,
      showZones: true,
      showGrid: false,
      isDirty: false,
    });
  },

  /* ── Navigation ── */
  setActiveView: (view) => {
    const { zones, activeZoneKey } = get();
    // Auto-select first zone on the new view so addText/addImage target the correct zone
    const currentZone = zones.find((z) => z.key === activeZoneKey);
    let newZoneKey = activeZoneKey;
    if (!currentZone || currentZone.view !== view) {
      const firstOnView = zones.find((z) => z.view === view);
      newZoneKey = firstOnView?.key ?? activeZoneKey;
    }
    set({ activeView: view, activeZoneKey: newZoneKey, selectedObjectIds: [] });
  },
  setActiveZone: (key) => {
    const zone = get().zones.find((z) => z.key === key);
    if (zone) {
      set({ activeZoneKey: key, activeView: zone.view, selectedObjectIds: [] });
    }
  },
  setSelectedColor: (id) => {
    const product = get().product;
    if (!product) return;
    set({ selectedColorId: id, garmentColorHex: resolveGarmentColor(product, id) });
  },
  setActiveTool: (tool) => set({ activeTool: tool }),
  setRightPanel: (panel) => set({ rightPanel: panel }),
  setZoom: (z) => set({ zoom: clamp(z, 0.25, 4) }),
  toggleZones: () => set((s) => ({ showZones: !s.showZones })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  /* ── Object CRUD ── */
  addObject: (obj) => {
    const id = generateId();
    get().pushHistory();
    set((s) => ({
      objects: [...s.objects, { ...obj, id }],
      selectedObjectIds: [id],
      isDirty: true,
    }));
    return id;
  },

  updateObject: (id, changes) => {
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, ...changes } : o)),
      isDirty: true,
    }));
  },

  deleteObject: (id) => {
    get().pushHistory();
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      selectedObjectIds: s.selectedObjectIds.filter((sid) => sid !== id),
      isDirty: true,
    }));
  },

  deleteSelected: () => {
    const { selectedObjectIds, objects } = get();
    if (selectedObjectIds.length === 0) return;
    // Don't delete locked objects
    const toDelete = new Set(selectedObjectIds.filter((id) => {
      const obj = objects.find((o) => o.id === id);
      return obj && !obj.locked;
    }));
    if (toDelete.size === 0) return;
    get().pushHistory();
    set((s) => ({
      objects: s.objects.filter((o) => !toDelete.has(o.id)),
      selectedObjectIds: [],
      isDirty: true,
    }));
  },

  selectObject: (id, multi) => {
    set((s) => ({
      selectedObjectIds: multi
        ? s.selectedObjectIds.includes(id)
          ? s.selectedObjectIds.filter((sid) => sid !== id)
          : [...s.selectedObjectIds, id]
        : [id],
    }));
  },

  clearSelection: () => set({ selectedObjectIds: [] }),

  duplicateSelected: () => {
    const { selectedObjectIds, objects } = get();
    if (selectedObjectIds.length === 0) return;
    get().pushHistory();
    const newObjects: DesignObject[] = [];
    for (const id of selectedObjectIds) {
      const obj = objects.find((o) => o.id === id);
      if (obj) {
        newObjects.push({
          ...obj,
          id: generateId(),
          x: clamp(obj.x + 3, 0, 100 - obj.w),
          y: clamp(obj.y + 3, 0, 100 - obj.h),
        });
      }
    }
    const newIds = newObjects.map((o) => o.id);
    set((s) => ({
      objects: [...s.objects, ...newObjects],
      selectedObjectIds: newIds,
      isDirty: true,
    }));
  },

  /* ── Layer ordering ── */
  bringForward: (id) => {
    set((s) => {
      const idx = s.objects.findIndex((o) => o.id === id);
      if (idx < 0 || idx >= s.objects.length - 1) return s;
      const arr = [...s.objects];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return { objects: arr, isDirty: true };
    });
  },
  sendBackward: (id) => {
    set((s) => {
      const idx = s.objects.findIndex((o) => o.id === id);
      if (idx <= 0) return s;
      const arr = [...s.objects];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return { objects: arr, isDirty: true };
    });
  },
  bringToFront: (id) => {
    set((s) => {
      const obj = s.objects.find((o) => o.id === id);
      if (!obj) return s;
      return { objects: [...s.objects.filter((o) => o.id !== id), obj], isDirty: true };
    });
  },
  sendToBack: (id) => {
    set((s) => {
      const obj = s.objects.find((o) => o.id === id);
      if (!obj) return s;
      return { objects: [obj, ...s.objects.filter((o) => o.id !== id)], isDirty: true };
    });
  },

  /* ── Zone config ── */
  setZoneConfig: (zoneKey, config) => {
    set((s) => ({
      zoneConfigs: {
        ...s.zoneConfigs,
        [zoneKey]: { ...s.zoneConfigs[zoneKey], ...config },
      },
      isDirty: true,
    }));
  },

  /* ── File uploads ── */
  addUpload: (file) => set((s) => ({ uploads: [...s.uploads, file] })),
  removeUpload: (id) => set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) })),
  updateUpload: (id, changes) => set((s) => {
    const newUploads = s.uploads.map((u) => u.id === id ? { ...u, ...changes } : u);
    // If upload got a preview, also update any placed design objects referencing it
    let newObjects = s.objects;
    if (changes.url || changes.previewUrl) {
      newObjects = s.objects.map((o) => {
        if (o.uploadId !== id) return o;
        const updated: Partial<DesignObject> = {
          imageUrl: changes.url ?? o.imageUrl,
          previewUrl: changes.previewUrl ?? o.previewUrl,
        };
        // Update natural dimensions if available so aspect ratio is correct
        if (changes.naturalWidth && changes.naturalHeight) {
          updated.naturalWidth = changes.naturalWidth;
          updated.naturalHeight = changes.naturalHeight;
          // Re-fit within current bounding box preserving new aspect ratio
          const ar = changes.naturalWidth / changes.naturalHeight;
          if (ar > 1) {
            updated.h = +(o.w / ar).toFixed(2);
          } else {
            updated.w = +(o.h * ar).toFixed(2);
          }
        }
        return { ...o, ...updated };
      });
    }
    return { uploads: newUploads, objects: newObjects };
  }),

  /* ── Add text object ── */
  addText: (zoneKey) => {
    const zone = get().zones.find((z) => z.key === zoneKey);
    if (!zone) return "";
    get().pushHistory();
    const id = generateId();
    const obj: DesignObject = {
      id,
      zoneKey,
      type: "text",
      x: zone.x + zone.w / 2 - 10,
      y: zone.y + zone.h / 2 - 4,
      w: 20,
      h: 8,
      rotation: 0,
      flipH: false, flipV: false,
      lockAspect: false,
      opacity: 1,
      locked: false,
      text: "Your Text",
      fontFamily: "Plus Jakarta Sans",
      fontSize: 24,
      fontWeight: "normal",
      fontStyle: "normal",
      underline: false,
      textAlign: "center",
      fill: "#ffffff",
      lineHeight: 1.2,
      letterSpacing: 0,
    };
    set((s) => ({
      objects: [...s.objects, obj],
      selectedObjectIds: [id],
      activeTool: "select",
      rightPanel: "text",
      isDirty: true,
    }));
    return id;
  },

  /* ── Add image object ── */
  addImage: (zoneKey, upload) => {
    const zone = get().zones.find((z) => z.key === zoneKey);
    if (!zone) return "";
    get().pushHistory();
    const id = generateId();

    // Fit image within zone, maintaining aspect ratio
    let w = zone.w * 0.6;
    let h = zone.h * 0.6;
    if (upload.naturalWidth && upload.naturalHeight) {
      const ar = upload.naturalWidth / upload.naturalHeight;
      const maxW = zone.w * 0.8;
      const maxH = zone.h * 0.8;
      if (ar > 1) {
        w = maxW;
        h = maxW / ar;
        if (h > maxH) { h = maxH; w = maxH * ar; }
      } else {
        h = maxH;
        w = maxH * ar;
        if (w > maxW) { w = maxW; h = maxW / ar; }
      }
    }

    const obj: DesignObject = {
      id,
      zoneKey,
      type: "image",
      x: zone.x + (zone.w - w) / 2,
      y: zone.y + (zone.h - h) / 2,
      w: Math.max(w, MIN_SIZE_PCT),
      h: Math.max(h, MIN_SIZE_PCT),
      rotation: 0,
      flipH: false, flipV: false,
      lockAspect: true,
      opacity: 1,
      locked: false,
      imageUrl: upload.url,
      imageName: upload.name,
      imageFileType: upload.ext,
      previewUrl: upload.previewUrl,
      naturalWidth: upload.naturalWidth,
      naturalHeight: upload.naturalHeight,
      uploadId: upload.id,
    };
    set((s) => ({
      objects: [...s.objects, obj],
      selectedObjectIds: [id],
      activeTool: "select",
      rightPanel: "properties",
      isDirty: true,
    }));
    return id;
  },

  /* ── Undo/Redo ── */
  pushHistory: () => {
    set((s) => ({
      undoStack: [
        ...s.undoStack.slice(-MAX_HISTORY + 1),
        { objects: structuredClone(s.objects), zoneConfigs: structuredClone(s.zoneConfigs) },
      ],
      redoStack: [],
    }));
  },

  undo: () => {
    const { undoStack, objects, zoneConfigs } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, { objects: structuredClone(objects), zoneConfigs: structuredClone(zoneConfigs) }],
      objects: prev.objects,
      zoneConfigs: prev.zoneConfigs,
      selectedObjectIds: [],
    });
  },

  redo: () => {
    const { redoStack, objects, zoneConfigs } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, { objects: structuredClone(objects), zoneConfigs: structuredClone(zoneConfigs) }],
      objects: next.objects,
      zoneConfigs: next.zoneConfigs,
      selectedObjectIds: [],
    });
  },

  /* ── Export to legacy DesignConfig[] format ── */
  exportDesigns: () => {
    const { objects, zoneConfigs, zones, garmentType } = get();
    const ref = GARMENT_REF_CM[garmentType] ?? { w: 50, h: 70 };
    const configured: DesignConfig[] = [];

    // Group objects by zone
    const byZone: Record<string, DesignObject[]> = {};
    for (const obj of objects) {
      if (!byZone[obj.zoneKey]) byZone[obj.zoneKey] = [];
      byZone[obj.zoneKey].push(obj);
    }

    // For each zone with objects or config, emit a DesignConfig
    const allZoneKeys = new Set([...Object.keys(byZone), ...Object.keys(zoneConfigs)]);
    for (const zoneKey of allZoneKeys) {
      const zoneObjs = byZone[zoneKey] ?? [];
      const config = zoneConfigs[zoneKey];
      if (zoneObjs.length === 0 && !config?.decorationMethod) continue;

      // Primary object (first image or first object)
      const primaryImg = zoneObjs.find((o) => o.type === "image") ?? zoneObjs[0];
      const zone = zones.find((z) => z.key === zoneKey);

      if (primaryImg) {
        configured.push({
          placement: zoneKey,
          decorationMethod: config?.decorationMethod ?? "WEMB",
          artworkUrl: primaryImg.imageUrl,
          artworkName: primaryImg.imageName,
          artworkFileType: primaryImg.imageFileType,
          previewUrl: primaryImg.previewUrl,
          x: primaryImg.x,
          y: primaryImg.y,
          w: primaryImg.w,
          h: primaryImg.h,
          rotation: primaryImg.rotation,
          flipH: primaryImg.flipH,
          flipV: primaryImg.flipV,
          lockAspect: primaryImg.lockAspect,
          stitchCount: config?.stitchCount,
          colorCount: config?.colorCount,
          threadColors: config?.threadColors,
          dimensionWcm: config?.dimensionWcm ?? (primaryImg.w / 100) * ref.w,
          dimensionHcm: config?.dimensionHcm ?? (primaryImg.h / 100) * ref.h,
          notes: config?.notes,
        });
      } else if (config?.decorationMethod) {
        // Zone has config but no objects
        configured.push({
          placement: zoneKey,
          decorationMethod: config.decorationMethod,
          x: zone?.x ?? 0, y: zone?.y ?? 0,
          w: zone?.w ?? 20, h: zone?.h ?? 20,
          stitchCount: config.stitchCount,
          colorCount: config.colorCount,
          threadColors: config.threadColors,
          dimensionWcm: config.dimensionWcm,
          dimensionHcm: config.dimensionHcm,
          notes: config.notes,
        });
      }
    }

    return configured;
  },

  /* ── Computed ── */
  getObjectsForView: (view) => {
    const { objects, zones } = get();
    const viewZoneKeys = new Set(zones.filter((z) => z.view === view).map((z) => z.key));
    return objects.filter((o) => viewZoneKeys.has(o.zoneKey));
  },

  getObjectsForZone: (zoneKey) => {
    return get().objects.filter((o) => o.zoneKey === zoneKey);
  },

  getConfiguredZoneKeys: () => {
    const { objects, zoneConfigs } = get();
    const keys = new Set<string>();
    for (const o of objects) keys.add(o.zoneKey);
    for (const [k, v] of Object.entries(zoneConfigs)) {
      if (v.decorationMethod) keys.add(k);
    }
    return Array.from(keys);
  },

  getActiveZone: () => {
    const { zones, activeZoneKey } = get();
    return zones.find((z) => z.key === activeZoneKey);
  },
}));
