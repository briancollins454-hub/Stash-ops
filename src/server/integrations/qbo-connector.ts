export type QboInvoiceSnapshot = {
  id: string;
  docNumber?: string;
  totalAmount?: number;
  customerRefName?: string;
  privateNote?: string;
  updatedAt?: string;
  txnDate?: string;
};

export type QboPullResult = {
  invoices: QboInvoiceSnapshot[];
  latestUpdatedAt?: string;
};

function getQboConfig() {
  const realmId = process.env.QBO_REALM_ID?.trim();
  const accessToken = process.env.QBO_ACCESS_TOKEN?.trim();
  const baseUrl = process.env.QBO_BASE_URL?.trim() || "https://quickbooks.api.intuit.com";
  const minorVersion = process.env.QBO_MINOR_VERSION?.trim() || "75";

  if (!realmId || !accessToken) {
    return undefined;
  }

  return {
    realmId,
    accessToken,
    baseUrl: baseUrl.replace(/\/$/, ""),
    minorVersion,
  };
}

function toIsoString(value?: string) {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

function escapeQboString(value: string) {
  return value.replace(/'/g, "\\'");
}

export function isQboConnectorConfigured() {
  return Boolean(getQboConfig());
}

export async function pullQboInvoicesSince(updatedSinceIso: string): Promise<QboPullResult> {
  const config = getQboConfig();
  if (!config) {
    return {
      invoices: [],
    };
  }

  const safeUpdatedAt = toIsoString(updatedSinceIso) ?? new Date(Date.now() - 1000 * 60 * 60).toISOString();
  const query = `select Id, DocNumber, TotalAmt, CustomerRef, PrivateNote, TxnDate, MetaData from Invoice where MetaData.LastUpdatedTime >= '${escapeQboString(safeUpdatedAt)}' order by MetaData.LastUpdatedTime desc maxresults 200`;

  const endpoint = `${config.baseUrl}/v3/company/${config.realmId}/query?minorversion=${encodeURIComponent(config.minorVersion)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.accessToken}`,
      accept: "application/json",
      "content-type": "text/plain",
    },
    body: query,
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`QBO sync failed (${response.status}): ${rawText.slice(0, 240)}`);
  }

  let jsonBody: unknown = undefined;
  try {
    jsonBody = rawText ? JSON.parse(rawText) : undefined;
  } catch {
    jsonBody = undefined;
  }

  const invoicesRaw = (jsonBody as { QueryResponse?: { Invoice?: unknown[] } } | undefined)
    ?.QueryResponse?.Invoice;
  const invoicesList = Array.isArray(invoicesRaw) ? invoicesRaw : [];

  let latestUpdatedAt: string | undefined;
  const invoices: QboInvoiceSnapshot[] = invoicesList
    .filter((invoice): invoice is Record<string, unknown> => typeof invoice === "object" && invoice !== null)
    .map((invoice) => {
      const updatedAtCandidate =
        typeof invoice.MetaData === "object" &&
        invoice.MetaData !== null &&
        typeof (invoice.MetaData as Record<string, unknown>).LastUpdatedTime === "string"
          ? String((invoice.MetaData as Record<string, unknown>).LastUpdatedTime)
          : undefined;

      const updatedAt = toIsoString(updatedAtCandidate);
      if (updatedAt && (!latestUpdatedAt || updatedAt > latestUpdatedAt)) {
        latestUpdatedAt = updatedAt;
      }

      return {
        id: String(invoice.Id ?? "unknown"),
        docNumber: typeof invoice.DocNumber === "string" ? invoice.DocNumber : undefined,
        totalAmount:
          typeof invoice.TotalAmt === "number"
            ? invoice.TotalAmt
            : typeof invoice.TotalAmt === "string"
              ? Number(invoice.TotalAmt)
              : undefined,
        customerRefName:
          typeof invoice.CustomerRef === "object" &&
          invoice.CustomerRef !== null &&
          typeof (invoice.CustomerRef as Record<string, unknown>).name === "string"
            ? String((invoice.CustomerRef as Record<string, unknown>).name)
            : undefined,
        privateNote: typeof invoice.PrivateNote === "string" ? invoice.PrivateNote : undefined,
        updatedAt,
        txnDate: typeof invoice.TxnDate === "string" ? invoice.TxnDate : undefined,
      } satisfies QboInvoiceSnapshot;
    });

  return {
    invoices,
    latestUpdatedAt,
  };
}
