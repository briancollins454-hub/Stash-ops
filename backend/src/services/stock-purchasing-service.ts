import { StockStatus, type Prisma } from "@prisma/client";

export type SupplierOrderInput = {
  supplierName: string;
  supplierReference?: string;
  eta?: string;
  notes?: string;
  actor: string;
};

export async function recordSupplierOrder(
  tx: Prisma.TransactionClient,
  jobId: string,
  input: SupplierOrderInput,
): Promise<void> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: { id: true },
  });

  if (!job) {
    throw new Error("Job not found.");
  }

  // Update all stock requirements for this job with supplier info
  await tx.jobStockRequirement.updateMany({
    where: {
      jobId,
      status: { in: [StockStatus.AWAITING_ORDER, StockStatus.NOT_REQUIRED] },
    },
    data: {
      supplierName: input.supplierName,
      supplierReference: input.supplierReference ?? null,
      supplierNotes: input.notes ?? null,
      eta: input.eta ? new Date(input.eta) : null,
      status: StockStatus.ORDERED,
    },
  });

  // If no stock requirements exist yet, create one per job item
  const existingCount = await tx.jobStockRequirement.count({ where: { jobId } });
  if (existingCount === 0) {
    const items = await tx.jobItem.findMany({
      where: { jobId },
      select: { id: true, quantity: true },
    });

    for (const item of items) {
      await tx.jobStockRequirement.create({
        data: {
          jobId,
          jobItemId: item.id,
          requiredQuantity: item.quantity,
          status: StockStatus.ORDERED,
          supplierName: input.supplierName,
          supplierReference: input.supplierReference ?? null,
          supplierNotes: input.notes ?? null,
          eta: input.eta ? new Date(input.eta) : null,
        },
      });
    }
  }

  await tx.activityLog.create({
    data: {
      jobId,
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

