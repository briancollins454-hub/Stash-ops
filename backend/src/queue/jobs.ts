import { eventInboxQueue, type EventInboxJobPayload } from "./queues";

export async function enqueueEventInboxJob(payload: EventInboxJobPayload): Promise<void> {
  await eventInboxQueue.add("process-event", payload, {
    jobId: `event_${payload.eventInboxId}`,
  });
}

