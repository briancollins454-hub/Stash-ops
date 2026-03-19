import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";
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
  if (isBackendApiConfigured()) {
    const { searchParams } = new URL(request.url);
    const lane = searchParams.get("lane") ?? "all";
    const limit = searchParams.get("limit") ?? "300";

    try {
      const payload = await fetchBackendJson<{
        lane: "active" | "fulfilled" | "all";
        total: number;
        items: unknown[];
        groupedBySource: unknown[];
      }>(`/api/v1/orders?lane=${encodeURIComponent(lane)}&limit=${encodeURIComponent(limit)}`);

      return NextResponse.json({
        data: payload.items,
        count: payload.total,
        lane: payload.lane,
        groupedBySource: payload.groupedBySource,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to load orders from backend API.",
        },
        { status: 502 },
      );
    }
  }

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

  if (isBackendApiConfigured()) {
    try {
      const manualPayload = {
        customerName: body.customer.name,
        customerEmail: body.customer.email,
        sourceGroupLabel: body.customer.company,
        lineItems: body.lineItems.map((lineItem) => ({
          sku: lineItem.sku,
          productTitle: lineItem.productTitle,
          variantTitle: lineItem.decorationPlacement,
          quantity: lineItem.quantity,
          decorationMethod: lineItem.decorationMethod,
          requiresArtwork:
            lineItem.decorationMethod !== "other" &&
            lineItem.decorationMethod !== "screen_print",
          unitPriceMinor:
            Number.isFinite(lineItem.unitPrice) ? Math.round(lineItem.unitPrice * 100) : undefined,
        })),
      };

      const created = await fetchBackendJson<{
        ok: boolean;
        orderId: string;
        internalOrderId: string;
      }>("/api/v1/orders/manual", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(manualPayload),
      });

      return NextResponse.json(
        {
          data: {
            internalOrderId: created.internalOrderId,
            orderId: created.orderId,
          },
          created: true,
          backend: true,
        },
        { status: 201 },
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to create order in backend API.",
        },
        { status: 502 },
      );
    }
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
