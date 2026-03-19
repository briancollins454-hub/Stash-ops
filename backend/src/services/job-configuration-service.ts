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
  orderId: string,
  accepted: boolean,
  actor: string,
  note?: string,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      preconfiguration: true,
    },
  });

  if (!order) {
    throw new Error("Order not found for review decision.");
  }

  const preconfiguration = asJsonObject(order.preconfiguration);
  const existingReview = asJsonObject(preconfiguration.review);

  await tx.order.update({
    where: { id: orderId },
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
      orderId,
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

