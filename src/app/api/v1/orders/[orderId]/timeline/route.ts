import { NextResponse } from "next/server";
import { getUnifiedOrder } from "@/server/repositories/unified-order-repository";

type RouteParams = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function GET(_request: Request, context: RouteParams) {
  const { orderId } = await context.params;
  const order = await getUnifiedOrder(orderId);

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const timeline = [...order.activityLog].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );

  return NextResponse.json({
    data: {
      activity: timeline,
      communication: [...order.communicationTimeline].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : -1,
      ),
    },
  });
}
