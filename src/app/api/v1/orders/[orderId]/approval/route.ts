import { NextResponse } from "next/server";
import { applyApprovalStatus } from "@/server/core/order-orchestrator";
import type { ApprovalWorkflowStatus } from "@/server/core/order-types";

type RouteParams = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteParams) {
  const { orderId } = await context.params;
  const body = (await request.json()) as {
    status?: ApprovalWorkflowStatus;
    actor?: string;
    notes?: string;
  };

  if (!body.status) {
    return NextResponse.json({ error: "status is required." }, { status: 400 });
  }

  const order = await applyApprovalStatus(
    orderId,
    body.status,
    body.actor ?? "ops.user",
    body.notes,
  );
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({
    data: order,
    updated: true,
  });
}
