import { EventProvider, EventStatus, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { enqueueEventInboxJob } from "../queue/jobs";

type CreateEventInput = {
  provider: EventProvider;
  topic: string;
  externalId?: string | null;
  idempotencyKey: string;
  payload: Prisma.InputJsonValue;
};

export async function createInboxEvent(input: CreateEventInput): Promise<string> {
  const existing = await prisma.eventInbox.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.eventInbox.create({
    data: {
      provider: input.provider,
      topic: input.topic,
      externalId: input.externalId ?? undefined,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      status: EventStatus.RECEIVED,
    },
    select: { id: true },
  });

  await enqueueEventInboxJob({ eventInboxId: created.id });

  return created.id;
}

export async function markEventProcessed(eventInboxId: string): Promise<void> {
  await prisma.eventInbox.update({
    where: { id: eventInboxId },
    data: {
      status: EventStatus.PROCESSED,
      processedAt: new Date(),
      errorMessage: null,
    },
  });
}

export async function markEventFailed(eventInboxId: string, message: string): Promise<void> {
  await prisma.eventInbox.update({
    where: { id: eventInboxId },
    data: {
      status: EventStatus.FAILED,
      errorMessage: message.slice(0, 1_000),
    },
  });
}

export function buildPayloadHash(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

