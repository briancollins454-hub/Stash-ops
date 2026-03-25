"use client";

import { useShallow } from "zustand/react/shallow";
import { useDecoratorStore } from "./store";

/* ═══════════════════════════════════════════════════════════
   Toolbar — top bar with tools, undo/redo, zoom, toggles
   ═══════════════════════════════════════════════════════════ */

export function Toolbar() {
  const {
    activeTool,
    zoom,
    showZones,
    showGrid,
    undoStack,
    redoStack,
    setActiveTool,
    setZoom,
    toggleZones,
    toggleGrid,
    undo,
    redo,
    deleteSelected,
    duplicateSelected,
    selectedObjectIds,
  } = useDecoratorStore(
    useShallow((s) => ({
      activeTool: s.activeTool,
      zoom: s.zoom,
      showZones: s.showZones,
      showGrid: s.showGrid,
      undoStack: s.undoStack,
      redoStack: s.redoStack,
      setActiveTool: s.setActiveTool,
      setZoom: s.setZoom,
      toggleZones: s.toggleZones,
      toggleGrid: s.toggleGrid,
      undo: s.undo,
      redo: s.redo,
      deleteSelected: s.deleteSelected,
      duplicateSelected: s.duplicateSelected,
      selectedObjectIds: s.selectedObjectIds,
    }))
  );

  const hasSelection = selectedObjectIds.length > 0;

  return (
    <div
      className="flex h-11 shrink-0 items-center gap-1 px-3"
      style={{ background: "rgba(15,15,25,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Tools */}
      <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.04)" }}>
        <ToolBtn
          active={activeTool === "select"}
          onClick={() => setActiveTool("select")}
          title="Select (V)"
          icon={
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l7.071 16.97 2.51-7.39 7.39-2.51L3 3z" />
            </svg>
          }
        />
        <ToolBtn
          active={activeTool === "text"}
          onClick={() => setActiveTool("text")}
          title="Text (T)"
          icon={<span className="text-xs font-bold">T</span>}
        />
        <ToolBtn
          active={activeTool === "pan"}
          onClick={() => setActiveTool("pan")}
          title="Pan (H)"
          icon={
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
            </svg>
          }
        />
      </div>

      {/* Divider */}
      <div className="mx-1 h-5 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />

      {/* Undo / redo */}
      <ActionBtn onClick={undo} disabled={undoStack.length === 0} title="Undo (⌘Z)">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
        </svg>
      </ActionBtn>
      <ActionBtn onClick={redo} disabled={redoStack.length === 0} title="Redo (⌘⇧Z)">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
        </svg>
      </ActionBtn>

      {/* Divider */}
      <div className="mx-1 h-5 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />

      {/* Selection actions */}
      <ActionBtn onClick={duplicateSelected} disabled={!hasSelection} title="Duplicate (⌘D)">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </ActionBtn>
      <ActionBtn onClick={deleteSelected} disabled={!hasSelection} title="Delete (⌫)">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </ActionBtn>

      {/* Toggles */}
      <div className="mx-1 h-5 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />

      <ActionBtn onClick={toggleZones} title="Toggle zones">
        <span className="text-[10px] font-semibold" style={{ opacity: showZones ? 1 : 0.4 }}>Z</span>
      </ActionBtn>
      <ActionBtn onClick={toggleGrid} title="Toggle grid">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ opacity: showGrid ? 1 : 0.4 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16M4 12h16M4 20h16M4 4v16m8-16v16m8-16v16" />
        </svg>
      </ActionBtn>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom */}
      <div className="flex items-center gap-1">
        <ActionBtn onClick={() => setZoom(zoom - 0.25)} disabled={zoom <= 0.25} title="Zoom out">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
          </svg>
        </ActionBtn>
        <button
          onClick={() => setZoom(1)}
          className="min-w-[3.5rem] rounded px-2 py-0.5 text-center text-[11px] font-medium transition-all hover:brightness-125"
          style={{ color: "var(--text-secondary, #94a3b8)" }}
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <ActionBtn onClick={() => setZoom(zoom + 0.25)} disabled={zoom >= 4} title="Zoom in">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </ActionBtn>
      </div>
    </div>
  );
}

/* ── Reusable buttons ── */

function ToolBtn({ active, onClick, title, icon }: {
  active: boolean;
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-md transition-all"
      style={
        active
          ? { background: "rgba(99,102,241,0.25)", color: "#a5b4fc" }
          : { background: "transparent", color: "var(--text-tertiary, #64748b)" }
      }
    >
      {icon}
    </button>
  );
}

function ActionBtn({ onClick, disabled, title, children }: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-md transition-all hover:brightness-125 disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ color: "var(--text-tertiary, #64748b)" }}
    >
      {children}
    </button>
  );
}
