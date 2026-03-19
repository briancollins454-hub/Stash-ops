import type { Prisma } from "@prisma/client";

type JsonObject = Record<string, unknown>;

function asJson(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

export type WarehouseReceiptInput = {
  receivedQuantity: number;
  expectedQuantity: number;
  location: string;
  branch: string;
  actor: string;
  notes?: string;
};

export async function recordWarehouseReceipt(
  tx: Prisma.TransactionClient,
  orderId: string,
  input: WarehouseReceiptInput,
): Promise<"partial" | "full"> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { metadata: true },
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  const status = input.receivedQuantity >= input.expectedQuantity ? "full" : "partial";
  const metadata = asJson(order.metadata);
  const warehouse = asJson(metadata.warehouse);
  const receipts = Array.isArray(warehouse.receipts) ? warehouse.receipts : [];

  const receiptEvent = {
    receivedQuantity: input.receivedQuantity,
    expectedQuantity: input.expectedQuantity,
    location: input.location,
    branch: input.branch,
    notes: input.notes ?? null,
    receivedAt: new Date().toISOString(),
    receivedBy: input.actor,
    status,
  };

  await tx.order.update({
    where: { id: orderId },
    data: {
      metadata: {
        ...metadata,
        warehouse: {
          ...warehouse,
          receiptStatus: status,
          receipts: [...receipts, receiptEvent],
          latestReceiptAt: receiptEvent.receivedAt,
        },
      },
    },
  });

  await tx.activityLog.create({
    data: {
      orderId,
      eventType: "warehouse.receipt.recorded",
      message:
        status === "full"
          ? "Warehouse receipt complete."
          : "Warehouse receipt partial.",
      payload: receiptEvent,
    },
  });

  return status;
}

