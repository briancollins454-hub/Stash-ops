import type { ShopifyOrderCreatedPayload } from "@/server/core/order-events";

type ShopifyGraphqlOrderNode = {
  id: string;
  name?: string;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
  displayFulfillmentStatus?: string;
  tags?: string[];
  customer?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  } | null;
  billingAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
    company?: string;
  } | null;
  shippingAddress?: {
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
    company?: string;
  } | null;
  lineItems?: {
    edges?: Array<{
      node?: {
        id: string;
        sku?: string;
        title?: string;
        variantTitle?: string;
        quantity?: number;
        originalUnitPriceSet?: {
          shopMoney?: {
            amount?: string;
          };
        };
      };
    }>;
  };
};

export type ShopifyPullResult = {
  orders: ShopifyOrderCreatedPayload[];
  latestUpdatedAt?: string;
};

type ShopifyGraphqlPullResponse = {
  data?: {
    orders?: {
      edges?: Array<{
        node?: ShopifyGraphqlOrderNode;
      }>;
      pageInfo?: {
        hasNextPage?: boolean;
        endCursor?: string | null;
      };
    };
  };
  errors?: Array<{ message?: string }>;
};

const defaultApiVersion = process.env.SHOPIFY_API_VERSION ?? "2025-01";

function getShopifyConfig() {
  const domain = process.env.SHOPIFY_DOMAIN?.trim();
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN?.trim();

  if (!domain || !accessToken) {
    return undefined;
  }

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return {
    domain: cleanDomain,
    accessToken,
    apiVersion: defaultApiVersion,
  };
}

function normalizeFulfillmentStatus(status?: string): ShopifyOrderCreatedPayload["fulfillmentStatus"] {
  if (!status) {
    return "unknown";
  }

  const normalized = status.toUpperCase();
  if (normalized === "FULFILLED") {
    return "fulfilled";
  }
  if (normalized === "PARTIALLY_FULFILLED") {
    return "partial";
  }
  if (normalized === "RESTOCKED") {
    return "restocked";
  }
  if (
    normalized === "UNFULFILLED" ||
    normalized === "OPEN" ||
    normalized === "IN_PROGRESS" ||
    normalized === "PENDING_FULFILLMENT" ||
    normalized === "ON_HOLD" ||
    normalized === "SCHEDULED"
  ) {
    return "unfulfilled";
  }

  return "unknown";
}

function toPayload(node: ShopifyGraphqlOrderNode): ShopifyOrderCreatedPayload {
  return {
    id: node.id,
    orderNumber: node.name?.replace("#", ""),
    customer: {
      id: node.customer?.id,
      firstName: node.customer?.firstName,
      lastName: node.customer?.lastName,
      email: node.customer?.email,
      phone: node.customer?.phone,
      company: node.shippingAddress?.company ?? node.billingAddress?.company,
    },
    billingAddress: node.billingAddress ?? undefined,
    shippingAddress: node.shippingAddress ?? undefined,
    lineItems:
      node.lineItems?.edges
        ?.map((edge) => edge.node)
        .filter((line): line is NonNullable<typeof line> => Boolean(line))
        .map((line) => ({
          id: line.id,
          sku: line.sku ?? undefined,
          title: line.title ?? undefined,
          variantTitle: line.variantTitle ?? undefined,
          quantity: line.quantity ?? 1,
          price: line.originalUnitPriceSet?.shopMoney?.amount ?? "0",
        })) ?? [],
    tags: Array.isArray(node.tags) ? node.tags.join(", ") : undefined,
    note: node.note ?? undefined,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    fulfillmentStatus: normalizeFulfillmentStatus(node.displayFulfillmentStatus),
  };
}

function readMaxPages(envName: string, fallback: number, max = 1200) {
  const raw = process.env[envName];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function readSyncTimeoutMs() {
  const raw = process.env.SHOPIFY_SYNC_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 30_000;
  }

  return Math.max(5_000, Math.min(180_000, Math.floor(parsed)));
}

async function fetchShopifyGraphql(
  endpoint: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
) {
  const timeoutMs = readSyncTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Shopify sync timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function getOrdersQuery() {
  return `
    query OrdersSince($cursor: String, $query: String) {
      orders(first: 100, after: $cursor, query: $query, sortKey: UPDATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            note
            createdAt
            updatedAt
            displayFulfillmentStatus
            tags
            customer {
              id
              firstName
              lastName
              email
              phone
            }
            billingAddress {
              address1
              address2
              city
              province
              zip
              country
              company
            }
            shippingAddress {
              address1
              address2
              city
              province
              zip
              country
              company
            }
            lineItems(first: 80) {
              edges {
                node {
                  id
                  sku
                  title
                  variantTitle
                  quantity
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                    }
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;
}

async function pullShopifyOrdersByQuery(
  filterQuery: string,
  maxPages: number,
): Promise<ShopifyPullResult> {
  const config = getShopifyConfig();
  if (!config) {
    return {
      orders: [],
    };
  }

  const endpoint = `https://${config.domain}/admin/api/${config.apiVersion}/graphql.json`;
  const query = getOrdersQuery();
  const headers = {
    "content-type": "application/json",
    "x-shopify-access-token": config.accessToken,
  };

  const pulled: ShopifyOrderCreatedPayload[] = [];
  let latestUpdatedAt: string | undefined;
  let hasNextPage = true;
  let cursor: string | null = null;
  let pageCount = 0;

  while (hasNextPage && pageCount < maxPages) {
    const response = await fetchShopifyGraphql(
      endpoint,
      {
        query,
        variables: {
          cursor,
          query: filterQuery,
        },
      },
      headers,
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Shopify sync failed (${response.status}): ${body.slice(0, 240)}`);
    }

    const json = (await response.json()) as ShopifyGraphqlPullResponse;

    if (json.errors?.length) {
      const message = json.errors[0]?.message ?? "Unknown Shopify GraphQL error";
      throw new Error(`Shopify sync failed: ${message}`);
    }

    const edges = json.data?.orders?.edges ?? [];
    edges.forEach((edge) => {
      if (!edge.node) {
        return;
      }

      pulled.push(toPayload(edge.node));
      if (edge.node.updatedAt && (!latestUpdatedAt || edge.node.updatedAt > latestUpdatedAt)) {
        latestUpdatedAt = edge.node.updatedAt;
      }
    });

    hasNextPage = Boolean(json.data?.orders?.pageInfo?.hasNextPage);
    cursor = json.data?.orders?.pageInfo?.endCursor ?? null;
    pageCount += 1;
  }

  return {
    orders: pulled,
    latestUpdatedAt,
  };
}

export function isShopifyConnectorConfigured() {
  return Boolean(getShopifyConfig());
}

export async function pullShopifyOrdersSince(updatedSinceIso: string): Promise<ShopifyPullResult> {
  const filterQuery = `updated_at:>=${updatedSinceIso} status:any`;
  const maxPages = readMaxPages("SHOPIFY_SYNC_MAX_PAGES", 20);
  return pullShopifyOrdersByQuery(filterQuery, maxPages);
}

export async function pullShopifyUnfulfilledOrders(): Promise<ShopifyPullResult> {
  const maxPages = readMaxPages("SHOPIFY_BACKFILL_MAX_PAGES", 250);
  const pulled = await pullShopifyOrdersByQuery("status:any", maxPages);

  return {
    orders: pulled.orders.filter((order) => order.fulfillmentStatus !== "fulfilled"),
    latestUpdatedAt: pulled.latestUpdatedAt,
  };
}
