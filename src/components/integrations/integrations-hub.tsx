"use client";

import { useEffect, useState, useCallback } from "react";

type SyncProvider = "shopify" | "deco" | "qbo" | "shipstation" | "gmail" | "slack";

type SyncProviderState = {
  provider: SyncProvider;
  running: boolean;
  queued: number;
  lastStartedAt?: string;
  lastCompletedAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
};

type SyncJob = {
  jobId: string;
  provider: SyncProvider;
  trigger: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  note?: string;
  error?: string;
};

type SyncStatusPayload = {
  data: {
    providers: SyncProviderState[];
    jobs: SyncJob[];
    generatedAt: string;
  };
};

interface IntegrationConfig {
  key: SyncProvider;
  name: string;
  icon: string;
  description: string;
  capabilities: string[];
  envHint: string;
}

const INTEGRATIONS: IntegrationConfig[] = [
  {
    key: "deco",
    name: "DecoNetwork",
    icon: "🧵",
    description: "Decorator platform for personalised garments — manages customers, artwork, orders, and production.",
    capabilities: ["Customer sync", "Order import", "Artwork library", "Production tracking"],
    envHint: "DECO_BASE_URL, DECO_USERNAME, DECO_PASSWORD",
  },
  {
    key: "shopify",
    name: "Shopify",
    icon: "🛒",
    description: "E-commerce storefront — feeds online orders and customer data into Stash Ops.",
    capabilities: ["Order intake", "Customer sync", "Webhook events", "Fulfillment updates"],
    envHint: "SHOPIFY_DOMAIN, SHOPIFY_ACCESS_TOKEN",
  },
  {
    key: "qbo",
    name: "QuickBooks Online",
    icon: "📒",
    description: "Accounting platform — manages invoices, payments, and financial records.",
    capabilities: ["Invoice creation", "Payment tracking", "Account reconciliation"],
    envHint: "QBO_REALM_ID, QBO_ACCESS_TOKEN",
  },
  {
    key: "gmail",
    name: "Gmail",
    icon: "✉️",
    description: "Email integration — links customer conversations to orders for a full communication timeline.",
    capabilities: ["Email threading", "Customer correspondence", "Order-linked conversations"],
    envHint: "GMAIL_ACCESS_TOKEN",
  },
  {
    key: "slack",
    name: "Slack",
    icon: "💬",
    description: "Team messaging — sends real-time alerts and order notifications to your workspace.",
    capabilities: ["Order alerts", "Status notifications", "Team mentions"],
    envHint: "SLACK_BOT_TOKEN, SLACK_CHANNEL_IDS",
  },
  {
    key: "shipstation",
    name: "ShipStation",
    icon: "📦",
    description: "Shipping & dispatch — handles label printing and carrier integration for outbound orders.",
    capabilities: ["Label printing", "Carrier rates", "Tracking updates", "Batch dispatch"],
    envHint: "SHIPSTATION_PRINT_URL",
  },
];

function formatDate(value?: string) {
  if (!value) return "never";
  return new Date(value).toLocaleTimeString();
}

export function IntegrationsHub() {
  const [status, setStatus] = useState<SyncStatusPayload["data"] | null>(null);
  const [expanded, setExpanded] = useState<SyncProvider | null>(null);
  const [busyProvider, setBusyProvider] = useState<SyncProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status", { cache: "no-store" });
      const payload = (await res.json()) as SyncStatusPayload;
      setStatus(payload.data);
      setError(null);
    } catch {
      setError("Unable to load sync status.");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 12_000);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  const triggerSync = async (provider: SyncProvider) => {
    setBusyProvider(provider);
    setError(null);
    try {
      await fetch(`/api/sync/${provider}`, { method: "POST" });
      await refreshStatus();
    } catch {
      setError(`Unable to queue ${provider} sync.`);
    } finally {
      setBusyProvider(null);
    }
  };

  const triggerShopifyBackfill = async () => {
    setBusyProvider("shopify");
    setError(null);
    try {
      await fetch("/api/sync/shopify/backfill", { method: "POST" });
      await refreshStatus();
    } catch {
      setError("Unable to queue Shopify backfill.");
    } finally {
      setBusyProvider(null);
    }
  };

  const providerStates = status?.providers ?? [];
  const recentJobs = status?.jobs ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        {INTEGRATIONS.map((integration) => {
          const ps = providerStates.find((s) => s.provider === integration.key);
          const isExpanded = expanded === integration.key;
          const connected = ps ? (ps.totalRuns > 0 || ps.running) : false;
          const healthy = ps?.lastError ? false : true;
          const jobs = recentJobs.filter((j) => j.provider === integration.key);

          return (
            <article
              key={integration.key}
              className="card overflow-hidden transition-all"
              style={{
                border: isExpanded
                  ? "1px solid rgba(99,102,241,0.3)"
                  : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Header — clickable */}
              <button
                onClick={() => setExpanded(isExpanded ? null : integration.key)}
                className="w-full p-4 text-left transition-all hover:brightness-110"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">{integration.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {integration.name}
                      </p>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-tertiary)" }}>
                        {integration.description.split("—")[0].trim()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge connected={connected} healthy={healthy} running={ps?.running} />
                    <svg
                      className="h-3.5 w-3.5 transition-transform"
                      style={{
                        color: "var(--text-tertiary)",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div
                  className="px-4 pb-4 space-y-4"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {/* Description */}
                  <p className="text-xs leading-relaxed pt-3" style={{ color: "var(--text-secondary)" }}>
                    {integration.description}
                  </p>

                  {/* Capabilities */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                      Capabilities
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {integration.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ background: "rgba(99,102,241,0.1)", color: "#a5b4fc" }}
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Sync stats */}
                  {ps && (
                    <div
                      className="rounded-lg p-3 space-y-1"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                        Sync status
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                            {ps.successfulRuns}
                          </p>
                          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Successful</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold" style={{ color: ps.failedRuns > 0 ? "#fca5a5" : "var(--text-primary)" }}>
                            {ps.failedRuns}
                          </p>
                          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Failed</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                            {ps.queued}
                          </p>
                          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Queued</p>
                        </div>
                      </div>
                      <p className="text-[11px] pt-1" style={{ color: "var(--text-tertiary)" }}>
                        Last success: {formatDate(ps.lastSuccessAt)}
                      </p>
                      {ps.lastError && (
                        <p className="text-[11px]" style={{ color: "#fca5a5" }}>
                          {ps.lastError}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Recent jobs for this provider */}
                  {jobs.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                        Recent activity
                      </p>
                      <div className="space-y-1">
                        {jobs.slice(0, 3).map((job) => (
                          <div
                            key={job.jobId}
                            className="rounded-lg px-2.5 py-1.5 text-[11px] flex items-center justify-between"
                            style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)" }}
                          >
                            <span className="flex items-center gap-1.5">
                              <JobStatusDot status={job.status} />
                              {job.trigger}
                            </span>
                            <span style={{ color: "var(--text-tertiary)" }}>{formatDate(job.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Configuration hint when not connected */}
                  {!connected && (
                    <div
                      className="rounded-lg px-3 py-2.5 text-xs"
                      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}
                    >
                      <p className="font-medium" style={{ color: "#fbbf24" }}>Not connected</p>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        Set the following environment variables on the backend: <span className="font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>{integration.envHint}</span>
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => triggerSync(integration.key)}
                      disabled={busyProvider === integration.key}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:brightness-125 disabled:opacity-50"
                      style={{
                        background: "rgba(99,102,241,0.15)",
                        color: "#a5b4fc",
                        border: "1px solid rgba(99,102,241,0.3)",
                      }}
                    >
                      {busyProvider === integration.key ? "Syncing..." : "⟳ Sync now"}
                    </button>
                    {integration.key === "shopify" && (
                      <button
                        onClick={triggerShopifyBackfill}
                        disabled={busyProvider === "shopify"}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:brightness-125 disabled:opacity-50"
                        style={{
                          background: "rgba(16,185,129,0.15)",
                          color: "#6ee7b7",
                          border: "1px solid rgba(16,185,129,0.3)",
                        }}
                      >
                        {busyProvider === "shopify" ? "Queueing..." : "Backfill unfulfilled"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}

function StatusBadge({ connected, healthy, running }: { connected: boolean; healthy: boolean; running?: boolean }) {
  if (running) {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider animate-pulse"
        style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}
      >
        Syncing
      </span>
    );
  }
  if (!connected) {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}
      >
        Not connected
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{
        background: healthy ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
        color: healthy ? "#6ee7b7" : "#fca5a5",
      }}
    >
      {healthy ? "Connected" : "Error"}
    </span>
  );
}

function JobStatusDot({ status }: { status: string }) {
  const color =
    status === "completed" ? "#6ee7b7" :
    status === "running" ? "#a5b4fc" :
    status === "failed" ? "#fca5a5" :
    "#fbbf24";

  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full"
      style={{ background: color }}
    />
  );
}
