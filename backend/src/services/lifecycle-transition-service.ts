import {
  MainLifecycle,
  ClassificationStatus,
  ConfigurationStatus,
  StockStatus,
  ProductionStatus,
  ApprovalStatus,
  ProductionDepartment as PrismaDepartment,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import {
  canTransitionLifecycle,
  evaluateWorkflowBlockers,
  type TransitionCheck,
} from "../domain/job-state-machine";
import type {
  JobWorkflowSnapshot,
  MainLifecycleState,
  ClassificationStatus as DomainClassification,
  ConfigurationStatus as DomainConfiguration,
  StockStatus as DomainStock,
  ProductionStatus as DomainProduction,
  ApprovalStatus as DomainApproval,
  ProductionDepartment as DomainDepartment,
} from "../domain/job-status";

// ── Prisma enum ↔ domain type maps ──

const lifecycleToDomain: Record<MainLifecycle, MainLifecycleState> = {
  INGESTED: "ingested",
  CLASSIFIED: "classified",
  CONFIGURED: "configured",
  PUSHED_TO_DECO: "pushed_to_deco",
  AWAITING_STOCK: "awaiting_stock",
  STOCK_RECEIVED: "stock_received",
  PRODUCTION_QUEUED: "production_queued",
  IN_PRODUCTION: "in_production",
  COMPLETED: "completed",
  ON_HOLD: "on_hold",
  CANCELLED: "cancelled",
};

const lifecycleToPrisma: Record<MainLifecycleState, MainLifecycle> = {
  ingested: MainLifecycle.INGESTED,
  classified: MainLifecycle.CLASSIFIED,
  configured: MainLifecycle.CONFIGURED,
  pushed_to_deco: MainLifecycle.PUSHED_TO_DECO,
  awaiting_stock: MainLifecycle.AWAITING_STOCK,
  stock_received: MainLifecycle.STOCK_RECEIVED,
  production_queued: MainLifecycle.PRODUCTION_QUEUED,
  in_production: MainLifecycle.IN_PRODUCTION,
  completed: MainLifecycle.COMPLETED,
  on_hold: MainLifecycle.ON_HOLD,
  cancelled: MainLifecycle.CANCELLED,
};

const classificationToDomain: Record<ClassificationStatus, DomainClassification> = {
  UNCLASSIFIED: "unclassified",
  ACCOUNT_MATCHED: "account_matched",
  ACCOUNT_REVIEW_NEEDED: "account_review_needed",
  ASSET_REVIEW_NEEDED: "asset_review_needed",
  RULE_REVIEW_NEEDED: "rule_review_needed",
  METHOD_REVIEW_NEEDED: "method_review_needed",
  CLASSIFIED_READY: "classified_ready",
};

const configurationToDomain: Record<ConfigurationStatus, DomainConfiguration> = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  READY_FOR_CONFIRMATION: "ready_for_confirmation",
  CONFIRMED: "confirmed",
  PUSHED_TO_DECO: "pushed_to_deco",
  DECO_PUSH_FAILED: "deco_push_failed",
};

const stockToDomain: Record<StockStatus, DomainStock> = {
  NOT_REQUIRED: "not_required",
  AWAITING_ORDER: "awaiting_order",
  ORDERED: "ordered",
  AWAITING_ARRIVAL: "awaiting_arrival",
  PARTIALLY_RECEIVED: "partially_received",
  FULLY_RECEIVED: "fully_received",
  STOCK_ISSUE: "stock_issue",
};

const productionToDomain: Record<ProductionStatus, DomainProduction> = {
  NOT_READY: "not_ready",
  QUEUED_EMBROIDERY: "queued_embroidery",
  QUEUED_DTF: "queued_dtf",
  QUEUED_MIXED: "queued_mixed",
  IN_EMBROIDERY: "in_embroidery",
  IN_DTF: "in_dtf",
  IN_MIXED: "in_mixed",
  QC: "qc",
  READY_FOR_DISPATCH: "ready_for_dispatch",
  COMPLETE: "complete",
};

const approvalToDomain: Record<ApprovalStatus, DomainApproval> = {
  NOT_REQUIRED: "not_required",
  AWAITING_ARTWORK: "awaiting_artwork",
  PROOF_IN_PROGRESS: "proof_in_progress",
  PROOF_SENT: "proof_sent",
  AWAITING_CUSTOMER_APPROVAL: "awaiting_customer_approval",
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  REJECTED: "rejected",
};

const departmentToDomain: Record<PrismaDepartment, DomainDepartment> = {
  EMBROIDERY: "embroidery",
  DTF: "dtf",
  MIXED: "mixed",
};

type JsonObject = Record<string, unknown>;

function asJson(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

// ── Build snapshot from a Prisma job row ──

type JobRow = {
  lifecycle: MainLifecycle;
  classificationStatus: ClassificationStatus;
  configurationStatus: ConfigurationStatus;
  stockStatus: StockStatus;
  productionStatus: ProductionStatus;
  approvalStatus: ApprovalStatus;
  assignedDepartment: PrismaDepartment | null;
  accountId: string | null;
  requiresReview: boolean;
  preconfiguration: unknown;
  metadata: unknown;
};

export function buildSnapshotFromJob(job: JobRow): JobWorkflowSnapshot {
  const preconfig = asJson(job.preconfiguration);
  const metadata = asJson(job.metadata);
  const warehouse = asJson(metadata.warehouse);
  const decoLink = asJson(preconfig.decoLink);

  const receivedRatio =
    typeof warehouse.receivedQuantity === "number" && typeof warehouse.expectedQuantity === "number" && warehouse.expectedQuantity > 0
      ? (warehouse.receivedQuantity as number) / (warehouse.expectedQuantity as number)
      : warehouse.receiptStatus === "full"
        ? 1
        : 0;

  return {
    lifecycle: lifecycleToDomain[job.lifecycle],
    classification: classificationToDomain[job.classificationStatus],
    configuration: configurationToDomain[job.configurationStatus],
    stock: stockToDomain[job.stockStatus],
    production: productionToDomain[job.productionStatus],
    approval: approvalToDomain[job.approvalStatus],
    hasMatchedAccount: job.accountId !== null,
    hasDecoCustomerLink: Boolean(decoLink.decoCustomerId),
    hasRequiredAssets: Boolean(preconfig.assetsResolved),
    hasPlacementConfiguration: Boolean(preconfig.placementResolved),
    hasProductionMethod: Boolean(preconfig.methodResolved),
    unresolvedReviewFlags: job.requiresReview ? 1 : 0,
    receivedQuantityRatio: receivedRatio,
    requiresStock: job.stockStatus !== StockStatus.NOT_REQUIRED,
    assignedDepartment: job.assignedDepartment ? departmentToDomain[job.assignedDepartment] : undefined,
  };
}

// ── Transition execution ──

export type TransitionResult =
  | { ok: true; from: MainLifecycleState; to: MainLifecycleState }
  | { ok: false; reasons: string[] };

export async function transitionJobLifecycle(
  tx: Prisma.TransactionClient,
  jobId: string,
  target: MainLifecycleState,
  actor: string,
  opts?: { force?: boolean },
): Promise<TransitionResult> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: {
      lifecycle: true,
      classificationStatus: true,
      configurationStatus: true,
      stockStatus: true,
      productionStatus: true,
      approvalStatus: true,
      assignedDepartment: true,
      accountId: true,
      requiresReview: true,
      preconfiguration: true,
      metadata: true,
    },
  });

  if (!job) {
    return { ok: false, reasons: ["Job not found."] };
  }

  const snapshot = buildSnapshotFromJob(job);
  const from = snapshot.lifecycle;

  if (!opts?.force) {
    const check = canTransitionLifecycle(snapshot, target);
    if (!check.ok) {
      return { ok: false, reasons: check.reasons };
    }
  }

  await tx.job.update({
    where: { id: jobId },
    data: {
      lifecycle: lifecycleToPrisma[target],
    },
  });

  await tx.activityLog.create({
    data: {
      jobId,
      eventType: "lifecycle.transition",
      message: `Lifecycle: ${from} → ${target}`,
      payload: { from, to: target, actor, forced: opts?.force ?? false },
    },
  });

  return { ok: true, from, to: target };
}

// ── Sub-status updates ──

export type SubStatusUpdate = {
  classificationStatus?: ClassificationStatus;
  configurationStatus?: ConfigurationStatus;
  stockStatus?: StockStatus;
  productionStatus?: ProductionStatus;
  approvalStatus?: ApprovalStatus;
  assignedDepartment?: PrismaDepartment;
};

export async function updateSubStatuses(
  tx: Prisma.TransactionClient,
  jobId: string,
  updates: SubStatusUpdate,
  actor: string,
): Promise<void> {
  const before = await tx.job.findUnique({
    where: { id: jobId },
    select: {
      classificationStatus: true,
      configurationStatus: true,
      stockStatus: true,
      productionStatus: true,
      approvalStatus: true,
      assignedDepartment: true,
    },
  });

  if (!before) {
    throw new Error("Job not found.");
  }

  await tx.job.update({
    where: { id: jobId },
    data: updates,
  });

  await tx.activityLog.create({
    data: {
      jobId,
      eventType: "substatus.update",
      message: `Sub-status updated: ${Object.keys(updates).join(", ")}`,
      payload: { before, after: updates, actor },
    },
  });
}

// ── Snapshot query ──

export async function getJobSnapshot(
  tx: Prisma.TransactionClient,
  jobId: string,
): Promise<{ snapshot: JobWorkflowSnapshot; blockers: ReturnType<typeof evaluateWorkflowBlockers> } | null> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: {
      lifecycle: true,
      classificationStatus: true,
      configurationStatus: true,
      stockStatus: true,
      productionStatus: true,
      approvalStatus: true,
      assignedDepartment: true,
      accountId: true,
      requiresReview: true,
      preconfiguration: true,
      metadata: true,
    },
  });

  if (!job) return null;

  const snapshot = buildSnapshotFromJob(job);
  return {
    snapshot,
    blockers: evaluateWorkflowBlockers(snapshot),
  };
}
