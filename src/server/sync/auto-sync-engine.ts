import {
  findUnifiedOrderByRefs,
  listUnifiedOrders,
  saveUnifiedOrder,
} from "@/server/repositories/unified-order-repository";
import type {
  IntegrationSource,
  UnifiedOrderRecord,
} from "@/server/core/order-types";
import { processInboundEvent } from "@/server/core/order-orchestrator";
import {
  buildIdempotencyKey,
  extractInternalOrderIdCandidate,
  type ShopifyOrderCreatedPayload,
} from "@/server/core/order-events";
import {
  isShopifyConnectorConfigured,
  pullShopifyOrdersSince,
  pullShopifyUnfulfilledOrders,
} from "@/server/integrations/shopify-connector";
import {
  isDecoConnectorConfigured,
  upsertOrderToDeco,
} from "@/server/integrations/deco-connector";
import {
  isQboConnectorConfigured,
  pullQboInvoicesSince,
} from "@/server/integrations/qbo-connector";
import {
  isGmailConnectorConfigured,
  pullGmailMessagesSince,
} from "@/server/integrations/gmail-connector";
import {
  isSlackConnectorConfigured,
  pullSlackMessagesSince,
} from "@/server/integrations/slack-connector";

export type SyncProvider = "shopify" | "deco" | "qbo" | "shipstation" | "gmail" | "slack";
export type SyncTrigger = "manual" | "auto_stale" | "lifecycle";
export type SyncJobStatus = "queued" | "running" | "completed" | "failed";

export type SyncJob = {
  jobId: string;
  provider: SyncProvider;
  trigger: SyncTrigger;
  reason?: string;
  status: SyncJobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  scannedOrders?: number;
  changedOrders?: number;
  note?: string;
  error?: string;
};

export type SyncProviderState = {
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

type InternalSyncProviderState = SyncProviderState & {
  queue: SyncJob[];
};

type SyncEngineState = {
  providers: Record<SyncProvider, InternalSyncProviderState>;
  jobs: Map<string, SyncJob>;
  providerCursors: Partial<Record<SyncProvider, string>>;
};

const providerIntervalsMs: Record<SyncProvider, number> = {
  shopify: 90_000,
  deco: 120_000,
  qbo: 180_000,
  shipstation: 120_000,
  gmail: 150_000,
  slack: 150_000,
};

const maxRetainedJobs = 80;
const maxProviderRuntimeMs = Number(
  process.env.SYNC_PROVIDER_MAX_RUNTIME_MS ?? "900000",
);

const globalForSync = globalThis as typeof globalThis & {
  __stashSyncEngineState?: SyncEngineState;
};

function nowIso() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getInitialProviderState(provider: SyncProvider): InternalSyncProviderState {
  return {
    provider,
    running: false,
    queued: 0,
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    queue: [],
  };
}

function getState() {
  if (!globalForSync.__stashSyncEngineState) {
    globalForSync.__stashSyncEngineState = {
      providers: {
        shopify: getInitialProviderState("shopify"),
        deco: getInitialProviderState("deco"),
        qbo: getInitialProviderState("qbo"),
        shipstation: getInitialProviderState("shipstation"),
        gmail: getInitialProviderState("gmail"),
        slack: getInitialProviderState("slack"),
      },
      jobs: new Map(),
      providerCursors: {},
    };
  }

  const state = globalForSync.__stashSyncEngineState as Partial<SyncEngineState>;

  if (!state.providers) {
    state.providers = {
      shopify: getInitialProviderState("shopify"),
      deco: getInitialProviderState("deco"),
      qbo: getInitialProviderState("qbo"),
      shipstation: getInitialProviderState("shipstation"),
      gmail: getInitialProviderState("gmail"),
      slack: getInitialProviderState("slack"),
    };
  }

  (Object.keys(providerIntervalsMs) as SyncProvider[]).forEach((provider) => {
    const providers = state.providers as Record<string, unknown>;
    const existing = providers[provider];

    if (!existing || typeof existing !== "object") {
      providers[provider] = getInitialProviderState(provider);
    }

    const providerState = providers[provider] as InternalSyncProviderState;
    providerState.provider = provider;
    providerState.queue = Array.isArray(providerState.queue) ? providerState.queue : [];
    providerState.queued = providerState.queue.length;
    providerState.running = Boolean(providerState.running);
    providerState.totalRuns = Number.isFinite(providerState.totalRuns)
      ? providerState.totalRuns
      : 0;
    providerState.successfulRuns = Number.isFinite(providerState.successfulRuns)
      ? providerState.successfulRuns
      : 0;
    providerState.failedRuns = Number.isFinite(providerState.failedRuns)
      ? providerState.failedRuns
      : 0;
  });

  const nowMs = Date.now();
  (Object.keys(providerIntervalsMs) as SyncProvider[]).forEach((provider) => {
    const providerState = (state.providers as Record<SyncProvider, InternalSyncProviderState>)[provider];
    if (!providerState.running || !providerState.lastStartedAt) {
      return;
    }

    const startedAtMs = new Date(providerState.lastStartedAt).getTime();
    if (Number.isNaN(startedAtMs)) {
      return;
    }

    if (nowMs - startedAtMs > maxProviderRuntimeMs) {
      providerState.running = false;
      providerState.lastError = `Recovered stale ${provider} sync lock after ${Math.floor(
        (nowMs - startedAtMs) / 1000,
      )}s.`;
    }
  });

  if (!(state.jobs instanceof Map)) {
    const iterableJobs = Array.isArray(state.jobs)
      ? state.jobs
      : Object.values((state.jobs ?? {}) as Record<string, SyncJob>);
    state.jobs = new Map(
      iterableJobs.filter((job): job is SyncJob => Boolean(job?.jobId)).map((job) => [job.jobId, job]),
    );
  }

  if (!state.providerCursors || typeof state.providerCursors !== "object") {
    state.providerCursors = {};
  }

  globalForSync.__stashSyncEngineState = state as SyncEngineState;
  return globalForSync.__stashSyncEngineState;
}

function trimJobs(state: SyncEngineState) {
  const allJobs = Array.from(state.jobs.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );

  if (allJobs.length <= maxRetainedJobs) {
    return;
  }

  allJobs.slice(maxRetainedJobs).forEach((job) => {
    state.jobs.delete(job.jobId);
  });
}

function providerSource(provider: SyncProvider): IntegrationSource {
  switch (provider) {
    case "shopify":
      return "shopify";
    case "deco":
      return "deco";
    case "gmail":
      return "gmail";
    case "slack":
      return "slack";
    case "qbo":
    case "shipstation":
      return "system";
    default:
      return "system";
  }
}

function appendIntegrationActivity(
  order: UnifiedOrderRecord,
  provider: SyncProvider,
  message: string,
) {
  order.activityLog.push({
    activityId: randomId("act-sync"),
    type: "integration_sync",
    message,
    actor: "sync.engine",
    source: providerSource(provider),
    createdAt: nowIso(),
  });
  order.updatedAt = nowIso();
}

function buildDecoOrderId(internalOrderId: string) {
  const suffix = internalOrderId.replace(/^ST-/, "");
  return `DE-${suffix}`;
}

function normalizeShopifyCursor(cursor?: string) {
  if (!cursor) {
    return new Date(Date.now() - 1000 * 60 * 30).toISOString();
  }

  const timestamp = new Date(cursor);
  if (Number.isNaN(timestamp.getTime())) {
    return new Date(Date.now() - 1000 * 60 * 30).toISOString();
  }

  return cursor;
}

function normalizeSyncCursor(cursor?: string, fallbackMinutes = 30) {
  if (!cursor) {
    return new Date(Date.now() - 1000 * 60 * fallbackMinutes).toISOString();
  }

  const timestamp = new Date(cursor);
  if (Number.isNaN(timestamp.getTime())) {
    return new Date(Date.now() - 1000 * 60 * fallbackMinutes).toISOString();
  }

  return cursor;
}

function isLikelyCreate(payload: ShopifyOrderCreatedPayload) {
  if (!payload.createdAt || !payload.updatedAt) {
    return false;
  }

  const createdAt = new Date(payload.createdAt).getTime();
  const updatedAt = new Date(payload.updatedAt).getTime();
  if (Number.isNaN(createdAt) || Number.isNaN(updatedAt)) {
    return false;
  }

  return Math.abs(updatedAt - createdAt) < 2_000;
}

async function runShopifySync() {
  if (!isShopifyConnectorConfigured()) {
    return {
      scannedOrders: 0,
      changedOrders: 0,
      note: "Shopify connector not configured. Set SHOPIFY_DOMAIN and SHOPIFY_ACCESS_TOKEN.",
    };
  }

  const state = getState();
  const shopifyCursor = state.providerCursors?.shopify;
  const bootstrapBackfill = !shopifyCursor;
  const cursor = normalizeShopifyCursor(shopifyCursor);
  const pull = bootstrapBackfill
    ? await pullShopifyUnfulfilledOrders()
    : await pullShopifyOrdersSince(cursor);

  let changedOrders = 0;
  for (const payload of pull.orders) {
    const eventType = isLikelyCreate(payload)
      ? "shopify.order.created"
      : "shopify.order.updated";
    const idempotencyNative =
      `${payload.id}:${payload.updatedAt ?? payload.createdAt ?? "unknown"}`;

    const result = await processInboundEvent({
      eventId: randomId("shopify-poll"),
      idempotencyKey: buildIdempotencyKey("shopify", eventType, `poll-${idempotencyNative}`),
      source: "shopify",
      eventType,
      occurredAt: payload.updatedAt ?? nowIso(),
      refs: {
        shopifyOrderId: payload.id,
      },
      payload,
    });

    if (!("duplicate" in result && result.duplicate)) {
      changedOrders += 1;
    }
  }

  if (pull.latestUpdatedAt) {
    if (!state.providerCursors || typeof state.providerCursors !== "object") {
      state.providerCursors = {};
    }
    state.providerCursors.shopify = pull.latestUpdatedAt;
  }

  return {
    scannedOrders: pull.orders.length,
    changedOrders,
    note:
      bootstrapBackfill
        ? pull.orders.length > 0
          ? `Backfill synced ${pull.orders.length} unfulfilled Shopify order(s).`
          : "Backfill completed: no unfulfilled Shopify orders found."
        : pull.orders.length > 0
          ? `Pulled ${pull.orders.length} Shopify update(s) from live API.`
          : "No new Shopify updates since last cursor.",
  };
}

async function runDecoSync() {
  const orders = await listUnifiedOrders();
  const completedOrders = orders.filter((order) => order.production.stage === "complete");

  if (!isDecoConnectorConfigured()) {
    return {
      scannedOrders: completedOrders.length,
      changedOrders: 0,
      note:
        "Deco connector not configured. Set DECO_ORDER_UPSERT_URL to enable live upsert.",
    };
  }

  let changedOrders = 0;

  for (const order of completedOrders) {
    const needsSync = !order.externalReferences.decoOrderId;

    if (!needsSync) {
      continue;
    }

    const upsert = await upsertOrderToDeco(order);
    order.externalReferences.decoOrderId =
      upsert.decoOrderId ?? order.externalReferences.decoOrderId ?? buildDecoOrderId(order.internalOrderId);
    appendIntegrationActivity(
      order,
      "deco",
      `Auto-sync pushed order to Deco (${order.externalReferences.decoOrderId}).`,
    );
    await saveUnifiedOrder(order);
    changedOrders += 1;
  }

  return {
    scannedOrders: completedOrders.length,
    changedOrders,
    note:
      changedOrders > 0
        ? `Upserted ${changedOrders} completed order(s) into Deco.`
        : "No completed orders needed Deco upsert.",
  };
}

async function runQboSync() {
  if (!isQboConnectorConfigured()) {
    return {
      scannedOrders: 0,
      changedOrders: 0,
      note: "QBO connector not configured. Set QBO_REALM_ID and QBO_ACCESS_TOKEN.",
    };
  }

  const state = getState();
  const cursor = normalizeSyncCursor(state.providerCursors.qbo, 120);
  const pull = await pullQboInvoicesSince(cursor);

  let changedOrders = 0;
  for (const invoice of pull.invoices) {
    const internalOrderId = extractInternalOrderIdCandidate(
      `${invoice.docNumber ?? ""} ${invoice.privateNote ?? ""}`,
    );
    if (!internalOrderId) {
      continue;
    }

    const order = await findUnifiedOrderByRefs({ internalOrderId });
    if (!order) {
      continue;
    }

    appendIntegrationActivity(
      order,
      "qbo",
      `QBO invoice sync matched ${invoice.docNumber ?? invoice.id}.`,
    );
    await saveUnifiedOrder(order);
    changedOrders += 1;
  }

  if (pull.latestUpdatedAt) {
    state.providerCursors.qbo = pull.latestUpdatedAt;
  }

  return {
    scannedOrders: pull.invoices.length,
    changedOrders,
    note:
      pull.invoices.length > 0
        ? `Pulled ${pull.invoices.length} QBO invoice update(s).`
        : "No new QBO updates since last cursor.",
  };
}

async function runGmailSync() {
  if (!isGmailConnectorConfigured()) {
    return {
      scannedOrders: 0,
      changedOrders: 0,
      note: "Gmail connector not configured. Set GMAIL_ACCESS_TOKEN.",
    };
  }

  const state = getState();
  const cursor = normalizeSyncCursor(state.providerCursors.gmail, 60);
  const pull = await pullGmailMessagesSince(cursor);
  let changedOrders = 0;

  for (const message of pull.messages) {
    const internalOrderId = extractInternalOrderIdCandidate(
      `${message.subject ?? ""} ${message.snippet ?? ""}`,
    );

    if (!internalOrderId) {
      continue;
    }

    const eventNative = `${message.messageId}:${message.internalDate ?? "unknown"}`;
    const result = await processInboundEvent({
      eventId: randomId("gmail-poll"),
      idempotencyKey: buildIdempotencyKey(
        "gmail",
        "gmail.message.received",
        `poll-${eventNative}`,
      ),
      source: "gmail",
      eventType: "gmail.message.received",
      occurredAt: message.internalDate ?? nowIso(),
      refs: {
        internalOrderId,
        gmailThreadId: message.threadId,
      },
      payload: {
        threadId: message.threadId,
        messageId: message.messageId,
        subject: message.subject,
        snippet: message.snippet,
      },
    });

    if (!("duplicate" in result && result.duplicate)) {
      changedOrders += 1;
    }
  }

  if (pull.latestInternalDate) {
    state.providerCursors.gmail = pull.latestInternalDate;
  }

  return {
    scannedOrders: pull.messages.length,
    changedOrders,
    note:
      pull.messages.length > 0
        ? `Pulled ${pull.messages.length} Gmail message update(s).`
        : "No new Gmail updates since last cursor.",
  };
}

async function runSlackSync() {
  if (!isSlackConnectorConfigured()) {
    return {
      scannedOrders: 0,
      changedOrders: 0,
      note: "Slack connector not configured. Set SLACK_BOT_TOKEN and SLACK_CHANNEL_IDS.",
    };
  }

  const state = getState();
  const cursor = normalizeSyncCursor(state.providerCursors.slack, 60);
  const pull = await pullSlackMessagesSince(cursor);
  let changedOrders = 0;

  for (const message of pull.messages) {
    const internalOrderId = extractInternalOrderIdCandidate(message.text);
    if (!internalOrderId) {
      continue;
    }

    const result = await processInboundEvent({
      eventId: randomId("slack-poll"),
      idempotencyKey: buildIdempotencyKey(
        "slack",
        "slack.alert.received",
        `poll-${message.channelId}:${message.ts}`,
      ),
      source: "slack",
      eventType: "slack.alert.received",
      occurredAt: nowIso(),
      refs: {
        internalOrderId,
      },
      payload: {
        text: message.text,
        thread_ts: message.threadTs ?? message.ts,
      },
    });

    if (!("duplicate" in result && result.duplicate)) {
      changedOrders += 1;
    }
  }

  if (pull.latestTs) {
    state.providerCursors.slack = pull.latestTs;
  }

  return {
    scannedOrders: pull.messages.length,
    changedOrders,
    note:
      pull.messages.length > 0
        ? `Pulled ${pull.messages.length} Slack message update(s).`
        : "No new Slack updates since last cursor.",
  };
}

async function runProviderSync(provider: SyncProvider, job?: SyncJob) {
  if (provider === "shopify") {
    const forceBackfill = (job?.reason ?? "")
      .toLowerCase()
      .includes("backfill-unfulfilled");

    if (forceBackfill) {
      const state = getState();
      if (!state.providerCursors || typeof state.providerCursors !== "object") {
        state.providerCursors = {};
      } else {
        delete state.providerCursors.shopify;
      }
    }
    return runShopifySync();
  }

  if (provider === "deco") {
    return runDecoSync();
  }

  if (provider === "qbo") {
    return runQboSync();
  }

  if (provider === "gmail") {
    return runGmailSync();
  }

  if (provider === "slack") {
    return runSlackSync();
  }

  const orders = await listUnifiedOrders();

  const scannedOrders = orders.length;
  const shipmentReady = orders.filter(
    (order) =>
      order.production.stage === "ready_for_dispatch" ||
      order.production.stage === "dispatched",
  ).length;

  return {
    scannedOrders,
    changedOrders: 0,
    note: `${shipmentReady} order(s) currently in ship-ready lane.`,
  };
}

async function drainProviderQueue(provider: SyncProvider) {
  const state = getState();
  const providerState = state.providers[provider];

  if (providerState.running) {
    return;
  }

  providerState.running = true;

  try {
    while (providerState.queue.length > 0) {
      const job = providerState.queue.shift();
      if (!job) {
        break;
      }

      providerState.queued = providerState.queue.length;
      providerState.lastStartedAt = nowIso();
      providerState.totalRuns += 1;

      job.status = "running";
      job.startedAt = providerState.lastStartedAt;
      state.jobs.set(job.jobId, job);

      const startedMs = Date.now();

      try {
        const result = await runProviderSync(provider, job);
        const finishedAt = nowIso();

        job.status = "completed";
        job.finishedAt = finishedAt;
        job.durationMs = Date.now() - startedMs;
        job.scannedOrders = result.scannedOrders;
        job.changedOrders = result.changedOrders;
        job.note = result.note;

        providerState.lastCompletedAt = finishedAt;
        providerState.lastSuccessAt = finishedAt;
        providerState.successfulRuns += 1;
        providerState.lastError = undefined;
      } catch (error) {
        const finishedAt = nowIso();
        const message = error instanceof Error ? error.message : "Unknown sync error.";

        job.status = "failed";
        job.finishedAt = finishedAt;
        job.durationMs = Date.now() - startedMs;
        job.error = message;

        providerState.lastCompletedAt = finishedAt;
        providerState.lastError = message;
        providerState.failedRuns += 1;
      } finally {
        state.jobs.set(job.jobId, job);
        trimJobs(state);
      }
    }
  } finally {
    providerState.running = false;
    providerState.queued = providerState.queue.length;
  }
}

function hasActiveOrQueued(provider: SyncProvider) {
  const state = getState();
  const providerState = state.providers[provider];
  return providerState.running || providerState.queue.length > 0;
}

export function enqueueSyncJob(
  provider: SyncProvider,
  trigger: SyncTrigger = "manual",
  reason?: string,
) {
  const state = getState();
  const providerState = state.providers[provider];

  const job: SyncJob = {
    jobId: randomId(`sync-${provider}`),
    provider,
    trigger,
    reason,
    status: "queued",
    createdAt: nowIso(),
  };

  providerState.queue.push(job);
  providerState.queued = providerState.queue.length;
  state.jobs.set(job.jobId, job);
  trimJobs(state);

  void drainProviderQueue(provider);
  return clone(job);
}

export function runAutoSyncIfStale() {
  const state = getState();
  const now = Date.now();
  const scheduled: SyncProvider[] = [];

  (Object.keys(providerIntervalsMs) as SyncProvider[]).forEach((provider) => {
    const providerState = state.providers[provider];
    const lastFreshAt = providerState.lastSuccessAt ?? providerState.lastCompletedAt;
    const stale =
      !lastFreshAt || now - new Date(lastFreshAt).getTime() >= providerIntervalsMs[provider];

    if (stale && !hasActiveOrQueued(provider)) {
      enqueueSyncJob(provider, "auto_stale", "Stale interval threshold exceeded.");
      scheduled.push(provider);
    }
  });

  return scheduled;
}

export function getSyncEngineStatus() {
  const state = getState();
  const providers = (Object.keys(state.providers) as SyncProvider[]).map((provider) => {
    const current = state.providers[provider];
    return clone({
      provider: current.provider,
      running: current.running,
      queued: current.queued,
      lastStartedAt: current.lastStartedAt,
      lastCompletedAt: current.lastCompletedAt,
      lastSuccessAt: current.lastSuccessAt,
      lastError: current.lastError,
      totalRuns: current.totalRuns,
      successfulRuns: current.successfulRuns,
      failedRuns: current.failedRuns,
    });
  });

  const jobs = Array.from(state.jobs.values())
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 30)
    .map((job) => clone(job));

  return {
    providers,
    jobs,
    generatedAt: nowIso(),
  };
}
