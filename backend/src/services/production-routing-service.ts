import type { Prisma } from "@prisma/client";
import type { ProductionDepartment } from "../domain/job-status";

export type ProductionRoutingInput = {
  department: ProductionDepartment;
  lane: "queued" | "in_progress" | "qc" | "complete";
  actor: string;
  notes?: string;
};

export async function routeJobToProduction(
  tx: Prisma.TransactionClient,
  jobId: string,
  input: ProductionRoutingInput,
): Promise<void> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: { id: true, productionStartedAt: true },
  });

  if (!job) {
    throw new Error("Job not found.");
  }

  const now = new Date();
  const updates: Record<string, unknown> = {
    productionNotes: input.notes ?? null,
  };

  if (!job.productionStartedAt && (input.lane === "in_progress" || input.lane === "qc")) {
    updates.productionStartedAt = now;
  }

  if (input.lane === "complete") {
    updates.productionCompletedAt = now;
  }

  await tx.job.update({
    where: { id: jobId },
    data: updates,
  });

  await tx.activityLog.create({
    data: {
      jobId,
      eventType: "production.routed",
      message: `Job routed to ${input.department} (${input.lane}).`,
      payload: {
        department: input.department,
        lane: input.lane,
        notes: input.notes ?? null,
        actor: input.actor,
      },
    },
  });
}

