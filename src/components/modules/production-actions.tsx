"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { productionTone } from "@/lib/presentation";
import type { ProductionJob } from "@/lib/types";

type Lane = "all" | "queued" | "in_progress" | "qc" | "complete";

function stageToLane(stage: string): Lane {
  switch (stage) {
    case "Ready for print": return "queued";
    case "On press": return "in_progress";
    case "Packing": return "qc";
    default: return "queued";
  }
}

function processToDept(process: string): "embroidery" | "dtf" | "mixed" {
  switch (process) {
    case "Embroidery": return "embroidery";
    case "DTF": return "dtf";
    default: return "mixed";
  }
}

type ActionDef = { label: string; dept: string; lane: string; tone: "primary" | "success" | "warning" | "danger" };

function getProductionActions(job: ProductionJob): ActionDef[] {
  const dept = processToDept(job.process);
  const lane = stageToLane(job.stage);

  switch (lane) {
    case "queued":
      return [
        { label: "▶ Start", dept, lane: "in_progress", tone: "primary" },
      ];
    case "in_progress":
      return [
        { label: "QC check", dept, lane: "qc", tone: "warning" },
        { label: "✓ Complete", dept, lane: "complete", tone: "success" },
      ];
    case "qc":
      return [
        { label: "✓ QC passed", dept, lane: "complete", tone: "success" },
        { label: "✗ Redo", dept, lane: "in_progress", tone: "danger" },
      ];
    default:
      return [];
  }
}

function btnStyle(tone: ActionDef["tone"]): React.CSSProperties {
  switch (tone) {
    case "primary":
      return { background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" };
    case "success":
      return { background: "rgba(16,185,129,0.15)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.3)" };
    case "warning":
      return { background: "rgba(245,158,11,0.15)", color: "#fcd34d", border: "1px solid rgba(245,158,11,0.3)" };
    case "danger":
      return { background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" };
  }
}

export function ProductionActions({ jobs }: { jobs: ProductionJob[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<Lane>("all");
  const [scanInput, setScanInput] = useState("");

  const execAction = useCallback(async (jobId: string, dept: string, lane: string, label: string) => {
    setLoading(`${jobId}-${label}`);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/v1/jobs/${encodeURIComponent(jobId)}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "production_route", department: dept, lane }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setError(`${label} failed: ${data.error || "Unknown error"}`);
      } else {
        setSuccess(`${label} — done for ${jobId}`);
        setTimeout(() => router.refresh(), 500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(null);
    }
  }, [router]);

  // Scan to find and start a job
  const handleScan = useCallback(() => {
    const q = scanInput.trim().toUpperCase();
    if (!q) return;
    const match = jobs.find((j) => j.jobId.toUpperCase() === q || j.id === q);
    if (match) {
      const actions = getProductionActions(match);
      if (actions.length > 0) {
        execAction(match.id, actions[0].dept, actions[0].lane, actions[0].label);
      } else {
        setError(`No actions available for ${match.jobId}`);
      }
      setScanInput("");
    } else {
      setError(`Job "${scanInput}" not found in production queue`);
    }
  }, [scanInput, jobs, execAction]);

  const filteredJobs = jobs.filter((j) => {
    if (filter === "all") return true;
    return stageToLane(j.stage) === filter;
  });

  const counts = {
    queued: jobs.filter((j) => stageToLane(j.stage) === "queued").length,
    in_progress: jobs.filter((j) => stageToLane(j.stage) === "in_progress").length,
    qc: jobs.filter((j) => stageToLane(j.stage) === "qc").length,
  };

  return (
    <div className="space-y-6">
      {/* ── Scan bar ── */}
      <div className="card px-5 py-4" style={{ border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.04)" }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScan()}
            placeholder="Scan job barcode to advance (e.g. ST-12345)"
            className="flex-1 rounded-lg border px-4 py-2.5 text-sm"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <button
            onClick={handleScan}
            className="rounded-lg px-5 py-2.5 text-sm font-medium transition-all hover:brightness-125"
            style={btnStyle("primary")}
          >
            Scan
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(16,185,129,0.1)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}>
            {success}
          </div>
        )}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-1">
        {([
          { key: "all" as Lane, label: "All" },
          { key: "queued" as Lane, label: `Queued (${counts.queued})` },
          { key: "in_progress" as Lane, label: `In progress (${counts.in_progress})` },
          { key: "qc" as Lane, label: `QC (${counts.qc})` },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: filter === tab.key ? "rgba(99,102,241,0.15)" : "transparent",
              color: filter === tab.key ? "#a5b4fc" : "var(--text-tertiary)",
              border: `1px solid ${filter === tab.key ? "rgba(99,102,241,0.3)" : "transparent"}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Job list ── */}
      {filteredJobs.length === 0 ? (
        <div className="surface p-5 text-sm" style={{ color: "var(--text-tertiary)" }}>No jobs in this lane.</div>
      ) : (
        <div className="space-y-2">
          {filteredJobs.map((job) => {
            const actions = getProductionActions(job);
            return (
              <article key={job.id} className="card px-4 py-3.5">
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium" style={{ color: "var(--accent-light)" }}>{job.jobId}</span>
                      <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>•</span>
                      <span className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.customer}</span>
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>{job.process} · {job.quantity} units · {job.operator}</p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1.5 shrink-0">
                    {actions.map((act) => (
                      <button
                        key={act.label}
                        onClick={() => execAction(job.id, act.dept, act.lane, act.label)}
                        disabled={loading !== null}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all hover:brightness-125 disabled:opacity-50"
                        style={btnStyle(act.tone)}
                      >
                        {loading === `${job.id}-${act.label}` ? "..." : act.label}
                      </button>
                    ))}
                  </div>

                  <span className={`pill pill--dot shrink-0 ${productionTone(job.stage)}`}>{job.stage}</span>
                  <div className="hidden min-w-[70px] text-right sm:block">
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Ship {job.shipDate}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
