import type { Prisma } from "@prisma/client";
import { logger } from "../lib/logger";
import { buildDecoPreparedPayload } from "./deco-linking-service";

export type DecoPushResult = {
  attempted: boolean;
  succeeded: boolean;
  reason?: string;
  payload?: unknown;
};

function asJson(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function prepareOrderForDecoPush(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<DecoPushResult> {
  const payload = await buildDecoPreparedPayload(tx, orderId);
  if (!payload) {
    return {
      attempted: false,
      succeeded: false,
      reason: "Order is not preconfigured for Deco push.",
    };
  }

  await tx.order.update({
    where: { id: orderId },
    data: {
      metadata: {
        ...asJson((await tx.order.findUnique({
          where: { id: orderId },
          select: { metadata: true },
        }))?.metadata),
        decoPushPreparedAt: new Date().toISOString(),
      },
    },
  });

  await tx.activityLog.create({
    data: {
      orderId,
      eventType: "deco.push.prepared",
      message: "Deco payload prepared and ready for connector handoff.",
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info({ orderId }, "Prepared order for Deco push");

  return {
    attempted: true,
    succeeded: true,
    payload,
  };
}
