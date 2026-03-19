import { MatchStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { inferProductionDepartment } from "../domain/job-state-machine";
import type { JobWorkflowSnapshot } from "../domain/job-status";

type JsonObject = Record<string, unknown>;

function asJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

export function canPushToDeco(snapshot: JobWorkflowSnapshot): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!snapshot.hasMatchedAccount) reasons.push("Account not matched.");
  if (!snapshot.hasDecoCustomerLink) reasons.push("No Deco customer linked.");
  if (!snapshot.hasRequiredAssets) reasons.push("Required asset set missing.");
  if (!snapshot.hasPlacementConfiguration) reasons.push("Placement config missing.");
  if (!snapshot.hasProductionMethod) reasons.push("Production method missing.");
  if (snapshot.unresolvedReviewFlags > 0) reasons.push("Unresolved review flags present.");
  if (
    snapshot.approval !== "approved" &&
    snapshot.approval !== "not_required"
  ) {
    reasons.push("Approval gate not satisfied.");
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export async function markReviewDecision(
  tx: Prisma.TransactionClient,
  jobId: string,
  accepted: boolean,
  actor: string,
  note?: string,
): Promise<void> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      preconfiguration: true,
    },
  });

  if (!job) {
    throw new Error("Job not found for review decision.");
  }

  const preconfiguration = asJsonObject(job.preconfiguration);
  const existingReview = asJsonObject(preconfiguration.review);

  await tx.job.update({
    where: { id: jobId },
    data: {
      accountMatchStatus: accepted ? MatchStatus.MANUAL_MATCHED : MatchStatus.REVIEW_REQUIRED,
      requiresReview: !accepted,
      reviewReason: accepted ? null : note ?? "Review not accepted.",
      preconfiguration: {
        ...preconfiguration,
        review: {
          ...existingReview,
          accepted,
          reviewedAt: new Date().toISOString(),
          reviewedBy: actor,
          note: note ?? null,
        },
      },
    },
  });

  await tx.activityLog.create({
    data: {
      jobId,
      eventType: accepted ? "review.accepted" : "review.rejected",
      message: accepted
        ? "Review flags accepted; job can continue."
        : "Review remains unresolved and blocks progression.",
      payload: {
        actor,
        note: note ?? null,
      },
    },
  });
}

export function inferDepartmentForJob(snapshot: JobWorkflowSnapshot) {
  return inferProductionDepartment(snapshot);
}

