import type { Prisma } from "@prisma/client";

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
  jobId: string,
  input: WarehouseReceiptInput,
): Promise<"partial" | "full"> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: { id: true },
  });

  if (!job) {
    throw new Error("Job not found.");
  }

  const isPartial = input.receivedQuantity < input.expectedQuantity;
  const status = isPartial ? "partial" : "full";

  // Create the warehouse receipt record
  const receipt = await tx.warehouseReceipt.create({
    data: {
      jobId,
      receivedBy: input.actor,
      branch: input.branch,
      isPartial,
      totalReceived: input.receivedQuantity,
      notes: input.notes ?? null,
    },
  });

  // Create a scan event for this receipt
  await tx.warehouseScanEvent.create({
    data: {
      receiptId: receipt.id,
      sku: "BULK",
      quantity: input.receivedQuantity,
      scannedBy: input.actor,
      location: input.location,
    },
  });

  // Update received quantities on stock requirements
  const stockReqs = await tx.jobStockRequirement.findMany({
    where: { jobId },
    select: { id: true, receivedQuantity: true },
  });

  if (stockReqs.length > 0) {
    // Distribute received quantity across requirements proportionally
    const perReq = Math.floor(input.receivedQuantity / stockReqs.length);
    for (const req of stockReqs) {
      await tx.jobStockRequirement.update({
        where: { id: req.id },
        data: {
          receivedQuantity: req.receivedQuantity + perReq,
        },
      });
    }
  }

  await tx.activityLog.create({
    data: {
      jobId,
      eventType: "warehouse.receipt.recorded",
      message:
        status === "full"
          ? "Warehouse receipt complete."
          : "Warehouse receipt partial.",
      payload: {
        receiptId: receipt.id,
        receivedQuantity: input.receivedQuantity,
        expectedQuantity: input.expectedQuantity,
        location: input.location,
        branch: input.branch,
        actor: input.actor,
      },
    },
  });

  return status;
}

