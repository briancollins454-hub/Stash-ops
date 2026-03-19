type ShopifyFulfillmentResult = {
  fulfilled: boolean;
  alreadyFulfilled?: boolean;
  fulfillmentId?: string;
  note: string;
};

type ShopifyFulfillmentOrder = {
  id: number;
  status?: string;
  request_status?: string;
  supported_actions?: string[];
};

const defaultApiVersion = process.env.SHOPIFY_API_VERSION ?? "2025-01";

function getShopifyConfig() {
  const domain = process.env.SHOPIFY_DOMAIN?.trim();
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN?.trim();
  if (!domain || !accessToken) {
    return undefined;
  }

  return {
    domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    accessToken,
    apiVersion: defaultApiVersion,
  };
}

function parseShopifyNumericOrderId(shopifyOrderId: string) {
  if (/^\d+$/.test(shopifyOrderId)) {
    return shopifyOrderId;
  }

  const gidMatch = shopifyOrderId.match(/gid:\/\/shopify\/Order\/(\d+)/i);
  return gidMatch ? gidMatch[1] : undefined;
}

function buildHeaders(accessToken: string) {
  return {
    "content-type": "application/json",
    "x-shopify-access-token": accessToken,
  };
}

function isFulfillable(fulfillmentOrder: ShopifyFulfillmentOrder) {
  const status = fulfillmentOrder.status?.toLowerCase() ?? "";
  const requestStatus = fulfillmentOrder.request_status?.toLowerCase() ?? "";
  const supported = (fulfillmentOrder.supported_actions ?? []).map((action) =>
    action.toLowerCase(),
  );

  if (supported.includes("create_fulfillment")) {
    return true;
  }

  if (status === "open" || status === "in_progress" || status === "scheduled") {
    return requestStatus === "" || requestStatus === "unsubmitted" || requestStatus === "accepted";
  }

  return false;
}

export function isShopifyFulfillmentConfigured() {
  return Boolean(getShopifyConfig());
}

export async function fulfillShopifyOrder(shopifyOrderId: string): Promise<ShopifyFulfillmentResult> {
  const config = getShopifyConfig();
  if (!config) {
    return {
      fulfilled: false,
      note: "Shopify fulfillment skipped: connector not configured.",
    };
  }

  const numericOrderId = parseShopifyNumericOrderId(shopifyOrderId);
  if (!numericOrderId) {
    return {
      fulfilled: false,
      note: `Shopify fulfillment skipped: cannot parse order id (${shopifyOrderId}).`,
    };
  }

  const baseUrl = `https://${config.domain}/admin/api/${config.apiVersion}`;
  const headers = buildHeaders(config.accessToken);

  const fulfillmentOrdersResponse = await fetch(
    `${baseUrl}/orders/${numericOrderId}/fulfillment_orders.json`,
    {
      method: "GET",
      headers,
    },
  );

  const fulfillmentOrdersText = await fulfillmentOrdersResponse.text();
  if (!fulfillmentOrdersResponse.ok) {
    return {
      fulfilled: false,
      note: `Shopify fulfillment lookup failed (${fulfillmentOrdersResponse.status}): ${fulfillmentOrdersText.slice(0, 180)}`,
    };
  }

  let fulfillmentOrdersJson: unknown = undefined;
  try {
    fulfillmentOrdersJson = fulfillmentOrdersText ? JSON.parse(fulfillmentOrdersText) : undefined;
  } catch {
    fulfillmentOrdersJson = undefined;
  }

  const fulfillmentOrders = Array.isArray(
    (fulfillmentOrdersJson as { fulfillment_orders?: unknown[] } | undefined)?.fulfillment_orders,
  )
    ? ((fulfillmentOrdersJson as { fulfillment_orders: ShopifyFulfillmentOrder[] }).fulfillment_orders ??
      [])
    : [];

  const fulfillable = fulfillmentOrders.filter(isFulfillable);
  if (fulfillable.length === 0) {
    return {
      fulfilled: true,
      alreadyFulfilled: true,
      note: "No open fulfillment orders were found in Shopify.",
    };
  }

  const createPayload = {
    fulfillment: {
      line_items_by_fulfillment_order: fulfillable.map((item) => ({
        fulfillment_order_id: item.id,
      })),
      notify_customer: false,
    },
  };

  const createResponse = await fetch(`${baseUrl}/fulfillments.json`, {
    method: "POST",
    headers,
    body: JSON.stringify(createPayload),
  });

  const createText = await createResponse.text();
  if (!createResponse.ok) {
    return {
      fulfilled: false,
      note: `Shopify fulfillment create failed (${createResponse.status}): ${createText.slice(0, 180)}`,
    };
  }

  let createJson: unknown = undefined;
  try {
    createJson = createText ? JSON.parse(createText) : undefined;
  } catch {
    createJson = undefined;
  }

  const fulfillmentId = (createJson as { fulfillment?: { id?: string | number } } | undefined)
    ?.fulfillment?.id;

  return {
    fulfilled: true,
    fulfillmentId:
      typeof fulfillmentId === "number" || typeof fulfillmentId === "string"
        ? String(fulfillmentId)
        : undefined,
    note: "Shopify marked as fulfilled.",
  };
}
