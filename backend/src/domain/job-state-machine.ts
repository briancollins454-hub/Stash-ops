import type {
  BlockerType,
  JobWorkflowSnapshot,
  MainLifecycleState,
  ProductionDepartment,
} from "./job-status";

const transitionMap: Record<MainLifecycleState, MainLifecycleState[]> = {
  ingested: ["classified", "on_hold", "cancelled"],
  classified: ["configured", "on_hold", "cancelled"],
  configured: ["pushed_to_deco", "awaiting_stock", "on_hold", "cancelled"],
  pushed_to_deco: ["awaiting_stock", "on_hold", "cancelled"],
  awaiting_stock: ["stock_received", "on_hold", "cancelled"],
  stock_received: ["production_queued", "on_hold", "cancelled"],
  production_queued: ["in_production", "on_hold", "cancelled"],
  in_production: ["completed", "on_hold", "cancelled"],
  completed: [],
  on_hold: ["classified", "configured", "awaiting_stock", "cancelled"],
  cancelled: [],
};

export type WorkflowBlocker = {
  type: BlockerType;
  message: string;
  hardBlock: boolean;
};

export type TransitionCheck = {
  ok: boolean;
  reasons: string[];
  blockers: WorkflowBlocker[];
};

export function evaluateWorkflowBlockers(snapshot: JobWorkflowSnapshot): WorkflowBlocker[] {
  const blockers: WorkflowBlocker[] = [];

  if (!snapshot.hasMatchedAccount || snapshot.classification === "account_review_needed") {
    blockers.push({
      type: "account",
      message: "Account must be matched or manually confirmed.",
      hardBlock: true,
    });
  }

  if (!snapshot.hasRequiredAssets || snapshot.classification === "asset_review_needed") {
    blockers.push({
      type: "asset",
      message: "Required account assets/templates are missing.",
      hardBlock: true,
    });
  }

  if (!snapshot.hasPlacementConfiguration || snapshot.classification === "rule_review_needed") {
    blockers.push({
      type: "rule",
      message: "Placement/template rule needs review.",
      hardBlock: true,
    });
  }

  if (!snapshot.hasProductionMethod || snapshot.classification === "method_review_needed") {
    blockers.push({
      type: "method",
      message: "Production method has not been confirmed.",
      hardBlock: true,
    });
  }

  if (
    snapshot.approval === "awaiting_artwork" ||
    snapshot.approval === "proof_in_progress" ||
    snapshot.approval === "proof_sent" ||
    snapshot.approval === "awaiting_customer_approval" ||
    snapshot.approval === "changes_requested" ||
    snapshot.approval === "rejected"
  ) {
    blockers.push({
      type: "approval",
      message: "Approval gate is not satisfied.",
      hardBlock: true,
    });
  }

  if (snapshot.unresolvedReviewFlags > 0) {
    blockers.push({
      type: "rule",
      message: `${snapshot.unresolvedReviewFlags} unresolved review flag(s).`,
      hardBlock: true,
    });
  }

  if (snapshot.requiresStock) {
    if (
      snapshot.stock === "awaiting_order" ||
      snapshot.stock === "ordered" ||
      snapshot.stock === "awaiting_arrival" ||
      snapshot.stock === "stock_issue"
    ) {
      blockers.push({
        type: "stock",
        message: "Stock requirement is not yet satisfied.",
        hardBlock: true,
      });
    }

    if (snapshot.stock === "partially_received" && snapshot.receivedQuantityRatio < 1) {
      blockers.push({
        type: "warehouse",
        message: "Warehouse receipt is only partial.",
        hardBlock: true,
      });
    }
  }

  if (
    (snapshot.lifecycle === "pushed_to_deco" || snapshot.lifecycle === "awaiting_stock") &&
    snapshot.configuration === "deco_push_failed"
  ) {
    blockers.push({
      type: "deco_push",
      message: "Deco push previously failed and needs retry/repair.",
      hardBlock: true,
    });
  }

  if (
    (snapshot.lifecycle === "production_queued" || snapshot.lifecycle === "in_production") &&
    !snapshot.assignedDepartment
  ) {
    blockers.push({
      type: "production",
      message: "Production department must be assigned.",
      hardBlock: true,
    });
  }

  return blockers;
}

function lifecycleGateReasons(
  snapshot: JobWorkflowSnapshot,
  target: MainLifecycleState,
): string[] {
  const reasons: string[] = [];

  if (target === "classified") {
    if (snapshot.classification !== "classified_ready" && snapshot.classification !== "account_matched") {
      reasons.push("Classification is not ready.");
    }
  }

  if (target === "configured") {
    if (
      snapshot.configuration !== "ready_for_confirmation" &&
      snapshot.configuration !== "confirmed" &&
      snapshot.configuration !== "pushed_to_deco"
    ) {
      reasons.push("Configuration is not complete.");
    }
  }

  if (target === "pushed_to_deco") {
    if (!snapshot.hasDecoCustomerLink) {
      reasons.push("Deco customer linkage is required.");
    }
    if (snapshot.configuration !== "confirmed" && snapshot.configuration !== "pushed_to_deco") {
      reasons.push("Configuration must be confirmed before Deco push.");
    }
  }

  if (target === "awaiting_stock") {
    if (!snapshot.requiresStock) {
      reasons.push("Use production_queued directly for jobs that do not require stock.");
    }
  }

  if (target === "stock_received") {
    if (snapshot.requiresStock && snapshot.stock !== "fully_received") {
      reasons.push("Stock must be fully received.");
    }
  }

  if (target === "production_queued") {
    if (snapshot.production !== "queued_embroidery" && snapshot.production !== "queued_dtf" && snapshot.production !== "queued_mixed") {
      reasons.push("Production queue status is not set.");
    }
  }

  if (target === "in_production") {
    if (snapshot.production !== "in_embroidery" && snapshot.production !== "in_dtf" && snapshot.production !== "in_mixed") {
      reasons.push("Production has not started in a department lane.");
    }
  }

  if (target === "completed") {
    if (snapshot.production !== "complete") {
      reasons.push("Production/QC completion is required.");
    }
  }

  return reasons;
}

export function canTransitionLifecycle(
  snapshot: JobWorkflowSnapshot,
  target: MainLifecycleState,
): TransitionCheck {
  const allowedTargets = transitionMap[snapshot.lifecycle];
  if (!allowedTargets.includes(target)) {
    return {
      ok: false,
      reasons: [`Transition ${snapshot.lifecycle} -> ${target} is not allowed.`],
      blockers: [],
    };
  }

  const blockers = evaluateWorkflowBlockers(snapshot).filter((blocker) => blocker.hardBlock);
  const gateReasons = lifecycleGateReasons(snapshot, target);
  const blockerReasons = blockers.map((blocker) => blocker.message);
  const reasons = [...gateReasons, ...blockerReasons];

  return {
    ok: reasons.length === 0,
    reasons,
    blockers,
  };
}

export function inferProductionDepartment(snapshot: JobWorkflowSnapshot): ProductionDepartment | null {
  if (snapshot.production === "queued_embroidery" || snapshot.production === "in_embroidery") {
    return "embroidery";
  }
  if (snapshot.production === "queued_dtf" || snapshot.production === "in_dtf") {
    return "dtf";
  }
  if (snapshot.production === "queued_mixed" || snapshot.production === "in_mixed") {
    return "mixed";
  }

  if (snapshot.assignedDepartment) {
    return snapshot.assignedDepartment;
  }

  return null;
}

