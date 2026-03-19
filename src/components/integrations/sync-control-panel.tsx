"use client";

import { useEffect, useState } from "react";

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
  scheduledProviders?: SyncProvider[];
};

const providerOrder: SyncProvider[] = [
  "shopify",
  "deco",
  "qbo",
  "shipstation",
  "gmail",
  "slack",
];

function formatDate(value?: string) {
  if (!value) {
    return "never";
  }

  return new Date(value).toLocaleTimeString();
}

export function SyncControlPanel() {
  const [status, setStatus] = useState<SyncStatusPayload["data"] | null>(null);
  const [busyProvider, setBusyProvider] = useState<SyncProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = async () => {
    try {
      const response = await fetch("/api/sync/status", {
        cache: "no-store",
      });
      const payload = (await response.json()) as SyncStatusPayload;
      setStatus(payload.data);
      setError(null);
    } catch {
      setError("Unable to load sync status.");
    }
  };

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 12_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const triggerSync = async (provider: SyncProvider) => {
    setBusyProvider(provider);
    setError(null);

    try {
      await fetch(`/api/sync/${provider}`, {
        method: "POST",
      });
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
      await fetch("/api/sync/shopify/backfill", {
        method: "POST",
      });
      await refreshStatus();
    } catch {
      setError("Unable to queue Shopify unfulfilled backfill.");
    } finally {
      setBusyProvider(null);
    }
  };

  const providerStates = status?.providers ?? [];
  const recentJobs = status?.jobs ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {providerOrder.map((provider) => {
          const providerState = providerStates.find((state) => state.provider === provider);

          return (
            <article
              key={provider}
              className="record-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/90">
                  {provider}
                </p>
                <span className="data-pill">
                  {providerState?.running ? "running" : "idle"}
                </span>
              </div>
              <p className="mt-3 text-xs text-white/62">
                Queue {providerState?.queued ?? 0} · Success{" "}
                {providerState?.successfulRuns ?? 0}/{providerState?.totalRuns ?? 0}
              </p>
              <p className="mt-1 text-xs text-white/52">
                Last success {formatDate(providerState?.lastSuccessAt)}
              </p>
              {providerState?.lastError ? (
                <p className="mt-2 text-xs text-rose-300">{providerState.lastError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => triggerSync(provider)}
                disabled={busyProvider === provider}
                className="ui-control mt-3 rounded-full border border-white/20 bg-white/[0.08] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyProvider === provider ? "Queueing..." : "Sync now"}
              </button>
              {provider === "shopify" ? (
                <button
                  type="button"
                  onClick={triggerShopifyBackfill}
                  disabled={busyProvider === provider}
                  className="ui-control mt-2 rounded-full border border-cyan-200/35 bg-cyan-300/16 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-cyan-50 transition hover:bg-cyan-300/24 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyProvider === provider
                    ? "Queueing..."
                    : "Backfill unfulfilled"}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>

      <article className="record-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Recent sync jobs</p>
          <button
            type="button"
            onClick={() => void refreshStatus()}
            className="ui-control rounded-full border border-white/20 bg-white/[0.08] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-white/80 transition hover:bg-white/[0.16]"
          >
            Refresh
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {recentJobs.slice(0, 8).map((job) => (
            <div
              key={job.jobId}
              className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-xs text-white/72"
            >
              <span className="font-semibold text-white/90">{job.provider}</span> · {job.status} ·{" "}
              {job.trigger} · {formatDate(job.createdAt)}
              {job.note ? <span className="block mt-1 text-white/56">{job.note}</span> : null}
              {job.error ? <span className="block mt-1 text-rose-300">{job.error}</span> : null}
            </div>
          ))}
          {recentJobs.length === 0 ? (
            <p className="text-xs text-white/52">No sync jobs yet.</p>
          ) : null}
        </div>
      </article>

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
