import { NextResponse } from "next/server";
import { bulkDispatchOrders } from "@/server/dispatch/dispatch-service";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    orderIds?: string[];
    actor?: string;
  };

  if (!Array.isArray(body.orderIds)) {
    return NextResponse.json(
      {
        error: "orderIds must be an array of internal order IDs.",
      },
      { status: 400 },
    );
  }

  const result = await bulkDispatchOrders(body.orderIds, body.actor ?? "dispatch.ui");

  return NextResponse.json({
    data: result,
    updated: true,
  });
}
