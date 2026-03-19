export const mainLifecycleStates = [
  "ingested",
  "classified",
  "configured",
  "pushed_to_deco",
  "awaiting_stock",
  "stock_received",
  "production_queued",
  "in_production",
  "completed",
  "cancelled",
  "on_hold",
] as const;

export type MainLifecycleState = (typeof mainLifecycleStates)[number];

export const classificationStatuses = [
  "unclassified",
  "account_matched",
  "account_review_needed",
  "asset_review_needed",
  "rule_review_needed",
  "method_review_needed",
  "classified_ready",
] as const;

export type ClassificationStatus = (typeof classificationStatuses)[number];

export const configurationStatuses = [
  "not_started",
  "in_progress",
  "ready_for_confirmation",
  "confirmed",
  "pushed_to_deco",
  "deco_push_failed",
] as const;

export type ConfigurationStatus = (typeof configurationStatuses)[number];

export const stockStatuses = [
  "not_required",
  "awaiting_order",
  "ordered",
  "awaiting_arrival",
  "partially_received",
  "fully_received",
  "stock_issue",
] as const;

export type StockStatus = (typeof stockStatuses)[number];

export const productionStatuses = [
  "not_ready",
  "queued_embroidery",
  "queued_dtf",
  "queued_mixed",
  "in_embroidery",
  "in_dtf",
  "in_mixed",
  "qc",
  "ready_for_dispatch",
  "complete",
] as const;

export type ProductionStatus = (typeof productionStatuses)[number];

export const approvalStatuses = [
  "not_required",
  "awaiting_artwork",
  "proof_in_progress",
  "proof_sent",
  "awaiting_customer_approval",
  "approved",
  "changes_requested",
  "rejected",
] as const;

export type ApprovalStatus = (typeof approvalStatuses)[number];

export const productionDepartments = ["embroidery", "dtf", "mixed"] as const;
export type ProductionDepartment = (typeof productionDepartments)[number];

export const blockerTypes = [
  "account",
  "asset",
  "rule",
  "method",
  "approval",
  "stock",
  "warehouse",
  "deco_push",
  "production",
] as const;

export type BlockerType = (typeof blockerTypes)[number];

export type JobWorkflowSnapshot = {
  lifecycle: MainLifecycleState;
  classification: ClassificationStatus;
  configuration: ConfigurationStatus;
  stock: StockStatus;
  production: ProductionStatus;
  approval: ApprovalStatus;
  hasMatchedAccount: boolean;
  hasDecoCustomerLink: boolean;
  hasRequiredAssets: boolean;
  hasPlacementConfiguration: boolean;
  hasProductionMethod: boolean;
  unresolvedReviewFlags: number;
  receivedQuantityRatio: number;
  requiresStock: boolean;
  assignedDepartment?: ProductionDepartment;
};

