import { EventProvider, type Prisma } from "@prisma/client";
import { env, isDecoConfigured } from "../config/env";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { createInboxEvent } from "./event-inbox-service";

// ── DecoNetwork API client ──
//
// DecoNetwork uses query-parameter authentication with lowercase field names.
// Every request must include: username, password, skip_login_token=1
// Search endpoints also require: field, condition, date1/string/criteria
//
// Available APIs:
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

/** Build base auth query params required by every Deco API call (lowercase) */
function authParams(): URLSearchParams {
  const params = new URLSearchParams();
  params.set("username", env.DECO_USERNAME!);
  params.set("password", env.DECO_PASSWORD!);
  params.set("skip_login_token", "1");
  return params;
}

/**
 * Low-level Deco API fetch. Builds full URL from path + params,
 * handles timeouts, JSON parsing, and Deco-level error codes.
 */
async function decoFetch<T>(path: string, extraParams?: Record<string, string>, options?: RequestInit): Promise<T> {
  const params = authParams();
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      params.set(k, v);
    }
  }

  const url = `${baseUrl()}${path}?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.DECO_SYNC_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers: { Accept: "application/json", ...(options?.headers as Record<string, string> ?? {}) },
      signal: controller.signal,
    });

    const text = await response.text();

    // Detect HTML responses (login redirects, 404 pages)
    if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
      throw new Error(`Deco API returned HTML instead of JSON for ${path} — endpoint may not exist`);
    }

    if (!response.ok) {
      throw new Error(`Deco API ${options?.method ?? "GET"} ${path} failed (${response.status}): ${text.slice(0, 300)}`);
    }

    const parsed = text ? (JSON.parse(text) as T) : ({} as T);

    // Check for Deco-level error codes
    const rs = (parsed as Record<string, unknown>)?.response_status as { code?: number; description?: string } | undefined;
    if (rs?.code && rs.code !== 10001) {
      if (rs.code === 30001 || rs.code === 10002) {
        throw new Error("Deco API authentication failed. Check DECO_USERNAME and DECO_PASSWORD.");
      }
      if (rs.code === 10005) {
        throw new Error("Deco API access denied. Ensure API is enabled in DecoNetwork settings.");
      }
      if (rs.code === 50002) {
        throw new Error(`Deco API: No conditions specified for ${path}. Add field/condition params.`);
      }
      throw new Error(`Deco API error (code ${rs.code}): ${rs.description ?? "Unknown error"}`);
    }

    return parsed;
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
// These match the actual JSON shapes returned by the Deco API (snake_case).

type DecoRawOrder = {
  order_id?: number;
  job_name?: string;
  customer_id?: number;
  customer_po_number?: string;
  order_status?: number;
  order_status_name?: string;
  date_ordered?: string;
  date_modified?: string;
  date_due?: string;
  date_scheduled?: string;
  date_shipped?: string;
  date_completed?: string;
  billable_amount?: number;
  billing_details?: {
    user_id?: number;
    company?: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    ph_number?: string;
    country_code?: string;
    state?: string;
    city?: string;
    street?: string;
    postcode?: string;
  };
  order_lines?: DecoRawOrderLine[];
  notes?: Array<{ content?: string }>;
};

type DecoRawOrderLine = {
  item_type?: number;
  product_name?: string;
  product_code?: string;
  sku?: string;
  qty?: string | number;
  product_color?: { name?: string };
  barcode?: string;
  ean?: string;
  production_status?: number;
  workflow_items?: DecoRawWorkflowItem[];
  fields?: Array<{ options?: Array<{ option_id?: number; code?: string; name?: string }> }>;
};

type DecoRawWorkflowItem = {
  option_id?: number;
  vendor_sku?: string;
  barcode?: string;
  ean?: string;
  qty_to_fulfill?: number;
  procurement_status?: number;
  production_status?: number;
  shipping_status?: number;
};

type DecoRawProduct = {
  product_id?: number;
  product_name?: string;
  sku?: string;
  category?: string;
  active?: boolean;
  price?: number;
  sizes?: string;
  colors?: string;
};

type DecoRawInventory = {
  product_id?: number;
  sku?: string;
  product_name?: string;
  qty_on_hand?: number;
  qty_available?: number;
  qty_on_order?: number;
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
  items: DecoRawOrderLine[];
  workflowStatus?: string;
};

function normaliseOrder(raw: DecoRawOrder): DecoOrder {
  const billing = raw.billing_details;
  const custName = billing?.company
    || `${billing?.firstname ?? ""} ${billing?.lastname ?? ""}`.trim()
    || "Unknown";

  return {
    id: raw.order_id ?? 0,
    orderNumber: String(raw.order_id ?? ""),
    jobNumber: String(raw.order_id ?? ""),
    customerId: raw.customer_id ?? billing?.user_id,
    customerName: custName,
    customerEmail: billing?.email,
    status: raw.order_status_name ?? String(raw.order_status ?? ""),
    totalAmount: raw.billable_amount,
    dateOrdered: raw.date_ordered,
    dateUpdated: raw.date_modified,
    items: raw.order_lines ?? [],
    workflowStatus: raw.order_status_name,
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
 * Uses field=1 (Date Ordered), condition=4 (>=), date1 filter.
 * Supports pagination via limit/offset.
 */
export async function syncDecoOrders(options?: {
  since?: string;
  limit?: number;
}): Promise<DecoSyncResult> {
  if (!isDecoConfigured()) {
    throw new Error("DecoNetwork is not configured. Set DECO_BASE_URL, DECO_USERNAME, and DECO_PASSWORD.");
  }

  const cursor = await prisma.syncCursor.findUnique({
    where: { provider: "deco:orders" },
  });

  const since = options?.since ?? cursor?.cursor ?? undefined;
  const limit = options?.limit ?? 10000;
  const BATCH_SIZE = 100;
  let allOrders: DecoRawOrder[] = [];
  let offset = 0;
  let hasMore = true;

  // Default to 90 days ago if no cursor
  const defaultSince = new Date();
  defaultSince.setDate(defaultSince.getDate() - 90);
  const dateFilter = since ?? `${defaultSince.toISOString().split("T")[0]} 00:00:00`;

  while (hasMore && offset < limit) {
    const batchLimit = Math.min(BATCH_SIZE, limit - offset);
    const data = await decoFetch<{ total?: number; orders?: DecoRawOrder[] }>(
      "/api/json/manage_orders/find",
      {
        limit: String(batchLimit),
        offset: String(offset),
        field: "1", // Date Ordered
        condition: "4", // >=
        date1: dateFilter,
        include_workflow_data: "1",
      },
    );

    const batch = data.orders ?? [];
    allOrders = [...allOrders, ...batch];
    if (batch.length < batchLimit || allOrders.length >= (data.total ?? 0)) {
      hasMore = false;
    } else {
      offset += batch.length;
    }
  }

  let synced = 0;
  let errors = 0;
  let latestUpdate: string | undefined;

  // Also extract customers inline from order billing_details
  const customerMap = new Map<string, { id: number; billing: NonNullable<DecoRawOrder["billing_details"]> }>();

  for (const rawOrder of allOrders) {
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

      // Collect customer data from billing_details
      const customerId = rawOrder.customer_id ?? rawOrder.billing_details?.user_id;
      if (customerId && rawOrder.billing_details && !customerMap.has(String(customerId))) {
        customerMap.set(String(customerId), { id: customerId, billing: rawOrder.billing_details });
      }

      if (order.dateUpdated && (!latestUpdate || order.dateUpdated > latestUpdate)) {
        latestUpdate = order.dateUpdated;
      }
    } catch (error) {
      errors++;
      logger.warn({ decoOrderId: rawOrder.order_id, err: error }, "Failed to queue Deco order sync event");
    }
  }

  // Upsert extracted customers
  let customersExtracted = 0;
  for (const [decoCustomerId, { billing }] of customerMap) {
    try {
      const name = billing.company
        || `${billing.firstname ?? ""} ${billing.lastname ?? ""}`.trim()
        || "Unknown";

      await prisma.decoCustomer.upsert({
        where: { decoCustomerId },
        update: { name, email: billing.email ?? null, phone: billing.ph_number ?? null, company: billing.company ?? null, address1: billing.street ?? null, city: billing.city ?? null, state: billing.state ?? null, postcode: billing.postcode ?? null, country: billing.country_code ?? null, active: true, lastSyncedAt: new Date() },
        create: { decoCustomerId, name, email: billing.email ?? null, phone: billing.ph_number ?? null, company: billing.company ?? null, address1: billing.street ?? null, city: billing.city ?? null, state: billing.state ?? null, postcode: billing.postcode ?? null, country: billing.country_code ?? null, active: true },
      });
      customersExtracted++;
    } catch { /* skip duplicate */ }
  }
  if (customersExtracted > 0) {
    logger.info({ customersExtracted }, "Extracted customers from order batch");
  }

  if (latestUpdate) {
    await prisma.syncCursor.upsert({
      where: { provider: "deco:orders" },
      update: { cursor: latestUpdate, updatedAt: new Date() },
      create: { provider: "deco:orders", cursor: latestUpdate },
    });
  }

  logger.info({ synced, errors, total: allOrders.length }, "Deco order sync complete");
  return { provider: "deco", operation: "orders", synced, errors, total: allOrders.length };
}

/**
 * Fetch products from DecoNetwork using /api/json/manage_products/find
 * Persists to DecoProduct table.
 * Note: Deco requires field/condition params even for products.
 */
export async function syncDecoProducts(): Promise<DecoSyncResult> {
  if (!isDecoConfigured()) {
    throw new Error("DecoNetwork is not configured.");
  }

  const data = await decoFetch<{ total?: number; products?: DecoRawProduct[] }>(
    "/api/json/manage_products/find",
    {
      limit: "500",
      field: "1",
      condition: "4",
      date1: "2000-01-01 00:00:00",
    },
  );

  const products = data.products ?? [];
  let synced = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const decoProductId = String(product.product_id ?? "");
      if (!decoProductId) continue;

      await prisma.decoProduct.upsert({
        where: { decoProductId },
        update: {
          name: product.product_name ?? "Unknown",
          sku: product.sku ?? null,
          category: product.category ?? null,
          price: product.price ?? null,
          sizes: product.sizes ?? null,
          colors: product.colors ?? null,
          active: product.active !== false,
          lastSyncedAt: new Date(),
        },
        create: {
          decoProductId,
          name: product.product_name ?? "Unknown",
          sku: product.sku ?? null,
          category: product.category ?? null,
          price: product.price ?? null,
          sizes: product.sizes ?? null,
          colors: product.colors ?? null,
          active: product.active !== false,
        },
      });

      synced++;
    } catch (error) {
      errors++;
      logger.warn({ productId: product.product_id, err: error }, "Failed to process Deco product");
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

  const data = await decoFetch<{ total?: number; inventories?: DecoRawInventory[] }>(
    "/api/json/manage_inventory/find",
    {
      limit: "500",
      field: "1",
      condition: "4",
      date1: "2000-01-01 00:00:00",
    },
  );

  const items = data.inventories ?? [];
  let synced = 0;
  let errors = 0;

  for (const item of items) {
    try {
      const decoProductId = String(item.product_id ?? "");
      if (!decoProductId) continue;

      await prisma.decoInventory.upsert({
        where: { decoProductId },
        update: {
          sku: item.sku ?? null,
          productName: item.product_name ?? null,
          quantityOnHand: item.qty_on_hand ?? 0,
          quantityAvailable: item.qty_available ?? 0,
          quantityOnOrder: item.qty_on_order ?? 0,
          lastSyncedAt: new Date(),
        },
        create: {
          decoProductId,
          sku: item.sku ?? null,
          productName: item.product_name ?? null,
          quantityOnHand: item.qty_on_hand ?? 0,
          quantityAvailable: item.qty_available ?? 0,
          quantityOnOrder: item.qty_on_order ?? 0,
        },
      });

      synced++;
    } catch (error) {
      errors++;
      logger.warn({ productId: item.product_id, err: error }, "Failed to process Deco inventory item");
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
 * Link existing DecoCustomer records (populated by order sync) to Accounts.
 * Customers are extracted inline during syncDecoOrders — this function just
 * handles the account-matching pass.
 */
export async function syncDecoCustomers(): Promise<DecoSyncResult> {
  const unlinked = await prisma.decoCustomer.findMany({
    where: { active: true },
  });

  let synced = 0;
  let errors = 0;

  for (const customer of unlinked) {
    try {
      const existingAccount = await prisma.account.findFirst({
        where: { decoCustomerId: customer.decoCustomerId },
      });

      if (!existingAccount && customer.name) {
        const matchByName = await prisma.account.findFirst({
          where: {
            name: { equals: customer.name, mode: "insensitive" },
            decoCustomerId: null,
          },
        });

        if (matchByName) {
          await prisma.account.update({
            where: { id: matchByName.id },
            data: { decoCustomerId: customer.decoCustomerId },
          });
          logger.info({ accountId: matchByName.id, decoCustomerId: customer.decoCustomerId, name: customer.name }, "Auto-linked Deco customer to account");
          synced++;
        }
      }
    } catch (error) {
      errors++;
      logger.warn({ customerId: customer.decoCustomerId, err: error }, "Failed to link Deco customer");
    }
  }

  await prisma.syncCursor.upsert({
    where: { provider: "deco:customers" },
    update: { cursor: new Date().toISOString(), updatedAt: new Date() },
    create: { provider: "deco:customers", cursor: new Date().toISOString() },
  });

  logger.info({ synced, errors, total: unlinked.length }, "Deco customer link pass complete");
  return { provider: "deco", operation: "customers", synced, errors, total: unlinked.length };
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
        order_id: decoOrderId,
        status,
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

  // DecoNetwork order creation via the Deco API.
  const orderPayload = {
    customer_id: job.account.decoCustomerId,
    external_reference: job.internalJobId,
    customer_name: job.customerName,
    notes: job.orderNotes,
    items: job.items.map((item) => ({
      sku: item.sku,
      product_name: item.productTitle,
      quantity: item.quantity,
      decoration_method: item.decorationMethod,
      unit_price: item.unitPriceMinor ? item.unitPriceMinor / 100 : undefined,
    })),
  };

  try {
    const result = await decoFetch<{ order_id?: number; job_number?: string; order_number?: string }>(
      "/api/json/manage_orders/create",
      undefined,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      },
    );

    const decoOrderId = result.order_id ? String(result.order_id) : undefined;
    const decoJobNumber = result.job_number ?? result.order_number ?? undefined;

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
