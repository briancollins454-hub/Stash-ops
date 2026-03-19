import type { Prisma } from "@prisma/client";

export type AuditEntryInput = {
  eventType: string;
  message: string;
  actor: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  context?: Record<string, unknown>;
};

export async function appendAuditEntry(
  tx: Prisma.TransactionClient,
  jobId: string,
  input: AuditEntryInput,
): Promise<void> {
  const payload = {
    actor: input.actor,
    before: (input.before ?? null) as Prisma.InputJsonValue | null,
    after: (input.after ?? null) as Prisma.InputJsonValue | null,
    context: (input.context ?? null) as Prisma.InputJsonValue | null,
  } as Prisma.InputJsonValue;

  await tx.activityLog.create({
    data: {
      jobId,
      eventType: input.eventType,
      message: input.message,
      payload,
    },
  });
}
