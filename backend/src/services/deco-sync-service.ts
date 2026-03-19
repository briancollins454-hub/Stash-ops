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

export async function prepareJobForDecoPush(
  tx: Prisma.TransactionClient,
  jobId: string,
): Promise<DecoPushResult> {
  const payload = await buildDecoPreparedPayload(tx, jobId);
  if (!payload) {
    return {
      attempted: false,
      succeeded: false,
      reason: "Job is not preconfigured for Deco push.",
    };
  }

  await tx.job.update({
    where: { id: jobId },
    data: {
      metadata: {
        ...asJson((await tx.job.findUnique({
          where: { id: jobId },
          select: { metadata: true },
        }))?.metadata),
        decoPushPreparedAt: new Date().toISOString(),
      },
    },
  });

  await tx.activityLog.create({
    data: {
      jobId,
      eventType: "deco.push.prepared",
      message: "Deco payload prepared and ready for connector handoff.",
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info({ jobId }, "Prepared job for Deco push");

  return {
    attempted: true,
    succeeded: true,
    payload,
  };
}
