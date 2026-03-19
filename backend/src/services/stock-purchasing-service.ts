import type { Prisma } from "@prisma/client";

type JsonObject = Record<string, unknown>;

function asJson(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

export type SupplierOrderInput = {
  supplierName: string;
  supplierReference?: string;
  eta?: string;
  notes?: string;
  actor: string;
};

export async function recordSupplierOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  input: SupplierOrderInput,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { metadata: true },
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  const metadata = asJson(order.metadata);
  const purchasing = asJson(metadata.purchasing);

  await tx.order.update({
    where: { id: orderId },
    data: {
      metadata: {
        ...metadata,
        purchasing: {
          ...purchasing,
          status: "ordered",
          supplierName: input.supplierName,
          supplierReference: input.supplierReference ?? null,
          eta: input.eta ?? null,
          notes: input.notes ?? null,
          orderedAt: new Date().toISOString(),
        },
      },
    },
  });

  await tx.activityLog.create({
    data: {
      orderId,
      eventType: "stock.order.recorded",
      message: `Supplier order recorded: ${input.supplierName}.`,
      payload: {
        supplierName: input.supplierName,
        supplierReference: input.supplierReference ?? null,
        eta: input.eta ?? null,
        actor: input.actor,
      },
    },
  });
}

