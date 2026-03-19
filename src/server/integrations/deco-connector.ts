import type { UnifiedOrderRecord } from "@/server/core/order-types";

export type DecoUpsertResult = {
  decoOrderId: string;
  mode: "http_upsert";
  raw?: unknown;
};

function nowIso() {
  return new Date().toISOString();
}

function timeoutMs() {
  const parsed = Number(process.env.DECO_SYNC_TIMEOUT_MS ?? "25000");
  if (!Number.isFinite(parsed) || parsed < 1_000) {
    return 25_000;
  }
  return parsed;
}

function getDecoUpsertConfig() {
  const upsertUrl = process.env.DECO_ORDER_UPSERT_URL?.trim();
  const token = process.env.DECO_UPSERT_TOKEN?.trim();
  const tokenHeader = process.env.DECO_UPSERT_TOKEN_HEADER?.trim() || "authorization";
  const tokenPrefix = process.env.DECO_UPSERT_TOKEN_PREFIX?.trim() || "Bearer";

  if (!upsertUrl) {
    return undefined;
  }

  return {
    upsertUrl,
    token,
    tokenHeader,
    tokenPrefix,
  };
}

function buildPayload(order: UnifiedOrderRecord) {
  return {
    internalOrderId: order.internalOrderId,
    externalReferences: order.externalReferences,
    customer: order.customer,
    addresses: {
      billing: order.billingAddress,
      shipping: order.shippingAddress,
    },
    lineItems: order.lineItems,
    designSetup: order.designSetup,
    approval: order.approval,
    stock: order.stock,
    purchasing: order.purchasing,
    production: order.production,
    dueAt: order.dueAt,
    urgency: order.urgency,
    owner: order.owner,
    assignedDepartment: order.assignedDepartment,
    exportedAt: nowIso(),
  };
}

function pickDecoOrderId(response: unknown) {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const record = response as Record<string, unknown>;
  const candidate =
    record.decoOrderId ??
    record.orderId ??
    record.jobId ??
    record.jobNumber ??
    record.id;

  if (typeof candidate === "number") {
    return String(candidate);
  }
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }

  return undefined;
}

export function isDecoConnectorConfigured() {
  return Boolean(getDecoUpsertConfig());
}

export async function upsertOrderToDeco(order: UnifiedOrderRecord): Promise<DecoUpsertResult> {
  const config = getDecoUpsertConfig();
  if (!config) {
    throw new Error("DECO_ORDER_UPSERT_URL is not configured.");
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (config.token) {
    headers[config.tokenHeader.toLowerCase()] = `${config.tokenPrefix} ${config.token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(config.upsertUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(buildPayload(order)),
      signal: controller.signal,
    });

    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(
        `Deco upsert failed (${response.status}): ${rawText.slice(0, 240)}`,
      );
    }

    let jsonBody: unknown = undefined;
    try {
      jsonBody = rawText ? JSON.parse(rawText) : undefined;
    } catch {
      jsonBody = rawText;
    }

    const decoOrderId = pickDecoOrderId(jsonBody) ?? order.externalReferences.decoOrderId;
    if (!decoOrderId) {
      throw new Error("Deco upsert succeeded but no decoOrderId/jobNumber was returned.");
    }

    return {
      decoOrderId,
      mode: "http_upsert",
      raw: jsonBody,
    };
  } finally {
    clearTimeout(timer);
  }
}
