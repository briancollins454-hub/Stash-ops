import { EventProvider, EventStatus } from "@prisma/client";
import { Worker } from "bullmq";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { bullConnection, redisHealthClient } from "./queue/connection";
import { EVENT_INBOX_QUEUE_NAME, DECO_SYNC_QUEUE_NAME, type EventInboxJobPayload, type DecoSyncJobPayload } from "./queue/queues";
import {
  markEventFailed,
  markEventProcessed,
} from "./services/event-inbox-service";
import {
  processShopifyFulfillmentWebhook,
  upsertJobFromShopify,
  type ShopifyFulfillmentPayload,
  type ShopifyOrderPayload,
} from "./services/order-service";
import { processDecoOrderEvent, processDecoStockEvent } from "./services/deco-event-processor";
import { syncDecoOrders, syncDecoProducts, syncDecoInventory, syncDecoCustomers } from "./services/deco-api-service";

async function processEvent(eventInboxId: string): Promise<void> {
  const event = await prisma.eventInbox.findUnique({
    where: { id: eventInboxId },
  });

  if (!event) {
    logger.warn({ eventInboxId }, "Event inbox row no longer exists");
    return;
  }

  if (event.status === EventStatus.PROCESSED || event.status === EventStatus.IGNORED) {
    return;
  }

  try {
    if (event.provider === EventProvider.SHOPIFY) {
      if (event.topic === "orders/create" || event.topic === "orders/updated" || event.topic === "orders/backfill") {
        await upsertJobFromShopify(event.payload as unknown as ShopifyOrderPayload, {
          activityType: `shopify.${event.topic.replace("/", ".")}`,
        });
      } else if (event.topic === "fulfillments/create" || event.topic === "fulfillments/update") {
        await processShopifyFulfillmentWebhook(event.payload as unknown as ShopifyFulfillmentPayload);
      } else {
        await prisma.eventInbox.update({
          where: { id: eventInboxId },
          data: { status: EventStatus.IGNORED, processedAt: new Date() },
        });
        return;
      }
    } else if (event.provider === EventProvider.DECO) {
      if (event.topic === "orders/sync" || event.topic === "orders/updated") {
        await processDecoOrderEvent(event.payload as Record<string, unknown>);
      } else if (event.topic === "stock/updated") {
        await processDecoStockEvent(event.payload as Record<string, unknown>);
      } else {
        await prisma.eventInbox.update({
          where: { id: eventInboxId },
          data: { status: EventStatus.IGNORED, processedAt: new Date() },
        });
        return;
      }
    } else {
      await prisma.eventInbox.update({
        where: { id: eventInboxId },
        data: { status: EventStatus.IGNORED, processedAt: new Date() },
      });
      return;
    }

    await markEventProcessed(eventInboxId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    await markEventFailed(eventInboxId, message);
    throw error;
  }
}

const worker = new Worker<EventInboxJobPayload>(
  EVENT_INBOX_QUEUE_NAME,
  async (job) => {
    await processEvent(job.data.eventInboxId);
  },
  {
    connection: bullConnection,
    concurrency: 10,
  },
);

worker.on("completed", (job) => {
  logger.debug({ jobId: job.id }, "Event worker job completed");
});

worker.on("failed", (job, error) => {
  logger.error(
    {
      jobId: job?.id,
      err: error,
    },
    "Event worker job failed",
  );
});

worker.on("error", (error) => {
  logger.error({ err: error }, "Worker runtime error");
});

// ── Deco Sync Worker ──
// Runs deco sync tasks in the background with no HTTP timeout pressure.

async function processDecoSync(payload: DecoSyncJobPayload, job: { updateProgress: (p: number | object) => Promise<void> }): Promise<void> {
  const { task, since, limit } = payload;
  logger.info({ task, since, limit }, "Starting Deco sync job");

  const safe = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      const result = await fn();
      logger.info({ label, result }, "Deco sync sub-task completed");
    } catch (err) {
      logger.error({ label, err }, "Deco sync sub-task failed");
    }
  };

  if (task === "orders" || task === "all") {
    await job.updateProgress({ phase: "orders" });
    await safe("orders", () => syncDecoOrders({ since, limit }));
  }
  if (task === "products" || task === "all") {
    await job.updateProgress({ phase: "products" });
    await safe("products", () => syncDecoProducts());
  }
  if (task === "inventory" || task === "all") {
    await job.updateProgress({ phase: "inventory" });
    await safe("inventory", () => syncDecoInventory());
  }
  if (task === "customers" || task === "all") {
    await job.updateProgress({ phase: "customers" });
    await safe("customers", () => syncDecoCustomers());
  }

  logger.info({ task }, "Deco sync job finished");
}

const decoSyncWorker = new Worker<DecoSyncJobPayload>(
  DECO_SYNC_QUEUE_NAME,
  async (job) => {
    await processDecoSync(job.data, job);
  },
  {
    connection: bullConnection,
    concurrency: 1, // Only run one sync at a time
  },
);

decoSyncWorker.on("completed", (job) => {
  logger.info({ jobId: job.id, task: job.data.task }, "Deco sync worker job completed");
});

decoSyncWorker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, task: job?.data.task, err: error }, "Deco sync worker job failed");
});

decoSyncWorker.on("error", (error) => {
  logger.error({ err: error }, "Deco sync worker runtime error");
});

logger.info({ nodeEnv: env.NODE_ENV }, "Stash Ops worker started");

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down worker");
  await worker.close();
  await decoSyncWorker.close();
  await prisma.$disconnect();
  redisHealthClient.disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
