import { NextResponse } from "next/server";
import { getBackendApiBaseUrl } from "@/lib/backend-api";

export const runtime = "nodejs";

function resolveBackendWebhookPath(topic: string | null): string {
  if (topic === "orders/updated") return "/webhooks/shopify/orders-updated";
  if (topic?.startsWith("fulfillments/")) {
    return topic === "fulfillments/update"
      ? "/webhooks/shopify/fulfillments-update"
      : "/webhooks/shopify/fulfillments-create";
  }
  return "/webhooks/shopify/orders-create";
}

export async function POST(request: Request) {
  const baseUrl = getBackendApiBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { accepted: false, error: "Backend API is not configured." },
      { status: 503 },
    );
  }

  const topic = request.headers.get("x-shopify-topic");
  const rawBody = await request.arrayBuffer();
  const path = resolveBackendWebhookPath(topic);

  const headers: Record<string, string> = { "content-type": "application/json" };
  for (const key of ["x-shopify-topic", "x-shopify-hmac-sha256", "x-shopify-webhook-id", "x-shopify-shop-domain"]) {
    const value = request.headers.get(key);
    if (value) headers[key] = value;
  }

  try {
    const upstream = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: rawBody,
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      { accepted: false, error: error instanceof Error ? error.message : "Upstream proxy failed." },
      { status: 502 },
    );
  }
}
