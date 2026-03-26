import { EventStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env, isShopifyConfigured, isDecoConfigured } from "../config/env";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { eventInboxQueue, decoSyncQueue } from "../queue/queues";
import { backfillShopifyUnfulfilledOrders } from "../services/shopify-service";
import { registerShopifyWebhooks, fulfillShopifyOrder } from "../services/shopify-admin-service";
import { syncDecoProducts, syncDecoInventory, syncDecoCustomers, pushJobToDeco, updateDecoOrderStatus, inspectDecoOrder, probeDecoOrderApi, probeDecoDesigns, scrapeDecoArtwork, scrapeDecoOrderArtwork, probeCustomerDesigns, probeDesignApi } from "../services/deco-api-service";
import { seedAccountsFromJobs, rematchUnmatchedJobs, seedAccountsFromDecoCustomers, backfillDecoJobSourceGroups } from "../services/account-seed-service";
import { processDecoOrderEvent } from "../services/deco-event-processor";

const backfillSchema = z.object({
  maxPages: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(250).optional(),
});

export async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
  // ── Shopify sync ──

  app.post("/sync/shopify/backfill", async (request) => {
    const body = backfillSchema.parse(request.body ?? {});
    const result = await backfillShopifyUnfulfilledOrders(body);
    return { ok: true, provider: "shopify", ...result };
  });

  app.post("/sync/shopify/register-webhooks", async () => {
    if (!isShopifyConfigured()) {
      return { ok: false, error: "Shopify is not configured." };
    }

    const callbackBase = env.PUBLIC_URL;
    if (!callbackBase) {
      return { ok: false, error: "PUBLIC_URL is not set. Webhooks need a public callback URL." };
    }

    const result = await registerShopifyWebhooks(callbackBase);
    return { ok: true, provider: "shopify", ...result };
  });

  app.post("/sync/shopify/fulfill/:jobId", async (request) => {
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.job.findFirst({
      where: { OR: [{ id: jobId }, { internalJobId: jobId }] },
      select: { id: true, shopifyOrderId: true, internalJobId: true },
    });

    if (!job) {
      return { ok: false, error: "Job not found." };
    }

    if (!job.shopifyOrderId) {
      return { ok: false, error: "Job has no linked Shopify order." };
    }

    const result = await fulfillShopifyOrder(job.shopifyOrderId);

    if (result.fulfilled) {
      await prisma.activityLog.create({
        data: {
          jobId: job.id,
          eventType: "shopify.fulfillment.created",
          message: result.alreadyFulfilled
            ? "Shopify order was already fulfilled."
            : `Shopify order marked as fulfilled (${result.fulfillmentId ?? "ok"}).`,
        },
      });
    }

    return { ok: result.fulfilled, ...result };
  });

  // ── Deco sync ──
  // These enqueue background jobs via BullMQ so they're not limited by HTTP timeouts.

  app.post("/sync/deco/orders", async (request) => {
    if (!isDecoConfigured()) {
      return { ok: false, error: "DecoNetwork is not configured." };
    }
    const body = (request.body ?? {}) as { since?: string; limit?: number };
    const job = await decoSyncQueue.add("deco-sync", { task: "orders", since: body.since, limit: body.limit }, {
      jobId: `deco-orders-${Date.now()}`,
    });
    return { ok: true, queued: true, jobId: job.id, message: "Deco order sync enqueued. Check /sync/deco/status for progress." };
  });

  app.post("/sync/deco/products", async () => {
    if (!isDecoConfigured()) {
      return { ok: false, error: "DecoNetwork is not configured." };
    }
    const result = await syncDecoProducts();
    return { ok: true, ...result };
  });

  app.post("/sync/deco/inventory", async () => {
    if (!isDecoConfigured()) {
      return { ok: false, error: "DecoNetwork is not configured." };
    }
    const result = await syncDecoInventory();
    return { ok: true, ...result };
  });

  app.post("/sync/deco/customers", async () => {
    if (!isDecoConfigured()) {
      return { ok: false, error: "DecoNetwork is not configured." };
    }
    const result = await syncDecoCustomers();
    return { ok: true, ...result };
  });

  app.post("/sync/deco/all", async (request) => {
    if (!isDecoConfigured()) {
      return { ok: false, error: "DecoNetwork is not configured." };
    }
    const body = (request.body ?? {}) as { since?: string; limit?: number };
    const job = await decoSyncQueue.add("deco-sync", { task: "all", since: body.since, limit: body.limit }, {
      jobId: `deco-all-${Date.now()}`,
    });
    return { ok: true, queued: true, jobId: job.id, message: "Full Deco sync enqueued. Check /sync/deco/status for progress." };
  });

  app.get("/sync/deco/status", async () => {
    const counts = await decoSyncQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
    const active = await decoSyncQueue.getActive();
    const waiting = await decoSyncQueue.getWaiting();
    const completed = await decoSyncQueue.getCompleted(0, 5);
    const failed = await decoSyncQueue.getFailed(0, 5);

    return {
      ok: true,
      queue: counts,
      active: active.map(j => ({ id: j.id, task: j.data.task, since: j.data.since, progress: j.progress })),
      waiting: waiting.map(j => ({ id: j.id, task: j.data.task })),
      recentCompleted: completed.map(j => ({ id: j.id, task: j.data.task, finishedAt: j.finishedOn })),
      recentFailed: failed.map(j => ({ id: j.id, task: j.data.task, failedReason: j.failedReason })),
    };
  });

  app.post("/sync/deco/push/:jobId", async (request) => {
    const { jobId } = request.params as { jobId: string };

    const job = await prisma.job.findFirst({
      where: { OR: [{ id: jobId }, { internalJobId: jobId }] },
      select: { id: true },
    });

    if (!job) {
      return { ok: false, error: "Job not found." };
    }

    try {
      const result = await pushJobToDeco(job.id);
      return { ok: result.pushed, ...result, _debug: result._debug };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ jobId: job.id, error: msg, stack: err instanceof Error ? err.stack : undefined }, "pushJobToDeco failed");
      return { ok: false, error: msg };
    }
  });

  app.get("/sync/deco/inspect/:decoOrderId", async (request) => {
    const { decoOrderId } = request.params as { decoOrderId: string };
    const result = await inspectDecoOrder(decoOrderId);
    return result;
  });

  app.get("/sync/deco/probe-api", async () => {
    const result = await probeDecoOrderApi();
    return result;
  });

  app.get("/sync/deco/probe-designs", async (request) => {
    const { customerId } = request.query as { customerId?: string };
    const result = await probeDecoDesigns(customerId);
    return result;
  });

  app.get("/sync/deco/scrape-artwork", async (request) => {
    const { customerId } = request.query as { customerId?: string };
    const result = await scrapeDecoArtwork(customerId);
    return result;
  });

  app.get("/sync/deco/scrape-order-artwork", async (request) => {
    const { limit, customerId } = request.query as { limit?: string; customerId?: string };
    const result = await scrapeDecoOrderArtwork({ limit: limit ? parseInt(limit) : undefined, customerId });
    return result;
  });

  app.get("/sync/deco/probe-customer-designs", async (request) => {
    const { customerId, orderId } = request.query as { customerId?: string; orderId?: string };
    if (!customerId) return { error: "customerId query param required" };
    const result = await probeCustomerDesigns(customerId, orderId);
    return result;
  });

  app.get("/sync/deco/probe-design-api", async () => {
    return probeDesignApi();
  });

  // ── Deco reprocess existing events into Jobs ──

  app.post("/sync/deco/reprocess", async (request) => {
    const body = (request.body ?? {}) as { batchSize?: number; afterId?: string };
    const batchSize = Math.min(body.batchSize ?? 500, 2000);

    // Get all DECO order event IDs that already have an ExternalLink (i.e. already ingested)
    // Use cursor-based approach: skip events where a Job already exists with that decoOrderId
    const events = await prisma.eventInbox.findMany({
      where: {
        provider: "DECO",
        topic: "orders/sync",
        status: EventStatus.PROCESSED,
        ...(body.afterId ? { id: { gt: body.afterId } } : {}),
      },
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true, payload: true },
    });

    let created = 0;
    let skipped = 0;
    let errors = 0;
    let lastId = body.afterId ?? "";

    for (const event of events) {
      lastId = event.id;
      try {
        const payload = event.payload as Record<string, unknown>;
        const orderId = String(payload.order_id ?? payload.id ?? payload.orderId ?? "");

        // Skip if job already exists for this deco order
        if (orderId) {
          const exists = await prisma.job.findFirst({
            where: { decoOrderId: orderId },
            select: { id: true },
          });
          if (exists) {
            skipped += 1;
            continue;
          }
        }

        await processDecoOrderEvent(payload);
        created += 1;
      } catch (err) {
        errors += 1;
        logger.error({ eventId: event.id, err }, "Failed to reprocess Deco event");
      }
    }

    return {
      ok: true,
      total: events.length,
      created,
      skipped,
      errors,
      lastId,
      hasMore: events.length === batchSize,
      message: events.length < batchSize
        ? "All events processed."
        : `Processed batch of ${batchSize}. Call again with afterId="${lastId}" to continue.`,
    };
  });

  // ── Account seeding & matching ──

  app.post("/sync/accounts/seed", async () => {
    const result = await seedAccountsFromJobs();
    return { ok: true, ...result };
  });

  app.post("/sync/accounts/rematch", async () => {
    const result = await rematchUnmatchedJobs();
    return { ok: true, ...result };
  });

  app.post("/sync/accounts/seed-and-rematch", async () => {
    const seedResult = await seedAccountsFromJobs();
    const decoSeedResult = await seedAccountsFromDecoCustomers();
    const backfillResult = await backfillDecoJobSourceGroups();
    const rematchResult = await rematchUnmatchedJobs();
    return {
      ok: true,
      seed: seedResult,
      decoSeed: decoSeedResult,
      backfill: backfillResult,
      rematch: rematchResult,
    };
  });

  app.post("/sync/accounts/seed-from-deco", async () => {
    const seedResult = await seedAccountsFromDecoCustomers();
    const backfillResult = await backfillDecoJobSourceGroups();
    return { ok: true, seed: seedResult, backfill: backfillResult };
  });

  // ── Unified sync status ──

  app.get("/sync/status", async () => {
    const [received, processed, failed, queueCounts, cursors, decoProductCount, decoInventoryCount, decoCustomerCount] = await Promise.all([
      prisma.eventInbox.count({ where: { status: EventStatus.RECEIVED } }),
      prisma.eventInbox.count({ where: { status: EventStatus.PROCESSED } }),
      prisma.eventInbox.count({ where: { status: EventStatus.FAILED } }),
      eventInboxQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
      prisma.syncCursor.findMany({
        orderBy: { provider: "asc" },
      }),
      prisma.decoProduct.count(),
      prisma.decoInventory.count(),
      prisma.decoCustomer.count(),
    ]);

    return {
      ok: true,
      shopify: { configured: isShopifyConfigured() },
      deco: {
        configured: isDecoConfigured(),
        products: decoProductCount,
        inventory: decoInventoryCount,
        customers: decoCustomerCount,
      },
      events: { received, processed, failed },
      queue: queueCounts,
      cursors,
    };
  });
}

