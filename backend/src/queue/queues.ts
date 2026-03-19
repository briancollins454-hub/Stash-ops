import { Queue } from "bullmq";
import { bullConnection } from "./connection";

export const EVENT_INBOX_QUEUE_NAME = "event-inbox";

export type EventInboxJobPayload = {
  eventInboxId: string;
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
