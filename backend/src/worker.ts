import { EventProvider, EventStatus } from "@prisma/client";
import { Worker } from "bullmq";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { bullConnection, redisHealthClient } from "./queue/connection";
import { EVENT_INBOX_QUEUE_NAME, type EventInboxJobPayload } from "./queue/queues";
import {
  markEventFailed,
  markEventProcessed,
} from "./services/event-inbox-service";
import {
  processShopifyFulfillmentWebhook,
  upsertOrderFromShopify,
  type ShopifyFulfillmentPayload,
  type ShopifyOrderPayload,
} from "./services/order-service";

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
        await upsertOrderFromShopify(event.payload as unknown as ShopifyOrderPayload, {
          activityType: `shopify.${event.topic.replace("/", ".")}`,
        });
      } else if (event.topic === "fulfillments/create") {
        await processShopifyFulfillmentWebhook(event.payload as unknown as ShopifyFulfillmentPayload);
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

logger.info({ nodeEnv: env.NODE_ENV }, "Stash Ops worker started");

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down worker");
  await worker.close();
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
