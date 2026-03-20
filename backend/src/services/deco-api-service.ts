import { EventProvider, type Prisma } from "@prisma/client";
import { env, isDecoConfigured } from "../config/env";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { createInboxEvent } from "./event-inbox-service";

// ── DecoNetwork API client ──
//
// DecoNetwork authenticates via Username/Password query params (not Basic Auth).
// Available APIs (from Deco admin Reports panel):
//   /api/json/manage_orders/find          — search orders
//   /api/json/manage_orders/create        — create order
//   /api/json/manage_orders/update_order_status — update order status
//   /api/json/manage_products/find        — search products
//   /api/json/manage_inventory/find       — search inventory
//   /api/json/manage_purchase_orders/find — search POs
//   /api/json/manage_inventory_events/find — inventory events
// Note: There is NO customer management API — customers are extracted from orders.

function baseUrl(): string {
  return env.DECO_BASE_URL!.replace(/\/+$/, "");
}

/** Build base auth query params required by every Deco API call */
function authParams(): URLSearchParams {
  const params = new URLSearchParams();
  params.set("Username", env.DECO_USERNAME!);
  params.set("Password", env.DECO_PASSWORD!);
  return params;
}

function getHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
  };
}

function jsonHeaders(): Record<string, string> {
  return {
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

    // Detect HTML responses (e.g. login pages for unsupported endpoints)
    if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
      throw new Error(`Deco API returned HTML instead of JSON for ${path} — endpoint may not exist`);
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
  Price?: number;
  Sizes?: string;
  Colors?: string;
};

type DecoInventoryResponse = {
  ProductId?: number;
  Sku?: string;
  ProductName?: string;
  QuantityOnHand?: number;
  QuantityAvailable?: number;
  QuantityOnOrder?: number;
};

type DecoCustomerResponse = {
  CustomerId?: number;
  CustomerName?: string;
  Email?: string;
  Phone?: string;
  CompanyName?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  PostCode?: string;
  Country?: string;
  Active?: boolean;
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

  // Build query params for the Deco Order Management API
  const params = authParams();
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
    `/api/json/manage_orders/find?${params.toString()}`,
    {
      method: "GET",
      headers: getHeaders(),
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
 * Persists to DecoProduct table.
 */
export async function syncDecoProducts(): Promise<DecoSyncResult> {
  if (!isDecoConfigured()) {
    throw new Error("DecoNetwork is not configured.");
  }

  const params = authParams();
  params.set("Limit", "500");

  const rawProducts = await decoFetch<DecoProductResponse[]>(
    `/api/json/manage_products/find?${params.toString()}`,
    { method: "GET", headers: getHeaders() },
  );

  const products = Array.isArray(rawProducts) ? rawProducts : [];
  let synced = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const decoProductId = String(product.ProductId ?? "");
      if (!decoProductId) continue;

      await prisma.decoProduct.upsert({
        where: { decoProductId },
        update: {
          name: product.ProductName ?? "Unknown",
          sku: product.Sku ?? null,
          category: product.Category ?? null,
          price: product.Price ?? null,
          sizes: product.Sizes ?? null,
          colors: product.Colors ?? null,
          active: product.Active !== false,
          lastSyncedAt: new Date(),
        },
        create: {
          decoProductId,
          name: product.ProductName ?? "Unknown",
          sku: product.Sku ?? null,
          category: product.Category ?? null,
          price: product.Price ?? null,
          sizes: product.Sizes ?? null,
          colors: product.Colors ?? null,
          active: product.Active !== false,
        },
      });

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
 * Persists to DecoInventory table.
 */
export async function syncDecoInventory(): Promise<DecoSyncResult> {
  if (!isDecoConfigured()) {
    throw new Error("DecoNetwork is not configured.");
  }

  const params = authParams();
  params.set("Limit", "500");

  const rawInventory = await decoFetch<DecoInventoryResponse[]>(
    `/api/json/manage_inventory/find?${params.toString()}`,
    { method: "GET", headers: getHeaders() },
  );

  const items = Array.isArray(rawInventory) ? rawInventory : [];
  let synced = 0;
  let errors = 0;

  for (const item of items) {
    try {
      const decoProductId = String(item.ProductId ?? "");
      if (!decoProductId) continue;

      await prisma.decoInventory.upsert({
        where: { decoProductId },
        update: {
          sku: item.Sku ?? null,
          productName: item.ProductName ?? null,
          quantityOnHand: item.QuantityOnHand ?? 0,
          quantityAvailable: item.QuantityAvailable ?? 0,
          quantityOnOrder: item.QuantityOnOrder ?? 0,
          lastSyncedAt: new Date(),
        },
        create: {
          decoProductId,
          sku: item.Sku ?? null,
          productName: item.ProductName ?? null,
          quantityOnHand: item.QuantityOnHand ?? 0,
          quantityAvailable: item.QuantityAvailable ?? 0,
          quantityOnOrder: item.QuantityOnOrder ?? 0,
        },
      });

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

/**
 * Extract unique customers from Deco orders and persist to DecoCustomer table.
 * DecoNetwork has no dedicated customer management API, so we pull customer
 * info from the order data (CustomerId, CustomerName, CustomerEmail).
 */
export async function syncDecoCustomers(): Promise<DecoSyncResult> {
  if (!isDecoConfigured()) {
    throw new Error("DecoNetwork is not configured.");
  }

  // Fetch a large batch of orders to extract customer data
  const params = authParams();
  params.set("Limit", "500");
  params.set("Offset", "0");
  params.set("SortBy", "Date Ordered");

  const rawOrders = await decoFetch<DecoOrderResponse[]>(
    `/api/json/manage_orders/find?${params.toString()}`,
    { method: "GET", headers: getHeaders() },
  );

  const ordersList = Array.isArray(rawOrders) ? rawOrders : [];

  // De-duplicate customers by CustomerId
  const customerMap = new Map<string, DecoCustomerResponse>();
  for (const order of ordersList) {
    const customerId = order.CustomerId;
    if (!customerId) continue;
    const key = String(customerId);
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        CustomerId: customerId,
        CustomerName: order.CustomerName,
        Email: order.CustomerEmail,
      });
    }
  }

  const customers = Array.from(customerMap.values());
  let synced = 0;
  let errors = 0;

  for (const customer of customers) {
    try {
      const decoCustomerId = String(customer.CustomerId ?? "");
      if (!decoCustomerId) continue;

      await prisma.decoCustomer.upsert({
        where: { decoCustomerId },
        update: {
          name: customer.CustomerName ?? "Unknown",
          email: customer.Email ?? null,
          phone: customer.Phone ?? null,
          company: customer.CompanyName ?? null,
          address1: customer.Address1 ?? null,
          address2: customer.Address2 ?? null,
          city: customer.City ?? null,
          state: customer.State ?? null,
          postcode: customer.PostCode ?? null,
          country: customer.Country ?? null,
          active: customer.Active !== false,
          lastSyncedAt: new Date(),
        },
        create: {
          decoCustomerId,
          name: customer.CustomerName ?? "Unknown",
          email: customer.Email ?? null,
          phone: customer.Phone ?? null,
          company: customer.CompanyName ?? null,
          address1: customer.Address1 ?? null,
          address2: customer.Address2 ?? null,
          city: customer.City ?? null,
          state: customer.State ?? null,
          postcode: customer.PostCode ?? null,
          country: customer.Country ?? null,
          active: customer.Active !== false,
        },
      });

      // Auto-link to Account if decoCustomerId matches
      const existingAccount = await prisma.account.findFirst({
        where: { decoCustomerId },
      });

      if (!existingAccount && customer.CustomerName) {
        // Check if there's an account with matching name that has no Deco link
        const matchByName = await prisma.account.findFirst({
          where: {
            name: { equals: customer.CustomerName, mode: "insensitive" },
            decoCustomerId: null,
          },
        });

        if (matchByName) {
          await prisma.account.update({
            where: { id: matchByName.id },
            data: { decoCustomerId },
          });
          logger.info({ accountId: matchByName.id, decoCustomerId, name: customer.CustomerName }, "Auto-linked Deco customer to account");
        }
      }

      synced++;
    } catch (error) {
      errors++;
      logger.warn({ customerId: customer.CustomerId, err: error }, "Failed to process Deco customer");
    }
  }

  await prisma.syncCursor.upsert({
    where: { provider: "deco:customers" },
    update: { cursor: new Date().toISOString(), updatedAt: new Date() },
    create: { provider: "deco:customers", cursor: new Date().toISOString() },
  });

  logger.info({ synced, errors, total: customers.length }, "Deco customer sync complete");
  return { provider: "deco", operation: "customers", synced, errors, total: customers.length };
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
