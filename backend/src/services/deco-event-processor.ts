import {
  ExternalProvider,
  FulfillmentStatus,
  JobSource,
  MainLifecycle,
  type Prisma,
} from "@prisma/client";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

type JsonObject = Record<string, unknown>;

// ── Deco raw payload helpers ──

type DecoRawPayload = {
  order_id?: number;
  job_name?: string;
  customer_id?: number;
  customer_po_number?: string;
  order_status?: number;
  order_status_name?: string;
  date_ordered?: string;
  date_modified?: string;
  date_due?: string;
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
  order_lines?: Array<{
    item_type?: number;
    product_name?: string;
    product_code?: string;
    sku?: string;
    qty?: string | number;
    product_color?: { name?: string };
  }>;
  notes?: Array<{ content?: string }>;
};

function parseDateField(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function resolveCustomerName(billing: DecoRawPayload["billing_details"]): string | undefined {
  if (!billing) return undefined;
  if (billing.company?.trim()) return billing.company.trim();
  const full = `${billing.firstname ?? ""} ${billing.lastname ?? ""}`.trim();
  return full || undefined;
}

function resolveCompany(billing: DecoRawPayload["billing_details"]): string | undefined {
  return billing?.company?.trim() || undefined;
}

function mapDecoLifecycle(statusName: string | undefined, statusCode: number | undefined): MainLifecycle {
  const name = (statusName ?? "").toLowerCase();
  if (name.includes("complet") || name.includes("shipped") || name.includes("delivered")) {
    return MainLifecycle.COMPLETED;
  }
  if (name.includes("cancel")) return MainLifecycle.CANCELLED;
  if (name.includes("hold")) return MainLifecycle.ON_HOLD;
  if (name.includes("production") || name.includes("printing") || name.includes("decorat")) {
    return MainLifecycle.IN_PRODUCTION;
  }
  if (name.includes("queue") || name.includes("ready for prod")) {
    return MainLifecycle.PRODUCTION_QUEUED;
  }
  if (name.includes("stock") || name.includes("awaiting")) {
    return MainLifecycle.AWAITING_STOCK;
  }
  return MainLifecycle.INGESTED;
}

function mapDecoFulfillment(statusName: string | undefined): FulfillmentStatus {
  const name = (statusName ?? "").toLowerCase();
  if (name.includes("shipped") || name.includes("delivered") || name.includes("complet")) {
    return FulfillmentStatus.FULFILLED;
  }
  if (name.includes("partial")) {
    return FulfillmentStatus.PARTIALLY_FULFILLED;
  }
  return FulfillmentStatus.UNFULFILLED;
}

async function generateUniqueInternalJobId(
  tx: Prisma.TransactionClient,
  suggestedBase: string,
): Promise<string> {
  let suffix = 0;
  while (suffix < 1000) {
    const candidate = suffix === 0 ? suggestedBase : `${suggestedBase}-${suffix}`;
    const exists = await tx.job.findUnique({
      where: { internalJobId: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    suffix += 1;
  }
  return `DC-${Date.now()}`;
}

// ── Deco order event processing ──

export async function processDecoOrderEvent(payload: JsonObject): Promise<void> {
  const raw = payload as unknown as DecoRawPayload;
  const decoOrderId = String(raw.order_id ?? payload.id ?? payload.orderId ?? "");
  if (!decoOrderId || decoOrderId === "0") {
    logger.warn({ payload }, "Deco order event missing id");
    return;
  }

  const billing = raw.billing_details;
  const decoCustomerId = raw.customer_id ?? billing?.user_id;

  // Check for existing link
  const link = await prisma.externalLink.findUnique({
    where: {
      provider_externalId: {
        provider: ExternalProvider.DECO_ORDER,
        externalId: decoOrderId,
      },
    },
    select: { jobId: true },
  });

  if (link) {
    // Update existing job with latest Deco status
    await prisma.$transaction(async (tx) => {
      const updateData: Prisma.JobUpdateInput = {
        decoOrderId,
      };

      if (raw.order_status_name) {
        const lifecycle = mapDecoLifecycle(raw.order_status_name, raw.order_status);
        updateData.lifecycle = lifecycle;
        updateData.fulfillmentStatus = mapDecoFulfillment(raw.order_status_name);
      }

      if (raw.billable_amount != null) {
        updateData.totalMinor = Math.round(raw.billable_amount * 100);
      }

      await tx.job.update({ where: { id: link.jobId }, data: updateData });

      await tx.activityLog.create({
        data: {
          jobId: link.jobId,
          eventType: "deco.order.updated",
          message: `Deco order ${decoOrderId} synced (status: ${raw.order_status_name ?? "unknown"})`,
          payload: { decoOrderId, status: raw.order_status_name } as Prisma.InputJsonValue,
        },
      });
    });

    logger.info({ decoOrderId, jobId: link.jobId }, "Updated existing linked job from Deco event");
    return;
  }

  // Also check by decoOrderId on Job model directly
  const existingByDecoId = await prisma.job.findFirst({
    where: { decoOrderId },
    select: { id: true },
  });
  if (existingByDecoId) {
    logger.info({ decoOrderId, jobId: existingByDecoId.id }, "Deco order already linked via decoOrderId");
    return;
  }

  // ── Create new Job from Deco order ──
  const lifecycle = mapDecoLifecycle(raw.order_status_name, raw.order_status);
  const fulfillmentStatus = mapDecoFulfillment(raw.order_status_name);
  const totalMinor = raw.billable_amount != null ? Math.round(raw.billable_amount * 100) : 0;
  const orderNotes = (raw.notes ?? []).map(n => n.content ?? "").filter(Boolean).join("\n");

  const result = await prisma.$transaction(async (tx) => {
    const suggestedId = `DC-${decoOrderId}`;
    const internalJobId = await generateUniqueInternalJobId(tx, suggestedId);

    // Try to match account via decoCustomerId
    let accountId: string | undefined;
    let matchStatus: "AUTO_MATCHED" | "UNMATCHED" = "UNMATCHED";
    if (decoCustomerId) {
      const account = await tx.account.findFirst({
        where: { decoCustomerId: String(decoCustomerId) },
        select: { id: true },
      });
      if (account) {
        accountId = account.id;
        matchStatus = "AUTO_MATCHED";
      }
    }

    const created = await tx.job.create({
      data: {
        internalJobId,
        source: JobSource.DECO,
        lifecycle,
        fulfillmentStatus,
        decoOrderId,
        decoCustomerId: decoCustomerId ? String(decoCustomerId) : undefined,
        customerName: resolveCustomerName(billing),
        customerEmail: billing?.email ?? undefined,
        customerCompany: resolveCompany(billing),
        currencyCode: "GBP",
        totalMinor,
        orderPlacedAt: parseDateField(raw.date_ordered),
        dueAt: parseDateField(raw.date_due),
        orderNotes: orderNotes || undefined,
        accountId,
        accountMatchStatus: matchStatus,
        metadata: {
          decoStatus: raw.order_status_name ?? null,
          decoStatusCode: raw.order_status ?? null,
          decoCustomerPO: raw.customer_po_number ?? null,
          decoJobName: raw.job_name ?? null,
          decoDateCompleted: raw.date_completed ?? null,
          decoDateShipped: raw.date_shipped ?? null,
        } satisfies JsonObject,
      },
      select: { id: true, internalJobId: true },
    });

    // Create external link
    await tx.externalLink.create({
      data: {
        jobId: created.id,
        provider: ExternalProvider.DECO_ORDER,
        externalId: decoOrderId,
      },
    });

    // Create line items
    const lines = raw.order_lines ?? [];
    if (lines.length > 0) {
      await tx.jobItem.createMany({
        data: lines.map((line) => {
          const qty = typeof line.qty === "string" ? parseInt(line.qty, 10) || 1 : (line.qty ?? 1);
          return {
            jobId: created.id,
            sku: line.sku ?? line.product_code ?? undefined,
            productTitle: line.product_name ?? "Untitled Product",
            variantTitle: line.product_color?.name ?? undefined,
            quantity: qty,
          };
        }),
      });
    }

    // Activity log
    await tx.activityLog.create({
      data: {
        jobId: created.id,
        eventType: "deco.order.ingested",
        message: `Deco order ${decoOrderId} ingested as ${internalJobId}`,
        payload: { decoOrderId, decoCustomerId, lifecycle } as Prisma.InputJsonValue,
      },
    });

    return { jobId: created.id, internalJobId };
  });

  logger.info({ decoOrderId, jobId: result.jobId, internalJobId: result.internalJobId }, "Created new job from Deco order");
}

// ── Deco stock event processing ──
// Called when Deco reports stock/inventory changes.

export async function processDecoStockEvent(payload: JsonObject): Promise<void> {
  const decoOrderId = String(payload.orderId ?? payload.id ?? "");
  if (!decoOrderId) {
    logger.warn({ payload }, "Deco stock event missing orderId");
    return;
  }

  const link = await prisma.externalLink.findUnique({
    where: {
      provider_externalId: {
        provider: ExternalProvider.DECO_ORDER,
        externalId: decoOrderId,
      },
    },
    select: { jobId: true },
  });

  const jobId = link?.jobId ?? (await prisma.job.findFirst({
    where: { decoOrderId },
    select: { id: true },
  }))?.id;

  if (!jobId) {
    logger.info({ decoOrderId }, "Deco stock event received but no linked job found");
    return;
  }

  await prisma.activityLog.create({
    data: {
      jobId,
      eventType: "deco.stock.updated",
      message: `Deco stock update for order ${decoOrderId}`,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  logger.info({ decoOrderId, jobId }, "Processed Deco stock event");
}

// ── Helpers ──

async function getJobMetadata(
  tx: Prisma.TransactionClient,
  jobId: string,
): Promise<JsonObject> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: { metadata: true },
  });

  const raw = job?.metadata;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  return raw as JsonObject;
}
