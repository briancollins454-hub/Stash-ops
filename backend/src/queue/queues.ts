import { Queue } from "bullmq";
import { bullConnection } from "./connection";

export const EVENT_INBOX_QUEUE_NAME = "event-inbox";
export const DECO_SYNC_QUEUE_NAME = "deco-sync";

export type EventInboxJobPayload = {
  eventInboxId: string;
};

export type DecoSyncJobPayload = {
  task: "orders" | "products" | "inventory" | "customers" | "all";
  since?: string;
  limit?: number;
};

export const eventInboxQueue = new Queue<EventInboxJobPayload, unknown, "process-event">(EVENT_INBOX_QUEUE_NAME, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2_000,
    },
    removeOnComplete: 2_000,
    removeOnFail: 10_000,
  },
});

export const decoSyncQueue = new Queue<DecoSyncJobPayload>(DECO_SYNC_QUEUE_NAME, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});
