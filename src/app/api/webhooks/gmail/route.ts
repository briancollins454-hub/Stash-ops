import { NextResponse } from "next/server";
import { processInboundEvent } from "@/server/core/order-orchestrator";
import { mapGmailWebhook } from "@/server/integrations/webhook-mappers";

export async function POST(request: Request) {
  const webhookId = request.headers.get("x-gmail-notification-id");
  const payload = await request.json();

  const event = mapGmailWebhook(payload, webhookId);
  const result = await processInboundEvent(event);

  return NextResponse.json({
    accepted: result.accepted,
    duplicate: "duplicate" in result ? result.duplicate : false,
    orderId: "orderId" in result ? result.orderId : undefined,
  });
}
