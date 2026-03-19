import { NextResponse } from "next/server";
import { processInboundEvent } from "@/server/core/order-orchestrator";
import { mapShopifyWebhook } from "@/server/integrations/webhook-mappers";
import { verifyShopifyWebhookHmac } from "@/server/integrations/shopify-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const topic = request.headers.get("x-shopify-topic");
  const webhookId = request.headers.get("x-shopify-webhook-id");
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const rawBody = await request.text();
  const verification = verifyShopifyWebhookHmac(rawBody, hmac);

  if (!verification.valid) {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid Shopify webhook signature.",
        details: verification.reason,
      },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json(
      {
        accepted: false,
        error: "Invalid webhook JSON payload.",
      },
      { status: 400 },
    );
  }

  const event = mapShopifyWebhook(topic, payload, webhookId);
  const result = await processInboundEvent(event);

  return NextResponse.json({
    accepted: result.accepted,
    duplicate: "duplicate" in result ? result.duplicate : false,
    orderId: "orderId" in result ? result.orderId : undefined,
    signatureBypassed: verification.bypassed,
  });
}
