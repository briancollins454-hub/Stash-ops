import { NextResponse } from "next/server";
import {
  applyApprovalStatus,
  applyStockStatus,
  recordReceivingScan,
  transitionProductionStage,
  updateDesignSetup,
  updateOrderMetadata,
  updatePurchasingStatus,
} from "@/server/core/order-orchestrator";
import type {
  ApprovalWorkflowStatus,
  Department,
  DesignSetupState,
  EmbellishmentPlacement,
  PurchasingWorkflowStatus,
  ProductionWorkflowStage,
  StockWorkflowStatus,
  StudioViewMode,
  UrgencyLevel,
} from "@/server/core/order-types";
import { getUnifiedOrder } from "@/server/repositories/unified-order-repository";

type RouteParams = {
  params: Promise<{
    orderId: string;
  }>;
};

type DesignSetupPatchPayload = Partial<
  Pick<
    DesignSetupState,
    | "status"
    | "studioView"
    | "productLabel"
    | "garmentSku"
    | "model3dUrl"
    | "previewImageUrl"
    | "notes"
  >
> & {
  placements?: EmbellishmentPlacement[];
};

export async function GET(_request: Request, context: RouteParams) {
  const { orderId } = await context.params;
  const order = await getUnifiedOrder(orderId);

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({
    data: order,
  });
}

export async function PATCH(request: Request, context: RouteParams) {
  const { orderId } = await context.params;
  const body = (await request.json()) as {
    actor?: string;
    notes?: string;
    owner?: string;
    assignedDepartment?: Department;
    dueAt?: string;
    urgency?: UrgencyLevel;
    approvalStatus?: ApprovalWorkflowStatus;
    stockStatus?: StockWorkflowStatus;
    productionStage?: ProductionWorkflowStage;
    designSetup?: DesignSetupPatchPayload;
    purchasing?: {
      status?: PurchasingWorkflowStatus;
      supplierName?: string;
      supplierPoNumber?: string;
      orderedAt?: string;
      expectedAt?: string;
      receivedAt?: string;
      notes?: string;
    };
    receivingScan?: {
      sku: string;
      quantity: number;
      location?: string;
      scannedBy?: string;
    };
  };

  const actor = body.actor ?? "ops.user";
  let current = await getUnifiedOrder(orderId);

  if (!current) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (
    body.owner !== undefined ||
    body.assignedDepartment !== undefined ||
    body.dueAt !== undefined ||
    body.urgency !== undefined
  ) {
    current = await updateOrderMetadata(
      orderId,
      {
        owner: body.owner,
        assignedDepartment: body.assignedDepartment,
        dueAt: body.dueAt,
        urgency: body.urgency,
      },
      actor,
    );
  }

  if (body.approvalStatus) {
    current = await applyApprovalStatus(orderId, body.approvalStatus, actor, body.notes);
  }

  if (body.stockStatus) {
    current = await applyStockStatus(orderId, body.stockStatus, actor, body.notes);
  }

  if (body.productionStage) {
    const transition = await transitionProductionStage(
      orderId,
      body.productionStage,
      actor,
      body.notes,
    );
    if (!transition.ok) {
      return NextResponse.json({ error: transition.reason }, { status: 400 });
    }
    current = transition.order;
  }

  if (body.designSetup) {
    current = await updateDesignSetup(
      orderId,
      {
        ...body.designSetup,
        studioView: body.designSetup.studioView as StudioViewMode | undefined,
      },
      actor,
    );
  }

  if (body.purchasing) {
    current = await updatePurchasingStatus(orderId, body.purchasing, actor);
  }

  if (body.receivingScan) {
    current = await recordReceivingScan(orderId, body.receivingScan, actor);
  }

  if (!current) {
    return NextResponse.json({ error: "Order update failed." }, { status: 500 });
  }

  return NextResponse.json({
    data: current,
    updated: true,
  });
}
