import { ExternalProvider, type Prisma } from "@prisma/client";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

type JsonObject = Record<string, unknown>;

// ── Deco order event processing ──
// Called by the worker when a Deco order event is dequeued.
// Updates existing linked jobs or creates activity log entries for unlinked orders.

export async function processDecoOrderEvent(payload: JsonObject): Promise<void> {
  const decoOrderId = String(payload.id ?? payload.orderId ?? "");
  if (!decoOrderId) {
    logger.warn({ payload }, "Deco order event missing id");
    return;
  }

  const decoJobNumber = (payload.jobNumber ?? payload.orderNumber ?? undefined) as string | undefined;
  const status = (payload.status ?? undefined) as string | undefined;

  // Find linked job via external link
  const link = await prisma.externalLink.findUnique({
    where: {
      provider_externalId: {
        provider: ExternalProvider.DECO_ORDER,
        externalId: decoOrderId,
      },
    },
    select: { jobId: true },
  });

  if (link) {
    // Update existing job with latest Deco status
    await prisma.$transaction(async (tx) => {
      const updateData: Prisma.JobUpdateInput = {};

      if (decoJobNumber) {
        updateData.decoOrderId = decoOrderId;
      }

      if (status) {
        updateData.metadata = {
          ...(await getJobMetadata(tx, link.jobId)),
          decoStatus: status,
          decoLastSyncAt: new Date().toISOString(),
        };
      }

      if (Object.keys(updateData).length > 0) {
        await tx.job.update({
          where: { id: link.jobId },
          data: updateData,
        });
      }

      await tx.activityLog.create({
        data: {
          jobId: link.jobId,
          eventType: "deco.order.synced",
          message: `Deco order ${decoJobNumber ?? decoOrderId} status: ${status ?? "unknown"}`,
          payload: { decoOrderId, decoJobNumber, status } as Prisma.InputJsonValue,
        },
      });
    });

    logger.info({ decoOrderId, jobId: link.jobId, status }, "Processed Deco order event for linked job");
    return;
  }

  // No linked job — try to match by decoOrderId on the Job model directly
  const jobByDecoId = await prisma.job.findFirst({
    where: { decoOrderId },
    select: { id: true },
  });

  if (jobByDecoId) {
    await prisma.activityLog.create({
      data: {
        jobId: jobByDecoId.id,
        eventType: "deco.order.synced",
        message: `Deco order ${decoJobNumber ?? decoOrderId} update received (status: ${status ?? "unknown"})`,
        payload: { decoOrderId, decoJobNumber, status } as Prisma.InputJsonValue,
      },
    });

    logger.info({ decoOrderId, jobId: jobByDecoId.id, status }, "Matched Deco event to job via decoOrderId");
    return;
  }

  // Completely unlinked — log for visibility
  logger.info({ decoOrderId, decoJobNumber, status }, "Deco order event received but no linked job found");
}

// ── Deco stock event processing ──
// Called when Deco reports stock/inventory changes.

export async function processDecoStockEvent(payload: JsonObject): Promise<void> {
  const decoOrderId = String(payload.orderId ?? payload.id ?? "");
  if (!decoOrderId) {
    logger.warn({ payload }, "Deco stock event missing orderId");
    return;
  }

  const link = await prisma.externalLink.findUnique({
    where: {
      provider_externalId: {
        provider: ExternalProvider.DECO_ORDER,
        externalId: decoOrderId,
      },
    },
    select: { jobId: true },
  });

  const jobId = link?.jobId ?? (await prisma.job.findFirst({
    where: { decoOrderId },
    select: { id: true },
  }))?.id;

  if (!jobId) {
    logger.info({ decoOrderId }, "Deco stock event received but no linked job found");
    return;
  }

  await prisma.activityLog.create({
    data: {
      jobId,
      eventType: "deco.stock.updated",
      message: `Deco stock update for order ${decoOrderId}`,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  logger.info({ decoOrderId, jobId }, "Processed Deco stock event");
}

// ── Helpers ──

async function getJobMetadata(
  tx: Prisma.TransactionClient,
  jobId: string,
): Promise<JsonObject> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: { metadata: true },
  });

  const raw = job?.metadata;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  return raw as JsonObject;
}
