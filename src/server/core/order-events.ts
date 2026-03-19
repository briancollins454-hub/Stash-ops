import type {
  IntegrationSource,
  ShopifyFulfillmentStatus,
} from "@/server/core/order-types";

export type IntegrationEventType =
  | "shopify.order.created"
  | "shopify.order.updated"
  | "deco.order.synced"
  | "deco.stock.updated"
  | "gmail.message.received"
  | "gmail.message.sent"
  | "slack.alert.received"
  | "manual.order.created"
  | "approval.status.updated"
  | "stock.status.updated"
  | "production.stage.updated";

export interface EventOrderRefs {
  internalOrderId?: string;
  shopifyOrderId?: string;
  decoOrderId?: string;
  gmailThreadId?: string;
}

export interface InboundIntegrationEvent<TPayload = unknown> {
  eventId: string;
  idempotencyKey: string;
  source: IntegrationSource;
  eventType: IntegrationEventType;
  occurredAt: string;
  refs: EventOrderRefs;
  payload: TPayload;
}

export interface ShopifyOrderCreatedPayload {
  id: string;
  orderNumber?: string;
  createdAt?: string;
  updatedAt?: string;
  fulfillmentStatus?: ShopifyFulfillmentStatus;
  customer: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
  billingAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
  };
  shippingAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
  };
  lineItems: Array<{
    id: string | number;
    sku?: string;
    title?: string;
    variantTitle?: string;
    quantity?: number;
    price?: string | number;
    properties?: Array<{ name?: string; value?: string }>;
  }>;
  tags?: string;
  note?: string;
}

export interface GmailMessagePayload {
  threadId?: string;
  messageId?: string;
  subject?: string;
  snippet?: string;
  from?: string;
  to?: string[];
  attachments?: string[];
}

export interface DecoStockPayload {
  decoOrderId?: string;
  stockStatus?: string;
  supplierEta?: string;
  notes?: string;
}

export function buildIdempotencyKey(
  source: IntegrationSource,
  eventType: IntegrationEventType,
  nativeId: string | number | undefined,
) {
  return `${source}:${eventType}:${String(nativeId ?? "unknown")}`;
}

export function extractInternalOrderIdCandidate(text?: string) {
  if (!text) {
    return undefined;
  }

  const match = text.match(/\bST-\d{3,}\b/i);
  return match ? match[0].toUpperCase() : undefined;
}
