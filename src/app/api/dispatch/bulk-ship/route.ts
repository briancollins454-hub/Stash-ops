import { NextResponse } from "next/server";
import { bulkDispatchOrders } from "@/server/dispatch/dispatch-service";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    orderIds?: string[];
    jobIds?: string[];
    actor?: string;
  };

  const ids = body.jobIds ?? body.orderIds;

  if (!Array.isArray(ids)) {
    return NextResponse.json(
      {
        error: "jobIds must be an array of internal job IDs.",
      },
      { status: 400 },
    );
  }

  const result = await bulkDispatchOrders(ids, body.actor ?? "dispatch.ui");

  return NextResponse.json({
    data: result,
    updated: true,
  });
}
