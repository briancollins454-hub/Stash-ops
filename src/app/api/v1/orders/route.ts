import { NextResponse } from "next/server";
import { createManualOrder } from "@/server/core/order-orchestrator";
import type {
  ApprovalWorkflowStatus,
  ManualOrderCreateInput,
  ProductionWorkflowStage,
  StockWorkflowStatus,
} from "@/server/core/order-types";
import { listUnifiedOrders } from "@/server/repositories/unified-order-repository";
import { runAutoSyncIfStale } from "@/server/sync/auto-sync-engine";

export async function GET(request: Request) {
  const scheduledProviders = runAutoSyncIfStale();
  const { searchParams } = new URL(request.url);

  const stage = searchParams.get("stage") as ProductionWorkflowStage | null;
  const approval = searchParams.get("approval") as ApprovalWorkflowStatus | null;
  const stock = searchParams.get("stock") as StockWorkflowStatus | null;
  const owner = searchParams.get("owner");

  const data = await listUnifiedOrders({
    stage: stage ?? undefined,
    approval: approval ?? undefined,
    stock: stock ?? undefined,
    owner: owner ?? undefined,
  });

  return NextResponse.json({
    data,
    count: data.length,
    scheduledProviders,
    generatedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<ManualOrderCreateInput>;

  if (!body.customer || !body.lineItems?.length || !body.billingAddress || !body.shippingAddress) {
    return NextResponse.json(
      {
        error:
          "Invalid payload. customer, billingAddress, shippingAddress and lineItems are required.",
      },
      { status: 400 },
    );
  }

  const order = await createManualOrder({
    customer: body.customer,
    billingAddress: body.billingAddress,
    shippingAddress: body.shippingAddress,
    lineItems: body.lineItems,
    dueAt: body.dueAt,
    urgency: body.urgency,
    owner: body.owner,
    assignedDepartment: body.assignedDepartment,
  });

  return NextResponse.json(
    {
      data: order,
      created: true,
    },
    { status: 201 },
  );
}
