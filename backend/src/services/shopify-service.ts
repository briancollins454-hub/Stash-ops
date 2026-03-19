import { EventProvider } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { env, isShopifyConfigured } from "../config/env";
import { logger } from "../lib/logger";
import { createInboxEvent } from "./event-inbox-service";
import type { ShopifyOrderPayload } from "./order-service";

type ShopifyOrdersResponse = {
  orders: ShopifyOrderPayload[];
};

function ensureShopifyConfigured(): void {
  if (!isShopifyConfigured()) {
    throw new Error("Shopify is not configured. Set SHOPIFY_DOMAIN and SHOPIFY_ACCESS_TOKEN.");
  }
}

function buildBaseHeaders(): Record<string, string> {
  return {
    "X-Shopify-Access-Token": env.SHOPIFY_ACCESS_TOKEN!,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function parseNextLink(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const links = header.split(",");
  for (const rawLink of links) {
    const trimmed = rawLink.trim();
    if (!trimmed.includes('rel="next"')) {
      continue;
    }
    const match = trimmed.match(/<([^>]+)>/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

async function fetchOrdersPage(url: string): Promise<{ orders: ShopifyOrderPayload[]; nextUrl: string | null }> {
  const response = await fetch(url, {
    method: "GET",
    headers: buildBaseHeaders(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Shopify request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as ShopifyOrdersResponse;
  return {
    orders: data.orders ?? [],
    nextUrl: parseNextLink(response.headers.get("link")),
  };
}

export async function backfillShopifyUnfulfilledOrders(options?: {
  maxPages?: number;
  pageSize?: number;
}): Promise<{ queued: number; pages: number }> {
  ensureShopifyConfigured();

  const maxPages = Math.max(1, options?.maxPages ?? env.SHOPIFY_SYNC_MAX_PAGES);
  const pageSize = Math.min(250, Math.max(1, options?.pageSize ?? env.SHOPIFY_SYNC_PAGE_SIZE));

  let pages = 0;
  let queued = 0;
  let nextUrl: string | null =
    `https://${env.SHOPIFY_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}` +
    `/orders.json?status=any&fulfillment_status=unfulfilled&order=created_at%20desc&limit=${pageSize}`;

  while (nextUrl && pages < maxPages) {
    pages += 1;
    const { orders, nextUrl: cursor } = await fetchOrdersPage(nextUrl);
    nextUrl = cursor;

    for (const order of orders) {
      const orderId = String(order.id ?? "");
      if (!orderId) {
        continue;
      }

      const eventId = await createInboxEvent({
        provider: EventProvider.SHOPIFY,
        topic: "orders/backfill",
        externalId: orderId,
        idempotencyKey: `shopify:backfill:order:${orderId}`,
        payload: order as unknown as Prisma.InputJsonValue,
      });

      queued += 1;
      logger.debug({ eventId, orderId }, "Queued Shopify backfill order event");
    }
  }

  return { queued, pages };
}
