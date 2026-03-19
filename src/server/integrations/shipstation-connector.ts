export type ShipstationPrintItemInput = {
  internalOrderId: string;
  shopifyOrderId: string;
  shopifyOrderNumber?: string;
  customer: string;
  company: string;
  quantity: number;
};

export type ShipstationPrintItemResult = {
  internalOrderId: string;
  printed: boolean;
  shipmentId?: string;
  error?: string;
};

export type ShipstationBulkPrintResult = {
  batchId: string;
  emulated: boolean;
  note: string;
  labels: ShipstationPrintItemResult[];
};

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getShipstationConfig() {
  const printUrl = process.env.SHIPSTATION_PRINT_URL?.trim();
  const token = process.env.SHIPSTATION_PRINT_TOKEN?.trim();
  const tokenHeader = process.env.SHIPSTATION_PRINT_TOKEN_HEADER?.trim() || "authorization";
  const tokenPrefix = process.env.SHIPSTATION_PRINT_TOKEN_PREFIX?.trim() || "Bearer";

  if (!printUrl) {
    return undefined;
  }

  return {
    printUrl,
    token,
    tokenHeader,
    tokenPrefix,
  };
}

function emulatePrintBatch(items: ShipstationPrintItemInput[]): ShipstationBulkPrintResult {
  return {
    batchId: randomId("ship-batch"),
    emulated: true,
    note: "ShipStation print bridge not configured; simulated local label batch.",
    labels: items.map((item) => ({
      internalOrderId: item.internalOrderId,
      printed: true,
      shipmentId: randomId("ss-ship"),
    })),
  };
}

export function isShipstationConnectorConfigured() {
  return Boolean(getShipstationConfig());
}

export async function printShipstationLabels(
  items: ShipstationPrintItemInput[],
): Promise<ShipstationBulkPrintResult> {
  if (items.length === 0) {
    return {
      batchId: randomId("ship-batch"),
      emulated: true,
      note: "No items supplied for ShipStation label printing.",
      labels: [],
    };
  }

  const config = getShipstationConfig();
  if (!config) {
    return emulatePrintBatch(items);
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (config.token) {
    headers[config.tokenHeader.toLowerCase()] = `${config.tokenPrefix} ${config.token}`;
  }

  const response = await fetch(config.printUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      orders: items,
      requestedAt: new Date().toISOString(),
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    return {
      batchId: randomId("ship-batch"),
      emulated: false,
      note: `ShipStation print failed (${response.status}): ${rawText.slice(0, 180)}`,
      labels: items.map((item) => ({
        internalOrderId: item.internalOrderId,
        printed: false,
        error: "Print request failed.",
      })),
    };
  }

  let jsonBody: unknown = undefined;
  try {
    jsonBody = rawText ? JSON.parse(rawText) : undefined;
  } catch {
    jsonBody = undefined;
  }

  const batchIdCandidate = (jsonBody as { batchId?: string } | undefined)?.batchId;
  const labelsCandidate = (jsonBody as { labels?: unknown[] } | undefined)?.labels;

  if (!Array.isArray(labelsCandidate)) {
    return {
      batchId: typeof batchIdCandidate === "string" ? batchIdCandidate : randomId("ship-batch"),
      emulated: false,
      note: "ShipStation print bridge returned no label list.",
      labels: items.map((item) => ({
        internalOrderId: item.internalOrderId,
        printed: false,
        error: "Bridge payload missing labels.",
      })),
    };
  }

  const labels: ShipstationPrintItemResult[] = labelsCandidate.map((label) => {
    const record = typeof label === "object" && label !== null ? (label as Record<string, unknown>) : {};
    return {
      internalOrderId:
        typeof record.internalOrderId === "string" ? record.internalOrderId : "unknown",
      printed: Boolean(record.printed),
      shipmentId: typeof record.shipmentId === "string" ? record.shipmentId : undefined,
      error: typeof record.error === "string" ? record.error : undefined,
    };
  });

  return {
    batchId: typeof batchIdCandidate === "string" ? batchIdCandidate : randomId("ship-batch"),
    emulated: false,
    note: "ShipStation label batch completed.",
    labels,
  };
}
