import {
  buildIdempotencyKey,
  extractInternalOrderIdCandidate,
  type InboundIntegrationEvent,
  type IntegrationEventType,
  type ShopifyOrderCreatedPayload,
} from "@/server/core/order-events";
import type { ShopifyFulfillmentStatus } from "@/server/core/order-types";

function nowIso() {
  return new Date().toISOString();
}

function randomEventId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeShopifyFulfillmentStatus(
  value: unknown,
): ShopifyFulfillmentStatus | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  const normalized = value.toUpperCase();
  if (normalized === "FULFILLED") {
    return "fulfilled";
  }
  if (normalized === "PARTIAL" || normalized === "PARTIALLY_FULFILLED") {
    return "partial";
  }
  if (normalized === "RESTOCKED") {
    return "restocked";
  }
  if (normalized === "UNFULFILLED" || normalized === "OPEN") {
    return "unfulfilled";
  }

  return "unknown";
}

function normalizeShopifyWebhookPayload(payload: unknown): ShopifyOrderCreatedPayload {
  if (typeof payload !== "object" || payload === null) {
    return {
      id: "unknown",
      customer: {},
      lineItems: [],
    };
  }

  const raw = payload as Record<string, unknown>;
  const rawCustomer =
    typeof raw.customer === "object" && raw.customer !== null
      ? (raw.customer as Record<string, unknown>)
      : undefined;

  const lineItemsSource = Array.isArray(raw.line_items)
    ? raw.line_items
    : Array.isArray(raw.lineItems)
      ? raw.lineItems
      : [];

  const lineItems = lineItemsSource
    .filter((line): line is Record<string, unknown> => typeof line === "object" && line !== null)
    .map((line) => ({
      id:
        typeof line.id === "string" || typeof line.id === "number"
          ? line.id
          : `line-${Math.random().toString(16).slice(2, 8)}`,
      sku: typeof line.sku === "string" ? line.sku : undefined,
      title: typeof line.title === "string" ? line.title : undefined,
      variantTitle:
        typeof line.variant_title === "string"
          ? line.variant_title
          : typeof line.variantTitle === "string"
            ? line.variantTitle
            : undefined,
      quantity: typeof line.quantity === "number" ? line.quantity : undefined,
      price:
        typeof line.price === "string" || typeof line.price === "number" ? line.price : undefined,
      properties: Array.isArray(line.properties)
        ? line.properties
            .filter(
              (property): property is { name?: string; value?: string } =>
                typeof property === "object" && property !== null,
            )
            .map((property) => ({
              name: property.name,
              value: property.value,
            }))
        : undefined,
    }));

  const orderName =
    typeof raw.order_number === "number"
      ? String(raw.order_number)
      : typeof raw.name === "string"
        ? raw.name.replace("#", "")
        : undefined;

  return {
    id:
      typeof raw.id === "number" || typeof raw.id === "string"
        ? String(raw.id)
        : "unknown",
    orderNumber: orderName,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
    fulfillmentStatus: normalizeShopifyFulfillmentStatus(raw.fulfillment_status),
    customer: {
      id:
        typeof rawCustomer?.id === "number" || typeof rawCustomer?.id === "string"
          ? String(rawCustomer.id)
          : undefined,
      firstName: typeof rawCustomer?.first_name === "string" ? rawCustomer.first_name : undefined,
      lastName: typeof rawCustomer?.last_name === "string" ? rawCustomer.last_name : undefined,
      email: typeof rawCustomer?.email === "string" ? rawCustomer.email : undefined,
      phone: typeof rawCustomer?.phone === "string" ? rawCustomer.phone : undefined,
      company:
        typeof rawCustomer?.default_address === "object" &&
        rawCustomer.default_address !== null &&
        typeof (rawCustomer.default_address as Record<string, unknown>).company === "string"
          ? String((rawCustomer.default_address as Record<string, unknown>).company)
          : undefined,
    },
    billingAddress:
      typeof raw.billing_address === "object" && raw.billing_address !== null
        ? (raw.billing_address as ShopifyOrderCreatedPayload["billingAddress"])
        : undefined,
    shippingAddress:
      typeof raw.shipping_address === "object" && raw.shipping_address !== null
        ? (raw.shipping_address as ShopifyOrderCreatedPayload["shippingAddress"])
        : undefined,
    lineItems,
    tags: typeof raw.tags === "string" ? raw.tags : undefined,
    note: typeof raw.note === "string" ? raw.note : undefined,
  };
}

export function mapShopifyWebhook(
  topic: string | null,
  payload: unknown,
  webhookId: string | null,
): InboundIntegrationEvent {
  const eventType: IntegrationEventType =
    topic === "orders/create" ? "shopify.order.created" : "shopify.order.updated";

  const orderId =
    typeof payload === "object" && payload && "id" in payload
      ? String((payload as { id: string | number }).id)
      : undefined;

  const normalizedPayload = normalizeShopifyWebhookPayload(payload);

  return {
    eventId: randomEventId("shopify"),
    idempotencyKey: buildIdempotencyKey("shopify", eventType, webhookId ?? orderId),
    source: "shopify",
    eventType,
    occurredAt: nowIso(),
    refs: {
      shopifyOrderId: orderId,
    },
    payload: normalizedPayload,
  };
}

export function mapDecoWebhook(
  payload: unknown,
  webhookId: string | null,
): InboundIntegrationEvent {
  const decoOrderId =
    typeof payload === "object" && payload && "decoOrderId" in payload
      ? String((payload as { decoOrderId?: string }).decoOrderId ?? "")
      : undefined;

  return {
    eventId: randomEventId("deco"),
    idempotencyKey: buildIdempotencyKey("deco", "deco.stock.updated", webhookId ?? decoOrderId),
    source: "deco",
    eventType: "deco.stock.updated",
    occurredAt: nowIso(),
    refs: {
      decoOrderId,
    },
    payload,
  };
}

export function mapGmailWebhook(
  payload: unknown,
  webhookId: string | null,
): InboundIntegrationEvent {
  const maybePayload = payload as {
    threadId?: string;
    messageId?: string;
    subject?: string;
    snippet?: string;
    direction?: "inbound" | "outbound";
  };
  const subject = maybePayload?.subject;
  const snippet = maybePayload?.snippet;

  const internalOrderId =
    extractInternalOrderIdCandidate(subject) ?? extractInternalOrderIdCandidate(snippet);

  const eventType: IntegrationEventType =
    maybePayload.direction === "outbound" ? "gmail.message.sent" : "gmail.message.received";

  return {
    eventId: randomEventId("gmail"),
    idempotencyKey: buildIdempotencyKey(
      "gmail",
      eventType,
      webhookId ?? maybePayload.messageId ?? maybePayload.threadId,
    ),
    source: "gmail",
    eventType,
    occurredAt: nowIso(),
    refs: {
      internalOrderId,
      gmailThreadId: maybePayload.threadId,
    },
    payload,
  };
}

export function mapSlackWebhook(
  payload: unknown,
  webhookId: string | null,
): InboundIntegrationEvent {
  const maybePayload = payload as {
    text?: string;
    thread_ts?: string;
  };
  const internalOrderId = extractInternalOrderIdCandidate(maybePayload?.text);

  return {
    eventId: randomEventId("slack"),
    idempotencyKey: buildIdempotencyKey(
      "slack",
      "slack.alert.received",
      webhookId ?? maybePayload.thread_ts,
    ),
    source: "slack",
    eventType: "slack.alert.received",
    occurredAt: nowIso(),
    refs: {
      internalOrderId,
    },
    payload,
  };
}
