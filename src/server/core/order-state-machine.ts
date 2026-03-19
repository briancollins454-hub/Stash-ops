import type {
  ApprovalWorkflowStatus,
  DesignWorkflowStatus,
  ProductionWorkflowStage,
  StockWorkflowStatus,
  UnifiedOrderRecord,
} from "@/server/core/order-types";

const transitions: Record<ProductionWorkflowStage, ProductionWorkflowStage[]> = {
  pending_review: ["awaiting_artwork", "awaiting_approval", "approved_awaiting_stock"],
  awaiting_artwork: ["awaiting_approval"],
  awaiting_approval: ["approved_awaiting_stock", "awaiting_artwork"],
  approved_awaiting_stock: ["ready_for_production", "awaiting_artwork"],
  ready_for_production: ["in_production"],
  in_production: ["quality_check"],
  quality_check: ["ready_for_dispatch", "in_production"],
  ready_for_dispatch: ["dispatched"],
  dispatched: ["complete"],
  complete: [],
};

const stockReady: StockWorkflowStatus[] = ["in_stock", "stock_confirmed"];

const approvalReady: ApprovalWorkflowStatus[] = ["approved", "not_required"];
const designReady: DesignWorkflowStatus[] = ["customer_approved", "production_locked"];
const designPrepared: DesignWorkflowStatus[] = [
  "proof_ready",
  "customer_approved",
  "production_locked",
];

export function isApprovalCleared(status: ApprovalWorkflowStatus) {
  return approvalReady.includes(status);
}

export function isStockReady(status: StockWorkflowStatus) {
  return stockReady.includes(status);
}

export function isDesignReady(status: DesignWorkflowStatus) {
  return designReady.includes(status);
}

export function isDesignPrepared(status: DesignWorkflowStatus) {
  return designPrepared.includes(status);
}

export function canMoveToProduction(order: UnifiedOrderRecord) {
  return (
    isDesignReady(order.designSetup.status) &&
    isApprovalCleared(order.approval.status) &&
    isStockReady(order.stock.status)
  );
}

export function canTransitionProductionStage(
  order: UnifiedOrderRecord,
  nextStage: ProductionWorkflowStage,
) {
  const allowed = transitions[order.production.stage] ?? [];

  if (!allowed.includes(nextStage)) {
    return {
      allowed: false,
      reason: `Cannot transition from ${order.production.stage} to ${nextStage}.`,
    };
  }

  if (nextStage === "ready_for_production" && !canMoveToProduction(order)) {
    return {
      allowed: false,
      reason: "Order cannot move to production until design, approval, and stock are all ready.",
    };
  }

  if (nextStage === "in_production" && order.production.stage !== "ready_for_production") {
    return {
      allowed: false,
      reason: "Order must be in ready_for_production before starting production.",
    };
  }

  return {
    allowed: true,
  };
}

export function deriveBlockedReason(order: UnifiedOrderRecord) {
  if (!isDesignPrepared(order.designSetup.status)) {
    return "Waiting for design setup and proof completion.";
  }

  if (!isApprovalCleared(order.approval.status)) {
    return "Waiting for customer approval.";
  }

  if (!isStockReady(order.stock.status)) {
    return "Waiting for stock confirmation.";
  }

  return undefined;
}

export function autoStageAfterApproval(order: UnifiedOrderRecord): ProductionWorkflowStage {
  if (order.approval.status === "changes_requested" || order.approval.status === "rejected") {
    return "awaiting_artwork";
  }

  if (isApprovalCleared(order.approval.status) && !isStockReady(order.stock.status)) {
    return "approved_awaiting_stock";
  }

  if (canMoveToProduction(order)) {
    return "ready_for_production";
  }

  return order.production.stage;
}

export function autoStageAfterStock(order: UnifiedOrderRecord): ProductionWorkflowStage {
  if (canMoveToProduction(order)) {
    if (
      order.production.stage === "approved_awaiting_stock" ||
      order.production.stage === "awaiting_approval"
    ) {
      return "ready_for_production";
    }
  }

  return order.production.stage;
}
