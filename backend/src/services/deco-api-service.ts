import { EventProvider, type Prisma } from "@prisma/client";
import { env, isDecoConfigured } from "../config/env";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { catalogImages } from "./catalog-service";
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
  product_code?: string;
  product_name?: string;
  sku?: string;
  category?: string;
  supplier?: string;
  brand?: string;
  active?: boolean;
  is_active?: boolean;
  price?: number;
  sizes?: string;
  colors?: string;
  categories?: Array<{ id?: number; name?: string }>;
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
  includeWorkflow?: boolean;
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

  // Default to 90 days ago if no cursor
  const defaultSince = new Date();
  defaultSince.setDate(defaultSince.getDate() - 90);
  const dateFilter = since ?? `${defaultSince.toISOString().split("T")[0]} 00:00:00`;

  let offset = 0;
  let hasMore = true;
  let synced = 0;
  let errors = 0;
  let totalFetched = 0;
  let latestUpdate: string | undefined;
  const customerMap = new Map<string, { id: number; billing: NonNullable<DecoRawOrder["billing_details"]> }>();

  // Process each batch inline — keeps memory low and saves progress as we go
  while (hasMore && offset < limit) {
    const batchLimit = Math.min(BATCH_SIZE, limit - offset);

    let data: { total?: number; orders?: DecoRawOrder[] };
    const fetchParams: Record<string, string> = {
      limit: String(batchLimit),
      offset: String(offset),
      field: "1",
      condition: "4",
      date1: dateFilter,
    };
    if (options?.includeWorkflow !== false) {
      fetchParams.include_workflow_data = "1";
    }
    try {
      data = await decoFetch<{ total?: number; orders?: DecoRawOrder[] }>(
        "/api/json/manage_orders/find",
        fetchParams,
      );
    } catch (err) {
      logger.error({ offset, err }, "Deco order fetch failed mid-pagination, saving progress");
      break;
    }

    const batch = data.orders ?? [];
    totalFetched += batch.length;
    logger.info({ offset, batchSize: batch.length, totalFetched, decoTotal: data.total }, "Deco order batch fetched");

    // Build idempotency keys for the entire batch, then batch-check DB
    const batchEntries = batch.map(rawOrder => {
      const order = normaliseOrder(rawOrder);
      return { rawOrder, order, key: `deco:order:${order.id}:${order.dateUpdated ?? order.dateOrdered ?? Date.now()}` };
    }).filter(e => e.order.id !== 0);

    const existingEvents = await prisma.eventInbox.findMany({
      where: { idempotencyKey: { in: batchEntries.map(e => e.key) } },
      select: { idempotencyKey: true },
    });
    const existingKeys = new Set(existingEvents.map(e => e.idempotencyKey));

    // Only create events for genuinely new/updated orders
    for (const { rawOrder, order, key } of batchEntries) {
      try {
        // Collect customer data regardless of event dedup
        const customerId = rawOrder.customer_id ?? rawOrder.billing_details?.user_id;
        if (customerId && rawOrder.billing_details && !customerMap.has(String(customerId))) {
          customerMap.set(String(customerId), { id: customerId, billing: rawOrder.billing_details });
        }

        if (order.dateUpdated && (!latestUpdate || order.dateUpdated > latestUpdate)) {
          latestUpdate = order.dateUpdated;
        }

        if (existingKeys.has(key)) {
          synced++; // Already exists, skip creation
          continue;
        }

        await createInboxEvent({
          provider: EventProvider.DECO,
          topic: "orders/sync",
          externalId: String(order.id),
          idempotencyKey: key,
          payload: rawOrder as unknown as Prisma.InputJsonValue,
        });

        synced++;
      } catch (error) {
        errors++;
        logger.warn({ decoOrderId: rawOrder.order_id, err: error }, "Failed to queue Deco order sync event");
      }
    }

    // Save cursor after each batch so progress isn't lost
    if (latestUpdate) {
      await prisma.syncCursor.upsert({
        where: { provider: "deco:orders" },
        update: { cursor: latestUpdate, updatedAt: new Date() },
        create: { provider: "deco:orders", cursor: latestUpdate },
      });
    }

    if (batch.length < batchLimit || totalFetched >= (data.total ?? 0)) {
      hasMore = false;
    } else {
      offset += batch.length;
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
    logger.info({ customersExtracted }, "Extracted customers from order sync");
  }

  logger.info({ synced, errors, total: totalFetched, customersExtracted }, "Deco order sync complete");
  return { provider: "deco", operation: "orders", synced, errors, total: totalFetched };
}

/**
 * Fetch products from DecoNetwork using /api/json/manage_products/find
 * Persists to DecoProduct table.
 * Uses condition=2 (name NOT contains nonsense string) to return all products,
 * with offset-based pagination.
 */
export async function syncDecoProducts(): Promise<DecoSyncResult> {
  if (!isDecoConfigured()) {
    throw new Error("DecoNetwork is not configured.");
  }

  const PAGE_SIZE = 100;
  let offset = 0;
  let synced = 0;
  let errors = 0;
  let totalFetched = 0;

  while (true) {
    const data = await decoFetch<{ total?: number; products?: DecoRawProduct[] }>(
      "/api/json/manage_products/find",
      {
        limit: String(PAGE_SIZE),
        offset: String(offset),
        field: "1",
        condition: "2",
        string: "ZZZZNOTEXIST",
      },
    );

    const products = data.products ?? [];
    if (products.length === 0) break;

    totalFetched += products.length;

    for (const product of products) {
      try {
        const decoProductId = String(product.product_id ?? "");
        if (!decoProductId) continue;

        const sku = product.product_code ?? product.sku ?? null;
        const category = product.categories?.[0]?.name ?? product.category ?? null;
        const isActive = product.is_active ?? product.active ?? true;

        await prisma.decoProduct.upsert({
          where: { decoProductId },
          update: {
            name: product.product_name ?? "Unknown",
            sku,
            category,
            price: product.price ?? null,
            sizes: product.sizes ?? null,
            colors: product.colors ?? null,
            active: isActive,
            lastSyncedAt: new Date(),
          },
          create: {
            decoProductId,
            name: product.product_name ?? "Unknown",
            sku,
            category,
            price: product.price ?? null,
            sizes: product.sizes ?? null,
            colors: product.colors ?? null,
            active: isActive,
          },
        });

        synced++;
      } catch (error) {
        errors++;
        logger.warn({ productId: product.product_id, err: error }, "Failed to process Deco product");
      }
    }

    logger.info({ offset, fetched: products.length, synced }, "Deco product sync page");

    if (products.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  await prisma.syncCursor.upsert({
    where: { provider: "deco:products" },
    update: { cursor: new Date().toISOString(), updatedAt: new Date() },
    create: { provider: "deco:products", cursor: new Date().toISOString() },
  });

  logger.info({ synced, errors, total: totalFetched }, "Deco product sync complete");
  return { provider: "deco", operation: "products", synced, errors, total: totalFetched };
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
  _debug?: Record<string, unknown>;
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
        new_status: status,
      },
    );

    return { updated: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ decoOrderId, status, err: error }, "Failed to update Deco order status");
    return { updated: false, error: message };
  }
}

/**
 * Extract the dnCSRFToken and session client_id from a Deco admin page.
 */
async function getDecoSessionContext(cookies: string): Promise<{ csrfToken: string; clientId: string }> {
  const base = baseUrl();
  // /manage/orders always 301-redirects to /bh/orders — must follow redirects
  const res = await fetch(`${base}/manage/orders`, {
    headers: { Cookie: cookies },
    redirect: "follow",
  });

  const html = await res.text();

  // Extract CSRF token — its presence confirms we have a valid session
  const csrfMatch = html.match(/var\s+dnCSRFToken\s*=\s*"([^"]+)"/);
  if (!csrfMatch) {
    throw new Error("Deco session expired — no CSRF token found on orders page");
  }
  const cidMatch = html.match(/"client_id"\s*:\s*(\d+)/);
  const clientId = cidMatch ? cidMatch[1] : "0";
  return { csrfToken: csrfMatch[1], clientId };
}

/**
 * Poll Deco's async progress endpoint until the save completes.
 * Returns the Deco job number if found, or throws on failure.
 */
async function pollDecoSaveProgress(cookies: string, progressKey: string): Promise<string | undefined> {
  const base = baseUrl();
  const maxAttempts = 15;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const ts = Date.now();
    const res = await fetch(
      `${base}/shared/lookups/async_progress?key=${encodeURIComponent(progressKey)}&ts=${ts}&qt=false`,
      { headers: { Cookie: cookies } },
    );
    const text = await res.text();

    // Response format: updateAsyncProgress("message", percent, isDone, ...)
    const progressMatch = text.match(/updateAsyncProgress\("([^"]*)",\s*([\d.]+)/);
    if (!progressMatch) continue;

    const message = progressMatch[1];
    const percent = parseFloat(progressMatch[2]);

    if (message.toLowerCase().includes("error")) {
      throw new Error(`Deco save failed: ${message}`);
    }

    if (percent >= 100) {
      // Extract job number from "Saved order 224670"
      const jobMatch = message.match(/Saved order (\d+)/i);
      logger.info({ progressKey, message }, "Deco save completed");
      return jobMatch ? jobMatch[1] : undefined;
    }
  }

  logger.warn({ progressKey }, "Deco save progress polling timed out");
  return undefined;
}

/**
 * Extract color from a variant title like "Arctic White (XS×1)" → "Arctic White"
 * or "Navy / XL" → "Navy"
 */
function extractColorFromVariant(variant: string): string {
  // Format: "Color (Size×Qty)" or "Color / Size"
  const parenMatch = variant.match(/^(.+?)\s*\(/);
  if (parenMatch) return parenMatch[1].trim();
  const slashMatch = variant.match(/^(.+?)\s*\//);
  if (slashMatch) return slashMatch[1].trim();
  return variant.trim();
}

/**
 * Extract size from a variant title like "Arctic White (XS×1)" → "XS"
 * or "Navy / XL" → "XL"
 */
function extractSizeFromVariant(variant: string): string {
  // Format: "Color (Size×Qty)"
  const parenMatch = variant.match(/\(([^×)]+)/);
  if (parenMatch) return parenMatch[1].trim();
  // Format: "Color / Size"
  const slashMatch = variant.match(/\/\s*(.+)/);
  if (slashMatch) return slashMatch[1].trim();
  return "";
}

/**
 * Build a query string the same way Deco's client-side JS does:
 * encodeURIComponent(key) + "=" + encodeURIComponent(value), joined by "&".
 */
function buildDecoFormBody(pairs: Array<[string, string]>): string {
  return pairs
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
    .join("&");
}

/**
 * Search for a Deco product by SKU/product code.
 * Returns the Deco product ID if found, or null.
 */
export async function findDecoProductBySku(sku: string): Promise<string | null> {
  if (!sku) return null;
  try {
    const data = await decoFetch<{ products?: Array<{ product_id?: number; product_code?: string }> }>(
      "/api/json/manage_products/find",
      { limit: "10", offset: "0", field: "2", condition: "1", string: sku },
    );
    const match = data.products?.find(
      (p) => p.product_code?.toLowerCase() === sku.toLowerCase(),
    );
    return match?.product_id ? String(match.product_id) : null;
  } catch {
    return null;
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

  const decoCustomerId = job.account?.decoCustomerId;
  if (!decoCustomerId) {
    return { pushed: false, error: "Cannot push to Deco without a linked customer account. Please link a Deco customer first." };
  }

  try {
    // Step 1: Get authenticated web session + CSRF token
    // Force a fresh login to avoid stale cached sessions
    decoWebCookies = null;
    decoWebCookieExpiry = 0;

    const cookies = await getDecoWebSession();
    if (!cookies) {
      throw new Error("Failed to establish Deco web session");
    }
    const { csrfToken, clientId } = await getDecoSessionContext(cookies);
    const base = baseUrl();

    const webHeaders: Record<string, string> = {
      Cookie: cookies,
      "X-CSRF-Token": csrfToken,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${base}/manage/orders`,
    };

    // Step 2: Create an order in Deco via the web admin endpoint
    const createBody = buildDecoFormBody([["cust_id", decoCustomerId]]);
    const createRes = await fetch(`${base}/bh/orders/create_order`, {
      method: "POST",
      headers: webHeaders,
      body: createBody,
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`create_order failed (${createRes.status}): ${text.slice(0, 200)}`);
    }

    const createData = (await createRes.json()) as { id?: number };
    if (!createData.id) {
      throw new Error("create_order returned no order ID");
    }

    const decoOrderId = String(createData.id);
    // eslint-disable-next-line no-console
    console.log(`[DECO-PUSH] Created order cart ${decoOrderId}`);

    // Step 3: Build the save_order body — use manual encoding matching Deco's client-side JS
    const DECO_BRAND_ID = "12015397";
    const CP_FREE_FORM = 21;

    const bodyPairs: Array<[string, string]> = [
      ["dt[jn]", job.internalJobId ?? `Job-${jobId.slice(0, 8)}`],
      ["dt[po]", job.shopifyOrderName ?? job.internalJobId ?? ""],
      ["dt[brid]", DECO_BRAND_ID],
      ["dt[ot]", "3"], // order_type=3 required for the order to be visible in the API
      ["ct[u]", decoCustomerId],
    ];

    // Build line items — try Deco catalog lookup first, fall back to CP_FREE_FORM
    for (let i = 0; i < job.items.length; i++) {
      const item = job.items[i];
      const pos = String(i + 1);
      const prefix = `it[li][${pos}]`;
      const qty = String(item.quantity);
      const price = item.unitPriceMinor != null
        ? (item.unitPriceMinor / 100).toFixed(2)
        : "0.00";

      // Try to find this product in Deco's catalog for proper catalog format
      let usedCatalog = false;
      if (item.sku) {
        const decoProductId = await findDecoProductBySku(item.sku);
        if (decoProductId) {
          try {
            const detail = await fetchDecoProductDetail(decoProductId);
            // Find matching color
            const colorName = extractColorFromVariant(item.variantTitle ?? "");
            const matchedColor = detail.colors.find(
              (c) => c.name.toLowerCase() === colorName.toLowerCase(),
            );
            const colorId = matchedColor ? String(matchedColor.id) : (detail.colors[0] ? String(detail.colors[0].id) : "0");

            // Find matching size
            const sizeName = extractSizeFromVariant(item.variantTitle ?? "");
            const matchedSize = detail.sizes.find(
              (s) => s.name.toLowerCase() === sizeName.toLowerCase() || s.code.toLowerCase() === sizeName.toLowerCase(),
            );

            // Build catalog product item (matching Deco's CP_serialize + beforeSerialize)
            // Outer serialize fields
            bodyPairs.push([`${prefix}[t]`, "0"]); // Regular product type
            bodyPairs.push([`${prefix}[cart_id]`, decoOrderId]);
            bodyPairs.push([`${prefix}[dis]`, "0"]);
            bodyPairs.push([`${prefix}[screen_method]`, ""]);
            bodyPairs.push([`${prefix}[iabp]`, "true"]);
            bodyPairs.push([`${prefix}[obp]`, "0"]);
            bodyPairs.push([`${prefix}[tl]`, "false"]);
            bodyPairs.push([`${prefix}[upl]`, "false"]);
            bodyPairs.push([`${prefix}[iasp]`, "true"]);
            if (matchedSize) {
              // Set specific size qty via size field
              bodyPairs.push([`${prefix}[ussq]`, "0"]);
            } else {
              bodyPairs.push([`${prefix}[ussq]`, qty]);
            }
            bodyPairs.push([`${prefix}[iad]`, "true"]);
            bodyPairs.push([`${prefix}[dt]`, "percent"]);
            bodyPairs.push([`${prefix}[bdis]`, "0"]);
            bodyPairs.push([`${prefix}[bdis_base]`, "false"]);
            bodyPairs.push([`${prefix}[bdis_ao]`, "false"]);
            bodyPairs.push([`${prefix}[odis]`, "0"]);
            bodyPairs.push([`${prefix}[inc_tax]`, "false"]);
            bodyPairs.push([`${prefix}[inc_tax_for_extra_charges]`, "false"]);
            bodyPairs.push([`${prefix}[oup]`, "false"]);
            bodyPairs.push([`${prefix}[pos]`, pos]);
            bodyPairs.push([`${prefix}[dto]`, "false"]);
            bodyPairs.push([`${prefix}[odt]`, "0"]);
            bodyPairs.push([`${prefix}[dsp]`, "0"]);
            bodyPairs.push([`${prefix}[o_dsp]`, "false"]);
            bodyPairs.push([`${prefix}[sdc_id]`, ""]);
            bodyPairs.push([`${prefix}[use_po]`, "0"]);

            // beforeSerialize fields
            bodyPairs.push([`${prefix}[custom_name]`, "0"]);
            bodyPairs.push([`${prefix}[brid]`, DECO_BRAND_ID]);
            bodyPairs.push([`${prefix}[clid]`, clientId]);
            bodyPairs.push([`${prefix}[cid]`, decoOrderId]);
            bodyPairs.push([`${prefix}[p]`, decoProductId]);
            bodyPairs.push([`${prefix}[q]`, qty]);
            bodyPairs.push([`${prefix}[lv]`, "0"]);
            bodyPairs.push([`${prefix}[c]`, colorId]);
            bodyPairs.push([`${prefix}[def_proc]`, "0"]);
            bodyPairs.push([`${prefix}[screen_method]`, ""]);
            bodyPairs.push([`${prefix}[is_sdp]`, "false"]);

            // If we have a specific size match, set it via the size field
            if (matchedSize) {
              // Size fields use the product's fields structure — we set qty per size
              bodyPairs.push([`${prefix}[f][size][q][${matchedSize.id}]`, qty]);
            }

            usedCatalog = true;
            // eslint-disable-next-line no-console
            console.log(`[DECO-PUSH] Item ${pos}: catalog product ${decoProductId} (${detail.productCode}), color=${colorId}, size=${matchedSize?.name ?? "unspecified"}`);
          } catch (err) {
            logger.warn({ err, sku: item.sku }, "Catalog product lookup failed, falling back to free-form");
          }
        }
      }

      // Fallback: CP_FREE_FORM
      if (!usedCatalog) {
        // Use SKU as name so Deco can match the catalog product
        const name = item.sku || item.productTitle;
        const desc = item.productTitle;
        const color = extractColorFromVariant(item.variantTitle ?? "");
        const size = extractSizeFromVariant(item.variantTitle ?? "");
        const decoMethod = item.decorationMethod ?? "";

        bodyPairs.push([`${prefix}[t]`, String(CP_FREE_FORM)]);
        bodyPairs.push([`${prefix}[cart_id]`, decoOrderId]);
        bodyPairs.push([`${prefix}[name]`, name]);
        bodyPairs.push([`${prefix}[desc]`, desc]);
        bodyPairs.push([`${prefix}[color]`, color]);
        bodyPairs.push([`${prefix}[size]`, size]);
        bodyPairs.push([`${prefix}[q]`, qty]);
        bodyPairs.push([`${prefix}[dis]`, "0"]);
        bodyPairs.push([`${prefix}[iad]`, "true"]);
        bodyPairs.push([`${prefix}[dt]`, "percent"]);
        bodyPairs.push([`${prefix}[bdis]`, "0"]);
        bodyPairs.push([`${prefix}[odis]`, "0"]);
        bodyPairs.push([`${prefix}[rrp]`, price]);
        bodyPairs.push([`${prefix}[rp]`, price]);
        bodyPairs.push([`${prefix}[op]`, price]);
        bodyPairs.push([`${prefix}[iap]`, "false"]);
        bodyPairs.push([`${prefix}[eid]`, ""]);
        bodyPairs.push([`${prefix}[use_po]`, "0"]);
        bodyPairs.push([`${prefix}[inc_tax]`, "false"]);
        bodyPairs.push([`${prefix}[pos]`, pos]);
        if (decoMethod) {
          bodyPairs.push([`${prefix}[screen_method]`, decoMethod]);
        }

        // eslint-disable-next-line no-console
        console.log(`[DECO-PUSH] Item ${pos}: free-form "${name}" qty=${qty} price=${price} method=${decoMethod}`);
      }
    }

    const saveBodyStr = buildDecoFormBody(bodyPairs);
    const saveQueryStr = buildDecoFormBody([["c", decoOrderId], ["cid", clientId]]);

    const _debug: Record<string, unknown> = {
      itemCount: job.items.length,
      pairCount: bodyPairs.length,
      bodyLength: saveBodyStr.length,
      bodyFirst500: saveBodyStr.slice(0, 500),
      bodyLast200: saveBodyStr.slice(-200),
      queryString: saveQueryStr,
      itemKeys: bodyPairs.filter(([k]) => k.startsWith("it[")).map(([k, v]) => `${k}=${v}`),
    };

    logger.info(
      { decoOrderId, lineItemCount: job.items.length, pairCount: bodyPairs.length, bodyLength: saveBodyStr.length },
      "Sending save_order with line items",
    );

    const saveRes = await fetch(
      `${base}/bh/orders/save_order?${saveQueryStr}`,
      {
        method: "POST",
        headers: { ...webHeaders, "X-Progress-ID": decoOrderId },
        body: saveBodyStr,
      },
    );

    const saveText = await saveRes.text();
    _debug.saveStatus = saveRes.status;
    _debug.saveResponse = saveText.slice(0, 500);

    // Step 4: Poll async progress to confirm save succeeded
    const progressMatch = saveText.match(/continueAsyncProgress\('([^']+)'/);
    let decoJobNumber: string | undefined;

    if (progressMatch) {
      const progressKey = progressMatch[1];
      decoJobNumber = await pollDecoSaveProgress(cookies, progressKey);
    } else if (!saveRes.ok) {
      logger.warn({ decoOrderId, status: saveRes.status, body: saveText.slice(0, 300) }, "save_order failed");
      throw new Error(`save_order failed (${saveRes.status})`);
    }

    // Step 4b: Activate the order via the JSON API so it becomes visible
    if (decoJobNumber) {
      try {
        await decoFetch<unknown>(
          "/api/json/manage_orders/update_order_status",
          { order_id: decoJobNumber, new_status: "pending" },
        );
        logger.info({ decoJobNumber }, "Deco order status set to pending");
      } catch (statusErr) {
        logger.warn({ decoJobNumber, error: statusErr }, "Failed to set Deco order status to pending");
      }
    }

    // Step 5: Add internal note with line item details
    if (job.items.length > 0) {
      try {
        const lines = job.items.map((item) => {
          const qty = item.quantity;
          const title = item.productTitle + (item.variantTitle ? ` - ${item.variantTitle}` : "");
          const method = item.decorationMethod ? ` (${item.decorationMethod})` : "";
          const price = item.unitPriceMinor != null ? ` @ £${(item.unitPriceMinor / 100).toFixed(2)}` : "";
          const total = item.totalPriceMinor != null ? ` = £${(item.totalPriceMinor / 100).toFixed(2)}` : "";
          return `- ${qty}x ${title}${method}${price}${total}`;
        });
        const totalMinor = job.totalMinor ?? job.subtotalMinor;
        const totalLine = totalMinor != null ? `\nTotal: £${(totalMinor / 100).toFixed(2)}` : "";
        const noteContent = `Line Items (from Stash):\n${lines.join("\n")}${totalLine}`;

        const noteBody = buildDecoFormBody([
          ["oid", decoOrderId],
          ["cid", clientId],
          ["t", "internal"],
          ["ct", noteContent],
        ]);

        await fetch(`${base}/bh/orders/add_or_edit_note`, {
          method: "POST",
          headers: webHeaders,
          body: noteBody,
        });
      } catch (noteErr) {
        logger.warn({ decoOrderId, error: noteErr }, "Failed to add line items note to Deco order");
      }
    }

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
          metadata: { quoteId: decoOrderId, decoJobNumber },
        },
      });

      await tx.activityLog.create({
        data: {
          jobId,
          eventType: "deco.order.pushed",
          message: decoJobNumber
            ? `Job pushed to Deco (Quote #${decoJobNumber})`
            : `Job pushed to Deco (Cart #${decoOrderId})`,
          payload: { decoOrderId, decoJobNumber } as Prisma.InputJsonValue,
        },
      });
    });

    logger.info({ jobId, decoOrderId, decoJobNumber }, "Job pushed to Deco via web session");
    return { pushed: true, decoOrderId, decoJobNumber: decoJobNumber ?? decoOrderId, _debug };
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

// ── Diagnostic: check what Deco sees for an order ──

export async function inspectDecoOrder(decoOrderId: string): Promise<Record<string, unknown>> {
  if (!isDecoConfigured()) return { error: "Deco not configured" };

  const results: Record<string, unknown> = { decoOrderId };

  // 1. Search via the JSON API — this is the most reliable method
  try {
    // Search by order number (field=2=order_number, condition=1=equals)
    const apiResult = await decoFetch<Record<string, unknown>>(
      "/api/json/manage_orders/find",
      { field: "2", condition: "1", string: decoOrderId, limit: "5" },
    );
    results.apiSearch = {
      total: (apiResult as { total?: number }).total,
      orders: ((apiResult as { orders?: Array<Record<string, unknown>> }).orders ?? []).map((o) => ({
        order_id: o.order_id,
        order_number: o.order_number,
        job_number: o.job_number,
        status: o.status,
        customer_name: o.customer_name ?? (o.billing_details ? (o.billing_details as Record<string, unknown>).name : undefined),
        items: o.items ?? o.line_items ?? o.configured_products,
        item_count: Array.isArray(o.items) ? o.items.length : Array.isArray(o.line_items) ? o.line_items.length : undefined,
        keys: Object.keys(o).slice(0, 30),
      })),
    };
  } catch (err) {
    results.apiSearch = { error: err instanceof Error ? err.message : String(err) };
  }

  // 2. Also search by order_id (field=7=order_id? or just try id-based lookup)
  try {
    const apiById = await decoFetch<Record<string, unknown>>(
      "/api/json/manage_orders/find",
      { field: "7", condition: "1", string: decoOrderId, limit: "5" },
    );
    results.apiSearchById = {
      total: (apiById as { total?: number }).total,
      orderCount: ((apiById as { orders?: unknown[] }).orders ?? []).length,
    };
  } catch (err) {
    results.apiSearchById = { error: err instanceof Error ? err.message : String(err) };
  }

  // 3. Try the get endpoint directly (if it exists)
  try {
    const apiGet = await decoFetch<Record<string, unknown>>(
      "/api/json/manage_orders/get",
      { id: decoOrderId },
    );
    const keys = Object.keys(apiGet);
    results.apiGet = {
      keys: keys.slice(0, 20),
      hasItems: "items" in apiGet || "line_items" in apiGet || "configured_products" in apiGet,
      preview: JSON.stringify(apiGet).slice(0, 500),
    };
  } catch (err) {
    results.apiGet = { error: err instanceof Error ? err.message : String(err) };
  }

  // 4. Search by job name (field=3=job_name, condition=3=contains)
  try {
    const nameSearch = await decoFetch<{ total?: number; orders?: Array<Record<string, unknown>> }>(
      "/api/json/manage_orders/find",
      { field: "3", condition: "3", string: decoOrderId, limit: "5" },
    );
    results.nameSearch = {
      total: (nameSearch as { total?: number }).total,
      orders: ((nameSearch as { orders?: Array<Record<string, unknown>> }).orders ?? []).map((o) => ({
        order_id: o.order_id,
        job_name: o.job_name,
      })),
    };
  } catch (err) {
    results.nameSearch = { error: err instanceof Error ? err.message : String(err) };
  }

  // 5. Get all recent orders (bigger limit) with full order_lines for target
  try {
    const recent = await decoFetch<{ total?: number; orders?: Array<Record<string, unknown>> }>(
      "/api/json/manage_orders/find",
      { limit: "50", offset: "0", field: "1", condition: "4", date1: "2026-03-20 00:00:00" },
    );
    const targetOrder = (recent.orders ?? []).find((o) => String(o.order_id) === decoOrderId);
    if (targetOrder) {
      results.targetOrder = {
        order_id: targetOrder.order_id,
        job_name: targetOrder.job_name,
        item_amount: targetOrder.item_amount,
        order_status: targetOrder.order_status,
        source_type: targetOrder.source_type,
        order_lines: targetOrder.order_lines,
        notes: targetOrder.notes,
      };
    } else {
      results.targetOrder = { found: false, searched: decoOrderId, totalInPeriod: recent.total };
    }
    // Summary of all recent orders
    results.allRecentOrders = {
      total: recent.total,
      orders: (recent.orders ?? []).map((o) => ({
        order_id: o.order_id,
        job_name: o.job_name,
        item_amount: o.item_amount,
        order_lines_count: Array.isArray(o.order_lines) ? o.order_lines.length : 0,
      })),
    };
  } catch (err) {
    results.recentOrders = { error: err instanceof Error ? err.message : String(err) };
  }

  return results;
}

/**
 * Probe Deco web admin endpoints for order/item creation.
 * Tests various AJAX endpoints used by the Deco admin interface.
 */
export async function probeDecoOrderApi(): Promise<Record<string, unknown>> {
  if (!isDecoConfigured()) return { error: "Deco not configured" };

  const results: Record<string, unknown> = {};

  // Get an authenticated web session
  try {
    decoWebCookies = null;
    decoWebCookieExpiry = 0;
    const cookies = await getDecoWebSession();
    if (!cookies) {
      return { error: "Failed to get web session" };
    }
    const { csrfToken, clientId } = await getDecoSessionContext(cookies);
    const base = baseUrl();
    results.session = { csrfToken: csrfToken.slice(0, 20) + "...", clientId };

    const webHeaders: Record<string, string> = {
      Cookie: cookies,
      "X-CSRF-Token": csrfToken,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${base}/manage/orders`,
    };

    // Step 1: Create a test quote — try both create_quote and create_order
    let testCartId: string | undefined;
    let createMethod = "unknown";

    // Try create_order first (creates an actual order, not just a quote)
    const createOrderBody = buildDecoFormBody([["cust_id", "80029646"]]);
    const createOrderRes = await fetch(`${base}/bh/orders/create_order`, {
      method: "POST",
      headers: webHeaders,
      body: createOrderBody,
    });
    const createOrderText = await createOrderRes.text();
    try {
      const createData = JSON.parse(createOrderText) as { id?: number };
      if (createData.id) {
        testCartId = String(createData.id);
        createMethod = "create_order";
      }
    } catch {
      // not JSON
    }

    results.createOrder = {
      status: createOrderRes.status,
      response: createOrderText.slice(0, 300),
      cartId: testCartId,
    };

    // Fall back to create_quote
    if (!testCartId) {
      const createBody = buildDecoFormBody([["cust_id", "80029646"]]);
      const createRes = await fetch(`${base}/bh/orders/create_quote`, {
        method: "POST",
        headers: webHeaders,
        body: createBody,
      });
      const createText = await createRes.text();
      try {
        const createData = JSON.parse(createText) as { id?: number };
        testCartId = createData.id ? String(createData.id) : undefined;
        createMethod = "create_quote";
      } catch {
        // not JSON
      }
      results.createQuote = {
        status: createRes.status,
        response: createText.slice(0, 300),
        cartId: testCartId,
      };
    }

    results.createMethod = createMethod;

    if (!testCartId) {
      return results;
    }

    // Step 2: Save with ONE free-form line item
    const CP_FREE_FORM = 21;
    const bodyPairs: Array<[string, string]> = [
      ["dt[jn]", "API-TEST-WITH-ITEM"],
      ["dt[po]", "TEST-PO-001"],
      ["dt[brid]", "12015397"],
      ["dt[ot]", "3"], // order_type=3 (all visible orders have this)
      ["ct[u]", "80029646"],
      // One free-form line item
      ["it[li][1][t]", String(CP_FREE_FORM)],
      ["it[li][1][cart_id]", testCartId!],
      ["it[li][1][name]", "Test Product"],
      ["it[li][1][desc]", "Test Description"],
      ["it[li][1][color]", "Black"],
      ["it[li][1][size]", "XL"],
      ["it[li][1][q]", "2"],
      ["it[li][1][dis]", "0"],
      ["it[li][1][iad]", "true"],
      ["it[li][1][dt]", "percent"],
      ["it[li][1][bdis]", "0"],
      ["it[li][1][odis]", "0"],
      ["it[li][1][rrp]", "25.00"],
      ["it[li][1][rp]", "25.00"],
      ["it[li][1][op]", "25.00"],
      ["it[li][1][iap]", "false"],
      ["it[li][1][eid]", ""],
      ["it[li][1][use_po]", "0"],
      ["it[li][1][inc_tax]", "false"],
      ["it[li][1][pos]", "1"],
    ];

    const saveBodyStr = buildDecoFormBody(bodyPairs);
    const saveQueryStr = buildDecoFormBody([["c", testCartId!], ["cid", clientId]]);

    const saveRes = await fetch(
      `${base}/bh/orders/save_order?${saveQueryStr}`,
      {
        method: "POST",
        headers: { ...webHeaders, "X-Progress-ID": testCartId! },
        body: saveBodyStr,
      },
    );
    const saveText = await saveRes.text();

    // Poll progress
    const progressMatch = saveText.match(/continueAsyncProgress\('([^']+)'/);
    let progressMessages: string[] = [];
    let finalOrderNumber: string | undefined;

    if (progressMatch) {
      const progressKey = progressMatch[1];
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const ts = Date.now();
        const pRes = await fetch(
          `${base}/shared/lookups/async_progress?key=${encodeURIComponent(progressKey)}&ts=${ts}&qt=false`,
          { headers: { Cookie: cookies } },
        );
        const pText = await pRes.text();
        progressMessages.push(pText.slice(0, 200));

        const pMatch = pText.match(/updateAsyncProgress\("([^"]*)",\s*([\d.]+)/);
        if (pMatch) {
          const msg = pMatch[1];
          const pct = parseFloat(pMatch[2]);
          if (pct >= 100) {
            const numMatch = msg.match(/(\d+)/);
            finalOrderNumber = numMatch ? numMatch[1] : undefined;
            break;
          }
          if (msg.toLowerCase().includes("error")) {
            break;
          }
        }
      }
    }

    results.save = {
      status: saveRes.status,
      response: saveText.slice(0, 500),
      bodyLength: saveBodyStr.length,
      bodyPreview: saveBodyStr.slice(0, 300),
      hasProgress: !!progressMatch,
      progressMessages,
      finalOrderNumber,
    };

    // Step 3: Try to convert the quote to an order
    if (finalOrderNumber) {
      // 3a: Try update_order_status to different statuses
      const statusTests: Record<string, unknown> = {};
      
      // Try to place the order (status=8 seems to be "active" based on existing orders)
      // First, try with the web admin's "place_order" endpoint
      try {
        const placeBody = buildDecoFormBody([
          ["id", testCartId!],
          ["order_id", finalOrderNumber],
        ]);
        const placeRes = await fetch(`${base}/bh/orders/place_order`, {
          method: "POST",
          headers: webHeaders,
          body: placeBody,
        });
        const placeText = await placeRes.text();
        statusTests.placeOrder = {
          status: placeRes.status,
          response: placeText.slice(0, 500),
        };
      } catch (err) {
        statusTests.placeOrder = { error: err instanceof Error ? err.message : String(err) };
      }

      // Try update_order_status via JSON API to make it a real order
      // Try "pending" first (most likely initial status for quotes being placed)
      for (const sv of ["pending", "active", "placed"]) {
        try {
          const updateResult = await decoFetch<Record<string, unknown>>(
            "/api/json/manage_orders/update_order_status",
            { order_id: finalOrderNumber, new_status: sv },
          );
          const response = JSON.stringify(updateResult).slice(0, 500);
          statusTests[`updateStatus_${sv}`] = { response, success: true };
          break; // Stop on first success
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          statusTests[`updateStatus_${sv}`] = { error: errMsg };
        }
      }

      // Now try "active" status too
      try {
        const updateResult = await decoFetch<Record<string, unknown>>(
          "/api/json/manage_orders/update_order_status",
          { order_id: finalOrderNumber, new_status: "active" },
        );
        statusTests.updateToActive = {
          response: JSON.stringify(updateResult).slice(0, 500),
          success: true,
        };
      } catch (err) {
        statusTests.updateToActive = { error: err instanceof Error ? err.message : String(err) };
      }

      // Wait 5 seconds for Deco to propagate
      await new Promise((r) => setTimeout(r, 5000));

      // Now check with broader search
      try {
        const checkRecent = await decoFetch<{ total?: number; orders?: Array<Record<string, unknown>> }>(
          "/api/json/manage_orders/find",
          { limit: "50", offset: "0", field: "1", condition: "4", date1: "2026-03-01 00:00:00" },
        );
        const found = (checkRecent.orders ?? []).find(
          (o) => String(o.order_id) === finalOrderNumber,
        );
        statusTests.broadSearch = {
          found: !!found,
          total: checkRecent.total,
          allIds: (checkRecent.orders ?? []).map((o) => o.order_id),
          foundData: found ? {
            order_id: found.order_id,
            job_name: found.job_name,
            item_amount: found.item_amount,
            order_status: found.order_status,
            order_type: found.order_type,
            source_type: found.source_type,
            order_lines: found.order_lines,
          } : null,
        };
      } catch (err) {
        statusTests.afterPlaceOrderSearch = { error: err instanceof Error ? err.message : String(err) };
      }

      results.orderConversion = statusTests;
    }
  } catch (err) {
    results.error = err instanceof Error ? err.message : String(err);
  }

  return results;
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

// ── Product detail (live API call) ──

export type ProductImage = {
  url: string;
  color?: string;           // colour name if colour-specific
  rgb?: string;             // RGB values from catalog (e.g. "51 51 51")
  type: "front" | "back" | "side" | "gallery";
};

export type DecoProductDetail = {
  productId: number;
  productCode: string;
  productName: string;
  supplier: string;
  brand: string;
  category: string;
  _extraKeys?: string[];
  colors: Array<{ id: number; name: string }>;
  sizes: Array<{ id: number; name: string; code: string }>;
  skus: Array<{
    sizeId: number;
    colorId: number;
    price: number;
    cost: number;
    sku: string;
    dnSkuId: string;
  }>;
  images: ProductImage[];
};

/**
 * Fetch product images from the supplier's website.
 * Supports:
 *   - Ralawise (~3000 products) — search API + page scrape
 *   - PenCarrie (~450 products) — cross-listed on Ralawise
 *   - Uneek Clothing (~600 products) — public API at api.uneekclothing.com
 *   - The Magic Touch — consumables, no standardised imagery (returns [])
 *   - Canterbury / Pentland — searches canterbury.com + Pentland CDN patterns
 *   - Other suppliers — attempts to fetch from DecoNetwork product images
 */
async function fetchSupplierProductImages(
  productCode: string,
  supplier: string,
  decoProductId?: number,
  productName?: string,
  orderSku?: string,
): Promise<ProductImage[]> {
  // Layer 1: Ralawise product catalog (DB-backed, fast, reliable) — fronts with RGB
  let catalogFronts: ProductImage[] = [];
  if (productCode) {
    try {
      const catImages = await catalogImages(productCode);
      if (catImages.length > 0) {
        catalogFronts = catImages;
        logger.debug({ productCode, count: catImages.length }, "[Images] Catalog fronts loaded");
      }
    } catch (err) {
      logger.debug({ err, productCode }, "[Images] Catalog lookup failed");
    }
  }

  // Layer 2: Deco web session + supplier scrapers — may have back/side views
  let otherImages: ProductImage[] = [];

  if (decoProductId) {
    const decoImages = await fetchDecoProductImages(decoProductId);
    if (decoImages.length > 0) otherImages = decoImages;
  }

  // Layer 3: supplier-specific web scrapers (if Deco didn't return much)
  if (otherImages.filter((i) => i.type === "back" || i.type === "side").length === 0) {
    const s = supplier.toLowerCase();
    let scraperImages: ProductImage[] = [];

    if (s.includes("ralawise") || s.includes("pencarrie")) {
      scraperImages = await fetchRalawiseImages(productCode);
    } else if (s.includes("uneek")) {
      scraperImages = await fetchUneekImages(productCode);
    } else if (s.includes("canterbury") || s.includes("pentland") || s.includes("cottonridge")) {
      const nameCodeMatch = productName?.match(/^([A-Z0-9]{2,}[A-Z0-9]*[K]?)\s*[-–—]/i);
      let brandCode = nameCodeMatch?.[1]?.trim();
      if (!brandCode && orderSku) {
        const skuParts = orderSku.split(/[-\s]+/).filter((p) => p.length >= 2);
        for (const part of skuParts) {
          if (part.match(/^[A-Z]\d+[A-Z]?$/i)) {
            brandCode = part;
            break;
          }
        }
        if (!brandCode) {
          for (const part of skuParts) {
            if (part.length >= 2 && part.length <= 10) {
              brandCode = part;
              break;
            }
          }
        }
      }
      if (brandCode) {
        scraperImages = await fetchCottonridgeImages(brandCode);
        if (scraperImages.length === 0) scraperImages = await fetchRalawiseImages(brandCode);
      }
      if (scraperImages.length === 0) scraperImages = await fetchCanterburyImages(productCode, productName);
    }

    // Merge scraper back/side images into otherImages
    for (const img of scraperImages) {
      if (img.type === "back" || img.type === "side") {
        otherImages.push(img);
      }
    }
    // If we have no catalog fronts, use scraper fronts too
    if (catalogFronts.length === 0) {
      for (const img of scraperImages) {
        if (img.type === "front" || img.type === "gallery") {
          otherImages.push(img);
        }
      }
    }
  }

  // Merge: catalog fronts (with RGB) take priority, then other sources for back/side/gallery
  if (catalogFronts.length > 0) {
    const seenUrls = new Set(catalogFronts.map((i) => i.url));
    for (const img of otherImages) {
      if (!seenUrls.has(img.url)) {
        seenUrls.add(img.url);
        catalogFronts.push(img);
      }
    }
    return catalogFronts;
  }

  return otherImages;
}

// ── Deco Web Session (channel manager) ──
// The DecoNetwork JSON API has no image endpoints, but the admin web UI
// at /manage/supplier_products/edit/{id} contains product image URLs.
// We maintain a cached web session to scrape these URLs.
// The image files themselves are publicly accessible once you know the URL.

let decoWebCookies: string | null = null;
let decoWebCookieExpiry = 0;

/** Log in to the Deco admin web UI and cache session cookies. */
async function getDecoWebSession(): Promise<string | null> {
  if (decoWebCookies && Date.now() < decoWebCookieExpiry) return decoWebCookies;

  if (!isDecoConfigured()) return null;
  const base = baseUrl();

  try {
    // Step 1: GET login page to extract CSRF token and session fields
    const loginPageRes = await fetch(`${base}/user/login`, { redirect: "manual" });
    const setCookies = loginPageRes.headers.getSetCookie?.() ?? [];
    let cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
    const loginHtml = await loginPageRes.text();

    const tokenMatch = loginHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
    const originMatch = loginHtml.match(/name="origin_signature"[^>]*value="([^"]+)"/);
    const sessionIdMatch = loginHtml.match(/name="_pc_session_id"[^>]*value="([^"]+)"/);
    const skeyMatch = loginHtml.match(/name="_pc_skey"[^>]*value="([^"]+)"/);

    if (!tokenMatch || !originMatch || !sessionIdMatch || !skeyMatch) {
      logger.warn("[DecoWeb] Could not find login form fields");
      return null;
    }

    // Step 2: POST login
    const formData = new URLSearchParams({
      authenticity_token: tokenMatch[1],
      origin_signature: originMatch[1],
      _pc_session_id: sessionIdMatch[1],
      _pc_skey: skeyMatch[1],
      "user[login]": env.DECO_USERNAME!,
      "user[password]": env.DECO_PASSWORD!,
    });

    const loginRes = await fetch(`${base}/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies, Referer: `${base}/user/login` },
      body: formData.toString(),
      redirect: "manual",
    });

    // Collect cookies from login response
    const loginSetCookies = loginRes.headers.getSetCookie?.() ?? [];
    const cookieMap = new Map<string, string>();
    for (const c of [...setCookies, ...loginSetCookies]) {
      const [kv] = c.split(";");
      const [k, v] = kv.split("=");
      if (k && v) cookieMap.set(k.trim(), v.trim());
    }
    cookies = [...cookieMap].map(([k, v]) => `${k}=${v}`).join("; ");

    // Follow redirect (may land on replace_existing_session)
    const location = loginRes.headers.get("location");
    if (location) {
      const redirectUrl = location.startsWith("http") ? location : `${base}${location}`;
      const redirectRes = await fetch(redirectUrl, { headers: { Cookie: cookies }, redirect: "manual" });
      const redirectSetCookies = redirectRes.headers.getSetCookie?.() ?? [];
      for (const c of redirectSetCookies) {
        const [kv] = c.split(";");
        const [k, v] = kv.split("=");
        if (k && v) cookieMap.set(k.trim(), v.trim());
      }
      cookies = [...cookieMap].map(([k, v]) => `${k}=${v}`).join("; ");

      const redirectHtml = await redirectRes.text();

      // Handle "replace_existing_session" page
      if (redirectUrl.includes("replace_existing_session") || redirectHtml.includes("replace_existing_session")) {
        const replaceToken = redirectHtml.match(/<form[^>]*action="\/user\/replace_existing_session"[^>]*>(.*?)<\/form>/s);
        if (replaceToken) {
          const inputs = [...replaceToken[1].matchAll(/name="([^"]*)"[^>]*value="([^"]*)"/g)];
          const replaceForm = new URLSearchParams();
          for (const m of inputs) replaceForm.set(m[1], m[2]);

          const replaceRes = await fetch(`${base}/user/replace_existing_session`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies },
            body: replaceForm.toString(),
            redirect: "manual",
          });
          const replaceSetCookies = replaceRes.headers.getSetCookie?.() ?? [];
          for (const c of replaceSetCookies) {
            const [kv] = c.split(";");
            const [k, v] = kv.split("=");
            if (k && v) cookieMap.set(k.trim(), v.trim());
          }
          cookies = [...cookieMap].map(([k, v]) => `${k}=${v}`).join("; ");

          // Follow final redirect
          const finalLoc = replaceRes.headers.get("location");
          if (finalLoc) {
            const finalUrl = finalLoc.startsWith("http") ? finalLoc : `${base}${finalLoc}`;
            const finalRes = await fetch(finalUrl, { headers: { Cookie: cookies }, redirect: "manual" });
            const finalSetCookies = finalRes.headers.getSetCookie?.() ?? [];
            for (const c of finalSetCookies) {
              const [kv] = c.split(";");
              const [k, v] = kv.split("=");
              if (k && v) cookieMap.set(k.trim(), v.trim());
            }
            cookies = [...cookieMap].map(([k, v]) => `${k}=${v}`).join("; ");
            await finalRes.text(); // consume body
          } else {
            await replaceRes.text();
          }
        }
      }
    }

    // Verify login by checking the admin settings page
    const verifyRes = await fetch(`${base}/manage`, { headers: { Cookie: cookies }, redirect: "manual" });
    const verifyHtml = await verifyRes.text();
    if (verifyHtml.includes("Dashboard") && !verifyHtml.includes("Login Private")) {
      logger.info("[DecoWeb] Web session established successfully");
      decoWebCookies = cookies;
      decoWebCookieExpiry = Date.now() + 55 * 60 * 1000; // 55 minutes
      return cookies;
    }

    logger.warn("[DecoWeb] Login verification failed — dashboard not found");
    return null;
  } catch (err) {
    logger.error({ err }, "[DecoWeb] Web login failed");
    return null;
  }
}

/** Fetch product images from the Deco admin product edit page via web session */
async function fetchDecoProductImages(decoProductId: number): Promise<ProductImage[]> {
  if (!isDecoConfigured()) return [];

  const cookies = await getDecoWebSession();
  if (!cookies) {
    logger.debug(`[DecoWeb] No web session — cannot fetch images for product ${decoProductId}`);
    return [];
  }

  const base = baseUrl();
  try {
    const res = await fetch(`${base}/manage/supplier_products/edit/${decoProductId}`, {
      headers: { Cookie: cookies },
      signal: AbortSignal.timeout(15_000),
    });
    const html = await res.text();

    // If we got redirected to login, invalidate session
    if (html.includes("Login Private") || html.includes("/user/login")) {
      decoWebCookies = null;
      decoWebCookieExpiry = 0;
      logger.debug(`[DecoWeb] Session expired, clearing cache`);
      return [];
    }

    const images: ProductImage[] = [];
    const seen = new Set<string>();

    // 1. Main display image: /supplier_product/s/display_image/{a}/{b}/{c}/filename.jpg
    for (const m of html.matchAll(/\/supplier_product\/s\/display_image\/(\d+)\/(\d+)\/(\d+)\/([^"?\s]+)/g)) {
      const filename = m[4].replace(/-\d+(\.\w+)$/, "$1"); // strip size suffix
      const url = `${base}/supplier_product/s/display_image/${m[1]}/${m[2]}/${m[3]}/${filename}`;
      if (!seen.has(url)) {
        seen.add(url);
        const viewType = classifyFilename(filename);
        images.push({ url, type: viewType });
      }
    }

    // 2. Extra product images: /supplier_product_image/s/image/{a}/{b}/{c}/filename.jpg
    for (const m of html.matchAll(/\/supplier_product_image\/s\/image\/(\d+)\/(\d+)\/(\d+)\/([^"?\s]+)/g)) {
      const filename = m[4].replace(/-\d+(\.\w+)$/, "$1");
      const url = `${base}/supplier_product_image/s/image/${m[1]}/${m[2]}/${m[3]}/${filename}`;
      if (!seen.has(url)) {
        seen.add(url);
        const viewType = classifyFilename(filename);
        images.push({ url, type: viewType });
      }
    }

    // 3. Product view images: /product_view_image/s/image/{a}/{b}/{c}/filename.jpg
    for (const m of html.matchAll(/\/product_view_image\/s\/image\/(\d+)\/(\d+)\/(\d+)\/([^"?\s]+)/g)) {
      const filename = m[4].replace(/-\d+(\.\w+)$/, "$1");
      const url = `${base}/product_view_image/s/image/${m[1]}/${m[2]}/${m[3]}/${filename}`;
      if (!seen.has(url)) {
        seen.add(url);
        const viewType = classifyFilename(filename);
        images.push({ url, type: viewType });
      }
    }

    if (images.length > 0) {
      const typeCounts = images.reduce((acc, i) => { acc[i.type] = (acc[i.type] ?? 0) + 1; return acc; }, {} as Record<string, number>);
      logger.info({ decoProductId, count: images.length, types: typeCounts }, "[DecoWeb] Extracted product images");
    }
    return images;
  } catch (err) {
    logger.debug({ err, decoProductId }, "[DecoWeb] Failed to fetch product edit page");
    return [];
  }
}

/** Classify a product image filename into front/back/side/gallery */
function classifyFilename(filename: string): ProductImage["type"] {
  const lower = filename.toLowerCase();
  if (/\bback\b|_back[_.-]|_back\d|_bk\d?\./i.test(lower)) return "back";
  if (/\bside\b|_side[_.-]|_side\d|_sd\d?\./i.test(lower)) return "side";
  if (/\bfront\b|_front[_.-]|_front\d|_ft\d?\.|_f_/i.test(lower)) return "front";
  return "gallery";
}

/** Ralawise: search API → product page → parse Colours JSON + lifestyle images */
async function fetchRalawiseImages(productCode: string): Promise<ProductImage[]> {
  try {
    const searchRes = await fetch(
      `https://shop.ralawise.com/search?q=${encodeURIComponent(productCode)}`,
      { headers: { "User-Agent": "StashOps/1.0", "Accept": "application/json" }, signal: AbortSignal.timeout(10_000) },
    );
    const searchText = await searchRes.text();
    let pageUrl: string | null = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const searchData = JSON.parse(searchText) as Record<string, any>;

      // Format 1: Direct redirect → { Success: true, Data: "https://..." }
      if (searchData.Success && typeof searchData.Data === "string") {
        pageUrl = searchData.Data;
      }

      // Format 2: Data is an object containing Entries → { Success: true, Data: { Entries: [...] } }
      const entriesSource = Array.isArray(searchData.Entries) ? searchData.Entries
        : (searchData.Data && Array.isArray(searchData.Data.Entries)) ? searchData.Data.Entries
        : null;
      if (!pageUrl && entriesSource?.length) {
        const exact = entriesSource.find(
          (e: Record<string, unknown>) => typeof e.EntryCode === "string" && e.EntryCode.toUpperCase() === productCode.toUpperCase(),
        );
        const entry = exact ?? entriesSource[0];
        if (typeof entry?.DetailUrl === "string") pageUrl = entry.DetailUrl;
      }
    } catch {
      // Not JSON — might be an HTML search results page
    }

    if (!pageUrl) return [];

    const pageRes = await fetch(pageUrl, {
      headers: { "User-Agent": "StashOps/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    const html = await pageRes.text();

    const images: ProductImage[] = [];
    const codeLower = productCode.toLowerCase();
    const escaped = codeLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const seen = new Set<string>();

    // --- Strategy 1: Parse structured Colours JSON from the page ---
    // Ralawise embeds a JSON array in a Colours attribute with all colour data
    const coloursMatch = html.match(/Colours:\s*'(\[.*?\])'/s);
    if (coloursMatch) {
      try {
        const colourGroups = JSON.parse(coloursMatch[1]) as Array<{
          Colours?: Array<{
            ColourName?: string;
            ImageUrls?: string[];
          }>;
        }>;
        for (const group of colourGroups) {
          for (const colour of group.Colours ?? []) {
            const colorName = (colour.ColourName ?? "").replace(/[*†]+$/g, "").trim();
            for (const url of colour.ImageUrls ?? []) {
              if (!seen.has(url)) {
                seen.add(url);
                images.push({ url, color: colorName, type: "front" });
              }
            }
          }
        }
      } catch {
        // Malformed JSON — fall through to regex strategy
      }
    }

    // --- Strategy 2: Regex fallback for pages without Colours JSON ---
    // Matches both _ft.jpg and _ft2.jpg patterns with alt="ColourName"
    if (images.length === 0) {
      const frontPattern = new RegExp(
        `<img[^>]*src="([^"]*${escaped}[^"]*_ft\\d?\\.jpg(?:\\?[^"]*)?)"[^>]*alt="([^"]*)"`,
        "gi",
      );
      let match;
      while ((match = frontPattern.exec(html)) !== null) {
        const [, rawUrl, alt] = match;
        let url = rawUrl.replace(/\?.*$/, "");
        if (!url.startsWith("http")) url = `https://shop.ralawise.com${url}`;
        const colorName = alt.replace(/[*†]+$/g, "").trim();
        if (!seen.has(url)) {
          seen.add(url);
          images.push({ url, color: colorName, type: "front" });
        }
      }

      // Also try data-image attributes (used on some product pages)
      const dataImgPattern = new RegExp(
        `data-image="([^"]*${escaped}[^"]*_ft\\d?\\.jpg[^"]*)"[^>]*alt="([^"]*)"`,
        "gi",
      );
      while ((match = dataImgPattern.exec(html)) !== null) {
        let url = match[1].replace(/\?.*$/, "");
        if (!url.startsWith("http")) url = `https://shop.ralawise.com${url}`;
        const colorName = match[2].replace(/[*†]+$/g, "").trim();
        if (!seen.has(url)) {
          seen.add(url);
          images.push({ url, color: colorName, type: "front" });
        }
      }
    }

    // --- Lifestyle / generic view images ---
    // ls20=front, ls21=side, ls22=back (no colour info — used as fallbacks)
    const galleryPattern = new RegExp(
      `"([^"]*${escaped}[^"]*_ls(\\d+)[^"]*\\.jpg)"`,
      "gi",
    );
    let match;
    while ((match = galleryPattern.exec(html)) !== null) {
      let url = match[1].replace(/\?.*$/, "");
      const lsNum = match[2];
      if (!url.startsWith("http")) url = `https://shop.ralawise.com${url}`;
      if (!seen.has(url)) {
        seen.add(url);
        let imgType: ProductImage["type"] = "gallery";
        if (lsNum === "20") imgType = "front";
        else if (lsNum === "21") imgType = "side";
        else if (lsNum === "22") imgType = "back";
        images.push({ url, type: imgType });
      }
    }

    // --- Generate back/side image URLs from front images ---
    // Ralawise front images use _ftN.jpg; try _bkN.jpg and _sdN.jpg variants
    // Also try lifestyle back/side: replace _ls20_ with _ls21_ (side) and _ls22_ (back)
    const frontsToProbe = images.filter((i) => i.type === "front" && i.url.includes("ralawise"));
    for (const frontImg of frontsToProbe) {
      // Try back variant: _ft1.jpg → _bk1.jpg, _ft.jpg → _bk.jpg
      const backUrl = frontImg.url.replace(/_ft(\d?)\.jpg/, "_bk$1.jpg");
      if (backUrl !== frontImg.url && !seen.has(backUrl)) {
        // Verify the URL exists with a quick HEAD request
        try {
          const headResp = await fetch(backUrl, { method: "HEAD", signal: AbortSignal.timeout(3_000) });
          if (headResp.ok) {
            seen.add(backUrl);
            images.push({ url: backUrl, color: frontImg.color, type: "back" });
          }
        } catch { /* URL doesn't exist — skip */ }
      }
    }
    // Try lifestyle back/side URLs if we have a ls20 image
    const lifestyleFront = images.find((i) => i.url.includes("_ls20"));
    if (lifestyleFront) {
      const lifestyleVariants: [string, ProductImage["type"]][] = [["_ls21", "side"], ["_ls22", "back"]];
      for (const [suffix, viewType] of lifestyleVariants) {
        const viewUrl = lifestyleFront.url.replace("_ls20", suffix);
        if (!seen.has(viewUrl)) {
          try {
            const headResp = await fetch(viewUrl, { method: "HEAD", signal: AbortSignal.timeout(3_000) });
            if (headResp.ok) {
              seen.add(viewUrl);
              images.push({ url: viewUrl, type: viewType });
            }
          } catch { /* skip */ }
        }
      }
    }

    // Fallback: OG image
    if (images.length === 0) {
      const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
      if (ogMatch) {
        images.push({ url: ogMatch[1], type: "gallery" });
      }
    }

    return images;
  } catch (err) {
    logger.warn({ err, productCode }, "Failed to fetch Ralawise product images");
    return [];
  }
}

/**
 * Uneek Clothing: public API at api.uneekclothing.com/Nav.
 * 1. Scan categories to find the product's internal ID by code
 * 2. Get model photo from category listing (HighResolutionImage)
 * 3. Fetch variant data for colour-specific images
 */
async function fetchUneekImages(productCode: string): Promise<ProductImage[]> {
  const API = "https://api.uneekclothing.com/Nav";
  const CDN = "https://images.uneekclothing.com";
  const headers = {
    "User-Agent": "StashOps/1.0",
    Accept: "application/json",
    Origin: "https://www.uneekclothing.com",
  };

  try {
    // Find product ID by scanning categories (17 categories cover all ~143 products)
    let productId: number | null = null;
    let modelImage: string | null = null;

    for (let catId = 1; catId <= 21; catId++) {
      const res = await fetch(
        `${API}/GetProductsByCategoryId?categoryId=${catId}`,
        { headers, signal: AbortSignal.timeout(8_000) },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        products?: Array<{
          Id?: number;
          Code?: string;
          HighResolutionImage?: string;
          LowResolutionImage?: string;
        }>;
      };
      const found = data.products?.find(
        (p) => p.Code?.toUpperCase() === productCode.toUpperCase(),
      );
      if (found?.Id) {
        productId = found.Id;
        modelImage = found.HighResolutionImage || found.LowResolutionImage || null;
        break;
      }
    }

    if (!productId) return [];

    const images: ProductImage[] = [];

    // Add model/lifestyle image if available
    if (modelImage) {
      images.push({ url: modelImage, type: "gallery" });
    }

    // Fetch variant data for colour-specific images
    const varRes = await fetch(
      `${API}/GetVariantByProductId/${productId}`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (varRes.ok) {
      const varData = (await varRes.json()) as {
        variants?: Array<{
          colour?: { code?: string; description?: string };
          images?: Array<{ url?: string; priority?: number }>;
        }>;
      };

      // Deduplicate by colour code (variants share colours across sizes)
      const seenColours = new Set<string>();
      for (const v of varData.variants ?? []) {
        const cc = v.colour?.code;
        if (!cc || seenColours.has(cc)) continue;
        seenColours.add(cc);

        // Pick the high-res image (priority 1) from variant images
        const hiRes = v.images?.find((i) => i.priority === 1 && i.url);
        if (hiRes?.url) {
          images.push({
            url: hiRes.url,
            color: v.colour?.description ?? cc,
            type: "front",
          });
        } else {
          // Fallback: construct CDN URL from known pattern
          const url = `${CDN}/colour-highres/${productCode.toUpperCase()}-${cc}-H.jpg`;
          images.push({
            url,
            color: v.colour?.description ?? cc,
            type: "front",
          });
        }
      }
    }

    return images;
  } catch (err) {
    logger.warn({ err, productCode }, "Failed to fetch Uneek product images");
    return [];
  }
}

/** Cottonridge: fetch product page from cottonridge.co.uk/product/{code} → CDN images */
async function fetchCottonridgeImages(productCode: string): Promise<ProductImage[]> {
  try {
    const pageUrl = `https://cottonridge.co.uk/product/${encodeURIComponent(productCode)}`;
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": "StashOps/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return [];
    const html = await res.text();

    const images: ProductImage[] = [];
    const seen = new Set<string>();

    // Strategy 1: Flat product images per colour from the CDN
    // Pattern: av2.cottonridge.co.uk/images/ProductImages/.../FlatImages/{Colour}.webp
    const flatPattern = /src="(https:\/\/av2\.cottonridge\.co\.uk\/images\/ProductImages\/[^"]*\/FlatImages\/([^"]+)\.(?:webp|jpg|png))"/gi;
    let m;
    while ((m = flatPattern.exec(html)) !== null) {
      const url = m[1];
      // Extract colour from filename: "BabyPink.webp" → "Baby Pink"
      const colorRaw = m[2];
      const color = colorRaw.replace(/([a-z])([A-Z])/g, "$1 $2");
      if (!seen.has(url)) {
        seen.add(url);
        images.push({ url, color, type: "front" });
      }
    }

    // Strategy 2: Model/lifestyle images from CDN
    // Filenames encode view type: W72_Corn_female_back_7.jpg, W72_Powder-blue_male_side_3.jpg
    const modelPattern = /src="(https:\/\/av2\.cottonridge\.co\.uk\/images\/ProductImages\/[^"]*\/ModelImages\/[^"]+\.(?:webp|jpg|png))"/gi;
    while ((m = modelPattern.exec(html)) !== null) {
      const url = m[1];
      if (!seen.has(url)) {
        seen.add(url);
        // Extract filename for classification
        const filename = url.split("/").pop() ?? "";
        const filenameLower = filename.toLowerCase();

        // Classify view type from filename keywords
        let imgType: ProductImage["type"] = "gallery";
        if (/_back[_.-]|_back\d/i.test(filename)) imgType = "back";
        else if (/_side[_.-]|_side\d/i.test(filename)) imgType = "side";
        else if (/_front[_.-]|_front\d|_front-/i.test(filename)) imgType = "front";
        else if (/_closeup|_detail|_pocket|_phone/i.test(filename)) imgType = "gallery";

        // Extract colour: "W72_Corn_female_back_7.jpg" → "Corn"
        // Pattern: {code}_{Colour}_{gender}_{view}_{n}.{ext}
        const colourMatch = filename.match(/^\w+?[_-]([A-Z][a-z][\w-]*)_(?:female|male|model)/i);
        const color = colourMatch?.[1]?.replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");

        images.push({ url, color, type: imgType });
      }
    }

    // Strategy 3: Feature image
    const featurePattern = /src="(https:\/\/av2\.cottonridge\.co\.uk\/images\/FeatureImages\/[^"]+\.(?:webp|jpg|png))"/gi;
    while ((m = featurePattern.exec(html)) !== null) {
      const url = m[1];
      if (!seen.has(url)) {
        seen.add(url);
        images.push({ url, type: "gallery" });
      }
    }

    if (images.length > 0) {
      logger.info(`[Cottonridge] Found ${images.length} images for product ${productCode}`);
    }
    return images;
  } catch (err) {
    logger.warn({ err, productCode }, "Failed to fetch Cottonridge product images");
    return [];
  }
}

/** Canterbury: search canterbury.com → scrape product page for THG CDN images */
async function fetchCanterburyImages(productCode: string, productName?: string): Promise<ProductImage[]> {
  const headers = { "User-Agent": "StashOps/1.0" };

  // Build search terms: try extracting the real supplier code from the product name
  // e.g. "W72 - Cottonridge Premium Hoodie" → "W72"
  // Also try segments of the custom code: "BHS-Q-A005014200" → ["A005014200", "BHS"]
  const searchTerms: string[] = [];

  // 1. Extract code prefix from product name (e.g. "W72" from "W72 - Cottonridge Premium Hoodie")
  if (productName) {
    const nameCodeMatch = productName.match(/^([A-Z0-9]{2,}[A-Z0-9-]*)\s*[-–—]/i);
    if (nameCodeMatch) searchTerms.push(nameCodeMatch[1].trim());
  }

  // 2. Try longer segments from the custom product code (could contain the real code)
  if (productCode) {
    const parts = productCode.split(/[-\s]+/).filter((p) => p.length >= 3);
    // Prefer longer parts (more likely to be a real product code)
    parts.sort((a, b) => b.length - a.length);
    for (const part of parts) {
      if (!searchTerms.includes(part)) searchTerms.push(part);
    }
  }

  // 3. Fall back to product name keyword search
  if (productName && searchTerms.length === 0) {
    // Extract meaningful product words (skip school/company names)
    const nameWords = productName.replace(/\b(school|junior|senior|boys|girls|kids|adult)\b/gi, "").trim();
    if (nameWords.length > 2) searchTerms.push(nameWords);
  }

  // 4. Last resort: the raw product code
  if (searchTerms.length === 0 && productCode) {
    searchTerms.push(productCode);
  }

  logger.info({ productCode, productName, searchTerms }, "[Canterbury] Image search terms");

  try {
    // Try each search term until we find images
    for (const term of searchTerms) {
    const searchUrl = `https://www.canterbury.com/elysium.search?search=${encodeURIComponent(term)}`;
    const searchRes = await fetch(searchUrl, {
      headers,
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    const searchHtml = await searchRes.text();

    // Find product page links — Canterbury product URLs look like /product-name/12345678.html
    const productLinks: string[] = [];
    const linkPattern = /href="(\/[^"]*\/\d{5,}\.html)"/gi;
    let m;
    while ((m = linkPattern.exec(searchHtml)) !== null) {
      const href = m[1];
      if (!productLinks.includes(href)) productLinks.push(href);
    }

    // If the search redirected directly to a product page, use that
    const finalUrl = searchRes.url;
    if (finalUrl.match(/\/\d{5,}\.html/)) {
      productLinks.unshift(new URL(finalUrl).pathname);
    }

    if (productLinks.length === 0) continue;

    // Fetch the first product page
    const pageUrl = `https://www.canterbury.com${productLinks[0]}`;
    const pageRes = await fetch(pageUrl, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    const html = await pageRes.text();

    const images: ProductImage[] = [];
    const seen = new Set<string>();

    // Strategy 1: Product images from THG CDN (static.thcdn.com)
    // Pattern: src="https://static.thcdn.com/images/v2/productimg/.../{productId}-{variant}.jpg"
    const imgPattern = /src="(https:\/\/static\.thcdn\.com\/images\/v2\/productimg\/[^"]+\.(?:jpg|png|webp)[^"]*)"/gi;
    while ((m = imgPattern.exec(html)) !== null) {
      let url = m[1];
      // Strip query params like ?isWebP=true
      url = url.replace(/\?.*$/, "");
      if (!seen.has(url)) {
        seen.add(url);
        images.push({
          url,
          type: images.length === 0 ? "front" : "gallery",
        });
      }
    }

    // Strategy 2: OG image fallback
    if (images.length === 0) {
      const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
      if (ogMatch) {
        images.push({ url: ogMatch[1].replace(/\?.*$/, ""), type: "front" });
      }
    }

    // Strategy 3: JSON-LD product data
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        try {
          const jsonStr = block.replace(/<\/?script[^>]*>/gi, "");
          const jsonData = JSON.parse(jsonStr) as Record<string, unknown>;
          if (jsonData["@type"] === "Product" && jsonData.image) {
            const imgArr = Array.isArray(jsonData.image) ? jsonData.image : [jsonData.image];
            for (const img of imgArr) {
              const url = (typeof img === "string" ? img : (img as Record<string, unknown>)?.url as string)?.replace(/\?.*$/, "");
              if (url && !seen.has(url)) {
                seen.add(url);
                images.push({ url, type: images.length === 0 ? "front" : "gallery" });
              }
            }
          }
        } catch { /* skip malformed JSON-LD */ }
      }
    }

    if (images.length > 0) return images;
    } // end for-loop over search terms

    return [];
  } catch (err) {
    logger.warn({ err, productCode }, "Failed to fetch Canterbury product images");
    return [];
  }
}

/**
 * Fetch detailed product info (colors, sizes, per-SKU pricing) from Deco API.
 * Calls manage_products/get?id=X — NOT cached, hits Deco live each time.
 */
export async function fetchDecoProductDetail(decoProductId: string, orderSku?: string): Promise<DecoProductDetail> {
  if (!isDecoConfigured()) {
    throw new Error("DecoNetwork is not configured.");
  }

  const data = await decoFetch<{
    product?: {
      product_id?: number;
      product_code?: string;
      product_name?: string;
      supplier?: string;
      brand?: string;
      categories?: Array<{ name?: string }>;
      colors?: Array<{ id?: number; name?: string }>;
      sizes?: Array<{ id?: number; name?: string; code?: string }>;
      skus?: Array<{
        size_id?: number;
        color_id?: number;
        price?: number;
        cost?: number;
        sku?: string;
        dn_sku_id?: string;
      }>;
      [key: string]: unknown;
    };
  }>("/api/json/manage_products/get", { id: decoProductId });

  const p = data.product;
  if (!p) {
    throw new Error(`Product ${decoProductId} not found in DecoNetwork`);
  }

  // Log all top-level keys from the Deco product response for discovery
  const knownKeys = new Set(["product_id", "product_code", "product_name", "supplier", "brand", "categories", "colors", "sizes", "skus"]);
  const extraKeys = Object.keys(p).filter((k) => !knownKeys.has(k));
  if (extraKeys.length > 0) {
    logger.info({ extraKeys, sample: Object.fromEntries(extraKeys.slice(0, 15).map((k) => [k, p[k]])) },
      `[Deco] Product ${decoProductId} has extra fields`);
  }

  // Check for any image-related fields from Deco
  const decoImages: ProductImage[] = [];
  const pAny = p as Record<string, unknown>;
  // Try common Deco image field names
  const imageUrl = pAny.product_image ?? pAny.image_url ?? pAny.thumbnail ?? pAny.image;
  if (typeof imageUrl === "string" && imageUrl) {
    decoImages.push({ url: imageUrl, type: "front" });
  }
  // Try image arrays
  const imageArray = pAny.product_images ?? pAny.images ?? pAny.gallery;
  if (Array.isArray(imageArray)) {
    for (const img of imageArray) {
      if (typeof img === "string" && img) {
        decoImages.push({ url: img, type: "gallery" });
      } else if (typeof img === "object" && img && typeof (img as Record<string, unknown>).url === "string") {
        decoImages.push({ url: (img as Record<string, unknown>).url as string, type: "gallery" });
      }
    }
  }

  // Fetch supplier images in parallel (non-blocking — empty array on failure)
  const supplierImages = await fetchSupplierProductImages(
    p.product_code ?? "",
    p.supplier ?? "",
    p.product_id,
    p.product_name ?? "",
    orderSku,
  );

  // Use supplier images if available, otherwise fall back to any Deco-provided images
  const images = supplierImages.length > 0 ? supplierImages : decoImages;

  return {
    productId: p.product_id ?? 0,
    productCode: p.product_code ?? "",
    productName: p.product_name ?? "",
    supplier: p.supplier ?? "",
    brand: p.brand ?? "",
    category: p.categories?.[0]?.name ?? "",
    colors: (p.colors ?? [])
      .filter((c) => c.id != null && c.name)
      .map((c) => ({ id: c.id!, name: c.name! })),
    sizes: (p.sizes ?? [])
      .filter((s) => s.id != null && s.name)
      .map((s) => ({ id: s.id!, name: s.name!, code: s.code ?? s.name! })),
    skus: (p.skus ?? [])
      .filter((s) => s.size_id != null && s.color_id != null)
      .map((s) => ({
        sizeId: s.size_id!,
        colorId: s.color_id!,
        price: s.price ?? 0,
        cost: s.cost ?? 0,
        sku: s.sku ?? "",
        dnSkuId: s.dn_sku_id ?? "",
      })),
    images,
  };
}

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
