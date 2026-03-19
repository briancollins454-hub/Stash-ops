import { EventProvider, type Prisma } from "@prisma/client";
import { env, isDecoConfigured } from "../config/env";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { createInboxEvent } from "./event-inbox-service";

// ── DecoNetwork API client ──
//
// DecoNetwork uses Basic Auth (username/password) and exposes JSON endpoints:
//   /api/json/manage_orders/find          — search orders
//   /api/json/manage_orders/update_order_status — update order status
//   /api/json/manage_products/find        — search products
//   /api/json/manage_inventory/find       — search inventory
//   /api/json/manage_purchase_orders/find — search POs

function baseUrl(): string {
  return env.DECO_BASE_URL!.replace(/\/+$/, "");
}

function basicAuthHeader(): string {
  const credentials = Buffer.from(`${env.DECO_USERNAME}:${env.DECO_PASSWORD}`).toString("base64");
  return `Basic ${credentials}`;
}

function headers(): Record<string, string> {
  return {
    Authorization: basicAuthHeader(),
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
}

function jsonHeaders(): Record<string, string> {
  return {
    Authorization: basicAuthHeader(),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function decoFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.DECO_SYNC_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers: { ...(options?.headers as Record<string, string> | undefined) },
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Deco API ${options?.method ?? "GET"} ${path} failed (${response.status}): ${text.slice(0, 300)}`);
    }

    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Deco API request timed out after ${env.DECO_SYNC_TIMEOUT_MS}ms: ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ── DecoNetwork response types ──
// These match the actual JSON shapes returned by the Deco API.

type DecoOrderResponse = {
  OrderId?: number;
  OrderNumber?: string;
  JobNumber?: string;
  DateOrdered?: string;
  DateUpdated?: string;
  Status?: string;
  CustomerName?: string;
  CustomerEmail?: string;
  CustomerId?: number;
  TotalAmount?: number;
  Currency?: string;
  Items?: DecoOrderItemResponse[];
  PurchaseOrders?: DecoPOResponse[];
  Shipments?: DecoShipmentResponse[];
  WorkflowStatus?: string;
};

type DecoOrderItemResponse = {
  ItemId?: number;
  ProductId?: number;
  ProductName?: string;
  Sku?: string;
  Quantity?: number;
  UnitPrice?: number;
  DecorationMethod?: string;
  DesignId?: number;
  Status?: string;
};

type DecoPOResponse = {
  PurchaseOrderId?: number;
  SupplierName?: string;
  Status?: string;
  DateCreated?: string;
  DateExpected?: string;
  Items?: Array<{ Sku?: string; Quantity?: number; ReceivedQuantity?: number }>;
};

type DecoShipmentResponse = {
  ShipmentId?: number;
  TrackingNumber?: string;
  Status?: string;
  DateShipped?: string;
};

type DecoProductResponse = {
  ProductId?: number;
  ProductName?: string;
  Sku?: string;
  Category?: string;
  Active?: boolean;
};

type DecoInventoryResponse = {
  ProductId?: number;
  Sku?: string;
  QuantityOnHand?: number;
  QuantityAvailable?: number;
  QuantityOnOrder?: number;
};

// ── Normalised types (used internally) ──

export type DecoOrder = {
  id: number;
  orderNumber?: string;
  jobNumber?: string;
  customerId?: number;
  customerName?: string;
  customerEmail?: string;
  status?: string;
  totalAmount?: number;
  dateOrdered?: string;
  dateUpdated?: string;
  items: DecoOrderItemResponse[];
  purchaseOrders: DecoPOResponse[];
  shipments: DecoShipmentResponse[];
  workflowStatus?: string;
};

function normaliseOrder(raw: DecoOrderResponse): DecoOrder {
  return {
    id: raw.OrderId ?? 0,
    orderNumber: raw.OrderNumber ?? raw.JobNumber,
    jobNumber: raw.JobNumber,
    customerId: raw.CustomerId,
    customerName: raw.CustomerName,
    customerEmail: raw.CustomerEmail,
    status: raw.Status,
    totalAmount: raw.TotalAmount,
    dateOrdered: raw.DateOrdered,
    dateUpdated: raw.DateUpdated,
    items: raw.Items ?? [],
    purchaseOrders: raw.PurchaseOrders ?? [],
    shipments: raw.Shipments ?? [],
    workflowStatus: raw.WorkflowStatus,
  };
}

// ── Pull operations (inbound sync from Deco → Stash) ──

export type DecoSyncResult = {
  provider: "deco";
  operation: string;
  synced: number;
  errors: number;
  total: number;
};

/**
 * Fetch orders from DecoNetwork using /api/json/manage_orders/find
 * Supports filtering by date, pagination via limit/offset.
 */
export async function syncDecoOrders(options?: {
  since?: string;
  limit?: number;
  includeWorkflow?: boolean;
  includePurchaseOrders?: boolean;
  includeShipments?: boolean;
}): Promise<DecoSyncResult> {
  if (!isDecoConfigured()) {
    throw new Error("DecoNetwork is not configured. Set DECO_BASE_URL, DECO_USERNAME, and DECO_PASSWORD.");
  }

  const cursor = await prisma.syncCursor.findUnique({
    where: { provider: "deco:orders" },
  });

  const since = options?.since ?? cursor?.cursor ?? undefined;
  const limit = options?.limit ?? 100;

  // Build form-encoded body for the Deco Order Management API
  const params = new URLSearchParams();
  params.set("Username", env.DECO_USERNAME!);
  params.set("Password", env.DECO_PASSWORD!);
  params.set("Limit", String(limit));
  params.set("Offset", "0");
  params.set("SortBy", "Date Ordered");

  if (since) {
    params.set("Field", "Date Updated");
    params.set("Condition", ">=");
    params.set("Date1", since);
  }

  if (options?.includeWorkflow !== false) {
    params.set("IncludeWorkflowInformation", "true");
  }
  if (options?.includePurchaseOrders) {
    params.set("IncludePurchaseOrderInformation", "true");
  }
  if (options?.includeShipments) {
    params.set("IncludeShipments", "true");
  }

  const rawOrders = await decoFetch<DecoOrderResponse[]>(
    "/api/json/manage_orders/find",
    {
      method: "GET",
      headers: {
        ...headers(),
      },
    },
  );

  // Deco returns an empty body or empty array when no results
  const ordersList = Array.isArray(rawOrders) ? rawOrders : [];
  let synced = 0;
  let errors = 0;
  let latestUpdate: string | undefined;

  for (const rawOrder of ordersList) {
    try {
      const order = normaliseOrder(rawOrder);
      if (!order.id) continue;

      const decoOrderId = String(order.id);

      await createInboxEvent({
        provider: EventProvider.DECO,
        topic: "orders/sync",
        externalId: decoOrderId,
        idempotencyKey: `deco:order:${decoOrderId}:${order.dateUpdated ?? order.dateOrdered ?? Date.now()}`,
        payload: rawOrder as unknown as Prisma.InputJsonValue,
      });

      synced++;

      if (order.dateUpdated && (!latestUpdate || order.dateUpdated > latestUpdate)) {
        latestUpdate = order.dateUpdated;
      }
    } catch (error) {
      errors++;
      logger.warn({ decoOrderId: rawOrder.OrderId, err: error }, "Failed to queue Deco order sync event");
    }
  }

  if (latestUpdate) {
    await prisma.syncCursor.upsert({
      where: { provider: "deco:orders" },
      update: { cursor: latestUpdate, updatedAt: new Date() },
      create: { provider: "deco:orders", cursor: latestUpdate },
    });
  }

  logger.info({ synced, errors, total: ordersList.length }, "Deco order sync complete");
  return { provider: "deco", operation: "orders", synced, errors, total: ordersList.length };
}

/**
 * Fetch products from DecoNetwork using /api/json/manage_products/find
 */
export async function syncDecoProducts(): Promise<DecoSyncResult> {
  if (!isDecoConfigured()) {
    throw new Error("DecoNetwork is not configured.");
  }

  const rawProducts = await decoFetch<DecoProductResponse[]>(
    `/api/json/manage_products/find?Username=${encodeURIComponent(env.DECO_USERNAME!)}&Password=${encodeURIComponent(env.DECO_PASSWORD!)}&Limit=500`,
    { method: "GET", headers: headers() },
  );

  const products = Array.isArray(rawProducts) ? rawProducts : [];
  let synced = 0;
  let errors = 0;

  for (const product of products) {
    try {
      // Log product data for future use — products don't map 1:1 to our model yet
      logger.debug({ productId: product.ProductId, sku: product.Sku, name: product.ProductName }, "Deco product synced");
      synced++;
    } catch (error) {
      errors++;
      logger.warn({ productId: product.ProductId, err: error }, "Failed to process Deco product");
    }
  }

  await prisma.syncCursor.upsert({
    where: { provider: "deco:products" },
    update: { cursor: new Date().toISOString(), updatedAt: new Date() },
    create: { provider: "deco:products", cursor: new Date().toISOString() },
  });

  logger.info({ synced, errors, total: products.length }, "Deco product sync complete");
  return { provider: "deco", operation: "products", synced, errors, total: products.length };
}

/**
 * Fetch inventory from DecoNetwork using /api/json/manage_inventory/find
 */
export async function syncDecoInventory(): Promise<DecoSyncResult> {
  if (!isDecoConfigured()) {
    throw new Error("DecoNetwork is not configured.");
  }

  const rawInventory = await decoFetch<DecoInventoryResponse[]>(
    `/api/json/manage_inventory/find?Username=${encodeURIComponent(env.DECO_USERNAME!)}&Password=${encodeURIComponent(env.DECO_PASSWORD!)}&Limit=500`,
    { method: "GET", headers: headers() },
  );

  const items = Array.isArray(rawInventory) ? rawInventory : [];
  let synced = 0;
  let errors = 0;

  for (const item of items) {
    try {
      logger.debug({
        productId: item.ProductId,
        sku: item.Sku,
        onHand: item.QuantityOnHand,
        available: item.QuantityAvailable,
      }, "Deco inventory item synced");
      synced++;
    } catch (error) {
      errors++;
      logger.warn({ productId: item.ProductId, err: error }, "Failed to process Deco inventory item");
    }
  }

  await prisma.syncCursor.upsert({
    where: { provider: "deco:inventory" },
    update: { cursor: new Date().toISOString(), updatedAt: new Date() },
    create: { provider: "deco:inventory", cursor: new Date().toISOString() },
  });

  logger.info({ synced, errors, total: items.length }, "Deco inventory sync complete");
  return { provider: "deco", operation: "inventory", synced, errors, total: items.length };
}

// ── Push / update operations (outbound from Stash → Deco) ──

export type DecoPushOrderResult = {
  pushed: boolean;
  decoOrderId?: string;
  decoJobNumber?: string;
  error?: string;
};

/**
 * Update an order's status in DecoNetwork via /api/json/manage_orders/update_order_status
 */
export async function updateDecoOrderStatus(
  decoOrderId: string,
  status: string,
): Promise<{ updated: boolean; error?: string }> {
  if (!isDecoConfigured()) {
    return { updated: false, error: "DecoNetwork is not configured." };
  }

  try {
    await decoFetch<unknown>(
      "/api/json/manage_orders/update_order_status",
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          Username: env.DECO_USERNAME,
          Password: env.DECO_PASSWORD,
          OrderId: decoOrderId,
          Status: status,
        }),
      },
    );

    return { updated: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ decoOrderId, status, err: error }, "Failed to update Deco order status");
    return { updated: false, error: message };
  }
}

export async function pushJobToDeco(jobId: string): Promise<DecoPushOrderResult> {
  if (!isDecoConfigured()) {
    return { pushed: false, error: "DecoNetwork is not configured." };
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { items: true, account: true },
  });

  if (!job) {
    return { pushed: false, error: "Job not found." };
  }

  if (!job.account?.decoCustomerId) {
    return { pushed: false, error: "Job has no linked Deco customer." };
  }

  // DecoNetwork order creation — the exact endpoint depends on your Deco setup.
  // This creates an order via the Deco API.
  const payload = {
    Username: env.DECO_USERNAME,
    Password: env.DECO_PASSWORD,
    CustomerId: job.account.decoCustomerId,
    ExternalReference: job.internalJobId,
    CustomerName: job.customerName,
    Notes: job.orderNotes,
    Items: job.items.map((item) => ({
      Sku: item.sku,
      ProductName: item.productTitle,
      Quantity: item.quantity,
      DecorationMethod: item.decorationMethod,
      UnitPrice: item.unitPriceMinor ? item.unitPriceMinor / 100 : undefined,
    })),
  };

  try {
    const result = await decoFetch<{ OrderId?: number; JobNumber?: string; OrderNumber?: string }>(
      "/api/json/manage_orders/create",
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(payload),
      },
    );

    const decoOrderId = result.OrderId ? String(result.OrderId) : undefined;
    const decoJobNumber = result.JobNumber ?? result.OrderNumber ?? undefined;

    // Update job with Deco references
    await prisma.$transaction(async (tx) => {
      await tx.job.update({
        where: { id: jobId },
        data: {
          decoOrderId,
          pushToDecoStatus: "pushed",
          lastDecoPushAt: new Date(),
          decoPushErrors: null,
        },
      });

      if (decoOrderId) {
        await tx.externalLink.upsert({
          where: {
            provider_externalId: {
              provider: "DECO_ORDER",
              externalId: decoOrderId,
            },
          },
          update: { jobId },
          create: {
            jobId,
            provider: "DECO_ORDER",
            externalId: decoOrderId,
            metadata: { jobNumber: decoJobNumber },
          },
        });
      }

      await tx.activityLog.create({
        data: {
          jobId,
          eventType: "deco.order.pushed",
          message: `Job pushed to Deco${decoJobNumber ? ` (Job #${decoJobNumber})` : ""}`,
          payload: { decoOrderId, decoJobNumber } as Prisma.InputJsonValue,
        },
      });
    });

    logger.info({ jobId, decoOrderId, decoJobNumber }, "Job pushed to Deco");
    return { pushed: true, decoOrderId, decoJobNumber };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await prisma.job.update({
      where: { id: jobId },
      data: {
        pushToDecoStatus: "failed",
        lastDecoPushAt: new Date(),
        decoPushErrors: message.slice(0, 500),
      },
    });

    await prisma.activityLog.create({
      data: {
        jobId,
        eventType: "deco.order.push_failed",
        message: `Deco push failed: ${message.slice(0, 200)}`,
      },
    });

    logger.error({ jobId, err: error }, "Failed to push job to Deco");
    return { pushed: false, error: message };
  }
}

// ── Webhook payload processing ──

export type DecoWebhookPayload = {
  event?: string;
  type?: string;
  data?: Record<string, unknown>;
  id?: string | number;
  orderId?: string | number;
  jobNumber?: string;
  status?: string;
  timestamp?: string;
};

export async function processDecoWebhook(
  topic: string,
  payload: DecoWebhookPayload,
): Promise<{ accepted: boolean; eventInboxId?: string }> {
  const externalId = String(payload.orderId ?? payload.id ?? "");

  const eventInboxId = await createInboxEvent({
    provider: EventProvider.DECO,
    topic,
    externalId: externalId || undefined,
    idempotencyKey: `deco:webhook:${topic}:${externalId}:${payload.timestamp ?? Date.now()}`,
    payload: payload as unknown as Prisma.InputJsonValue,
  });

  return { accepted: true, eventInboxId };
}
