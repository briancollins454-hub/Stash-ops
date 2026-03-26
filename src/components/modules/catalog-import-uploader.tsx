"use client";

import { useState, useRef, useCallback } from "react";

export function CatalogImportUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; products?: number; colours?: number; error?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    if (!f.name.endsWith(".csv")) {
      setResult({ error: "Please select a CSV file" });
      return;
    }
    setFile(f);
    setResult(null);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);

    try {
      const text = await file.text();
      const res = await fetch("/api/v1/catalog/import", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: text,
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) setFile(null);
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all"
        style={{
          borderColor: dragOver ? "#6366f1" : file ? "#10b981" : "rgba(255,255,255,0.1)",
          background: dragOver ? "rgba(99,102,241,0.05)" : file ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.02)",
        }}
      >
        {file ? (
          <div>
            <p className="text-2xl mb-2">📄</p>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{file.name}</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              {(file.size / 1024).toFixed(0)} KB — click to change
            </p>
          </div>
        ) : (
          <div>
            <p className="text-2xl mb-2">📁</p>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Drop a CSV file here or click to browse
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              Ralawise, PenCarrie, or other supplier product feeds
            </p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {/* Upload button */}
      {file && (
        <div className="flex justify-end">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:brightness-125 disabled:opacity-50"
            style={{
              background: "rgba(99,102,241,0.15)",
              color: "#a5b4fc",
              border: "1px solid rgba(99,102,241,0.3)",
            }}
          >
            {uploading ? "Importing..." : "Import Catalog"}
          </button>
        </div>
      )}

      {/* Result feedback */}
      {result && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-medium"
          style={{
            background: result.ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            color: result.ok ? "#6ee7b7" : "#fca5a5",
            border: `1px solid ${result.ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
          }}
        >
          {result.ok ? (
            <>✓ Imported {result.products?.toLocaleString()} products and {result.colours?.toLocaleString()} colours</>
          ) : (
            <>✗ {result.error}</>
          )}
        </div>
      )}
    </div>
  );
}
