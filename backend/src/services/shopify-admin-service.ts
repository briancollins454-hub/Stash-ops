import { env, isShopifyConfigured } from "../config/env";
import { logger } from "../lib/logger";

// ── Shopify Admin REST helpers ──

function baseUrl(): string {
  return `https://${env.SHOPIFY_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}`;
}

function headers(): Record<string, string> {
  return {
    "X-Shopify-Access-Token": env.SHOPIFY_ACCESS_TOKEN!,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// ── Webhook registration ──

type ShopifyWebhook = {
  id: number;
  topic: string;
  address: string;
  format: string;
};

type WebhookTopicMapping = {
  topic: string;
  path: string;
};

const WEBHOOK_TOPICS: WebhookTopicMapping[] = [
  { topic: "orders/create", path: "/api/webhooks/shopify/orders-create" },
  { topic: "orders/updated", path: "/api/webhooks/shopify/orders-updated" },
  { topic: "fulfillments/create", path: "/api/webhooks/shopify/fulfillments-create" },
  { topic: "fulfillments/update", path: "/api/webhooks/shopify/fulfillments-update" },
];

async function listExistingWebhooks(): Promise<ShopifyWebhook[]> {
  const response = await fetch(`${baseUrl()}/webhooks.json`, {
    method: "GET",
    headers: headers(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to list Shopify webhooks (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as { webhooks?: ShopifyWebhook[] };
  return data.webhooks ?? [];
}

async function createWebhook(topic: string, address: string): Promise<ShopifyWebhook> {
  const response = await fetch(`${baseUrl()}/webhooks.json`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      webhook: {
        topic,
        address,
        format: "json",
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create Shopify webhook ${topic} (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as { webhook: ShopifyWebhook };
  return data.webhook;
}

async function deleteWebhook(id: number): Promise<void> {
  const response = await fetch(`${baseUrl()}/webhooks/${id}.json`, {
    method: "DELETE",
    headers: headers(),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.warn({ webhookId: id, status: response.status, text: text.slice(0, 200) }, "Failed to delete old webhook");
  }
}

export type WebhookRegistrationResult = {
  registered: string[];
  skipped: string[];
  removed: number;
};

export async function registerShopifyWebhooks(callbackBaseUrl: string): Promise<WebhookRegistrationResult> {
  if (!isShopifyConfigured()) {
    throw new Error("Shopify is not configured.");
  }

  const existing = await listExistingWebhooks();
  const registered: string[] = [];
  const skipped: string[] = [];
  let removed = 0;

  for (const mapping of WEBHOOK_TOPICS) {
    const address = `${callbackBaseUrl}${mapping.path}`;
    const match = existing.find((w) => w.topic === mapping.topic && w.address === address);

    if (match) {
      skipped.push(mapping.topic);
      continue;
    }

    // Remove any existing webhooks with the same topic but different address
    const stale = existing.filter((w) => w.topic === mapping.topic && w.address !== address);
    for (const old of stale) {
      await deleteWebhook(old.id);
      removed++;
    }

    await createWebhook(mapping.topic, address);
    registered.push(mapping.topic);
    logger.info({ topic: mapping.topic, address }, "Registered Shopify webhook");
  }

  return { registered, skipped, removed };
}

// ── Fulfillment push ──

type FulfillmentOrder = {
  id: number;
  status?: string;
  request_status?: string;
  supported_actions?: string[];
};

function isFulfillable(fo: FulfillmentOrder): boolean {
  const status = (fo.status ?? "").toLowerCase();
  const requestStatus = (fo.request_status ?? "").toLowerCase();
  const supported = (fo.supported_actions ?? []).map((a) => a.toLowerCase());

  if (supported.includes("create_fulfillment")) {
    return true;
  }

  if (status === "open" || status === "in_progress" || status === "scheduled") {
    return requestStatus === "" || requestStatus === "unsubmitted" || requestStatus === "accepted";
  }

  return false;
}

function parseNumericOrderId(shopifyOrderId: string): string | undefined {
  if (/^\d+$/.test(shopifyOrderId)) {
    return shopifyOrderId;
  }

  const gidMatch = shopifyOrderId.match(/gid:\/\/shopify\/Order\/(\d+)/i);
  return gidMatch?.[1] ?? undefined;
}

export type FulfillmentResult = {
  fulfilled: boolean;
  alreadyFulfilled?: boolean;
  fulfillmentId?: string;
  note: string;
};

export async function fulfillShopifyOrder(shopifyOrderId: string): Promise<FulfillmentResult> {
  if (!isShopifyConfigured()) {
    return { fulfilled: false, note: "Shopify not configured." };
  }

  const numericId = parseNumericOrderId(shopifyOrderId);
  if (!numericId) {
    return { fulfilled: false, note: `Cannot parse order id: ${shopifyOrderId}` };
  }

  const base = baseUrl();
  const hdrs = headers();

  // Get fulfillment orders
  const foResponse = await fetch(`${base}/orders/${numericId}/fulfillment_orders.json`, {
    method: "GET",
    headers: hdrs,
  });

  if (!foResponse.ok) {
    const text = await foResponse.text();
    return { fulfilled: false, note: `Fulfillment lookup failed (${foResponse.status}): ${text.slice(0, 180)}` };
  }

  const foData = (await foResponse.json()) as { fulfillment_orders?: FulfillmentOrder[] };
  const fulfillmentOrders = foData.fulfillment_orders ?? [];
  const fulfillable = fulfillmentOrders.filter(isFulfillable);

  if (fulfillable.length === 0) {
    return { fulfilled: true, alreadyFulfilled: true, note: "No open fulfillment orders in Shopify." };
  }

  // Create fulfillment
  const createResponse = await fetch(`${base}/fulfillments.json`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify({
      fulfillment: {
        line_items_by_fulfillment_order: fulfillable.map((fo) => ({
          fulfillment_order_id: fo.id,
        })),
        notify_customer: false,
      },
    }),
  });

  if (!createResponse.ok) {
    const text = await createResponse.text();
    return { fulfilled: false, note: `Fulfillment create failed (${createResponse.status}): ${text.slice(0, 180)}` };
  }

  const createData = (await createResponse.json()) as { fulfillment?: { id?: string | number } };
  const fId = createData.fulfillment?.id;

  return {
    fulfilled: true,
    fulfillmentId: fId !== undefined ? String(fId) : undefined,
    note: "Shopify marked as fulfilled.",
  };
}
