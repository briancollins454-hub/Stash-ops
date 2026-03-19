import type { Prisma } from "@prisma/client";

type JsonObject = Record<string, unknown>;

function asJson(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

export type CommunicationEventInput = {
  channel: "gmail" | "slack" | "internal";
  direction: "inbound" | "outbound" | "internal";
  subject: string;
  bodyPreview?: string;
  externalMessageId?: string;
  actor: string;
};

export async function appendCommunicationEvent(
  tx: Prisma.TransactionClient,
  orderId: string,
  input: CommunicationEventInput,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { metadata: true },
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  const metadata = asJson(order.metadata);
  const communications = asJson(metadata.communications);
  const timeline = Array.isArray(communications.timeline) ? communications.timeline : [];

  const event = {
    channel: input.channel,
    direction: input.direction,
    subject: input.subject,
    bodyPreview: input.bodyPreview ?? "",
    externalMessageId: input.externalMessageId ?? null,
    actor: input.actor,
    createdAt: new Date().toISOString(),
  };

  await tx.order.update({
    where: { id: orderId },
    data: {
      metadata: {
        ...metadata,
        communications: {
          ...communications,
          timeline: [...timeline, event],
          lastMessageAt: event.createdAt,
        },
      },
    },
  });

  await tx.activityLog.create({
    data: {
      orderId,
      eventType: "communication.logged",
      message: `${input.channel.toUpperCase()} ${input.direction} communication recorded.`,
      payload: event,
    },
  });
}

