import type { Prisma } from "@prisma/client";
import type { ProductionDepartment } from "../domain/job-status";

type JsonObject = Record<string, unknown>;

function asJson(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

export type ProductionRoutingInput = {
  department: ProductionDepartment;
  lane: "queued" | "in_progress" | "qc" | "complete";
  actor: string;
  notes?: string;
};

export async function routeOrderToProduction(
  tx: Prisma.TransactionClient,
  orderId: string,
  input: ProductionRoutingInput,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { metadata: true },
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  const metadata = asJson(order.metadata);
  const production = asJson(metadata.production);

  await tx.order.update({
    where: { id: orderId },
    data: {
      metadata: {
        ...metadata,
        production: {
          ...production,
          department: input.department,
          lane: input.lane,
          notes: input.notes ?? null,
          updatedAt: new Date().toISOString(),
          updatedBy: input.actor,
        },
      },
    },
  });

  await tx.activityLog.create({
    data: {
      orderId,
      eventType: "production.routed",
      message: `Order routed to ${input.department} (${input.lane}).`,
      payload: {
        department: input.department,
        lane: input.lane,
        notes: input.notes ?? null,
        actor: input.actor,
      },
    },
  });
}

