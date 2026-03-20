import { EventStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env, isShopifyConfigured, isDecoConfigured } from "../config/env";
import { prisma } from "../lib/prisma";
import { eventInboxQueue } from "../queue/queues";
import { backfillShopifyUnfulfilledOrders } from "../services/shopify-service";
import { registerShopifyWebhooks, fulfillShopifyOrder } from "../services/shopify-admin-service";
import { syncDecoOrders, syncDecoProducts, syncDecoInventory, syncDecoCustomers, pushJobToDeco, updateDecoOrderStatus } from "../services/deco-api-service";
import { seedAccountsFromJobs, rematchUnmatchedJobs } from "../services/account-seed-service";

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

  app.post("/sync/deco/orders", async (request) => {
    if (!isDecoConfigured()) {
      return { ok: false, error: "DecoNetwork is not configured." };
    }
    const body = (request.body ?? {}) as { since?: string };
    const result = await syncDecoOrders({ since: body.since });
    return { ok: true, ...result };
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

  app.post("/sync/deco/all", async () => {
    if (!isDecoConfigured()) {
      return { ok: false, error: "DecoNetwork is not configured." };
    }
    const [customers, products, inventory, orders] = await Promise.all([
      syncDecoCustomers(),
      syncDecoProducts(),
      syncDecoInventory(),
      syncDecoOrders(),
    ]);
    return { ok: true, customers, products, inventory, orders };
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

    const result = await pushJobToDeco(job.id);
    return { ok: result.pushed, ...result };
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
    const rematchResult = await rematchUnmatchedJobs();
    return {
      ok: true,
      seed: seedResult,
      rematch: rematchResult,
    };
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

