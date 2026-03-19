import {
  ExternalProvider,
  FulfillmentStatus,
  MainLifecycle,
  MatchStatus,
  JobSource,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { applyAccountAwareConfiguration } from "./order-account-preconfiguration";
import { inferSourceGroup } from "./source-group";

type JsonObject = Record<string, unknown>;

export type ShopifyOrderPayload = {
  id?: string | number;
  name?: string;
  order_number?: string | number;
  tags?: string;
  note?: string | null;
  note_attributes?: Array<{ name?: string | null; value?: string | null }>;
  metafields?: Array<{ namespace?: string | null; key?: string | null; value?: string | null }>;
  email?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    default_address?: {
      company?: string | null;
    } | null;
    tags?: string | null;
  } | null;
  shipping_address?: {
    company?: string | null;
    name?: string | null;
  } | null;
  billing_address?: {
    company?: string | null;
    name?: string | null;
  } | null;
  currency?: string | null;
  subtotal_price?: string | number | null;
  total_price?: string | number | null;
  processed_at?: string | null;
  created_at?: string | null;
  fulfillment_status?: string | null;
  line_items?: ShopifyLineItemPayload[];
};

export type ShopifyLineItemPayload = {
  id?: string | number;
  sku?: string | null;
  title?: string | null;
  name?: string | null;
  variant_title?: string | null;
  quantity?: number;
  price?: string | number | null;
  fulfillable_quantity?: number | null;
  vendor?: string | null;
  properties?: Array<{ name?: string | null; value?: string | null }>;
};

export type ShopifyFulfillmentPayload = {
  id?: string | number;
  order_id?: string | number;
  status?: string | null;
  created_at?: string | null;
  tracking_number?: string | null;
  tracking_numbers?: string[] | null;
};

export type ManualOrderInput = {
  customerName: string;
  customerEmail?: string;
  sourceGroupLabel?: string;
  note?: string;
  lineItems: Array<{
    sku?: string;
    productTitle: string;
    variantTitle?: string;
    quantity: number;
    decorationMethod?: string;
    requiresArtwork?: boolean;
    unitPriceMinor?: number;
  }>;
};

function parsePriceToMinor(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  return Math.round(numeric * 100);
}

function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseShopifyTags(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function inferArtworkRequirement(item: ShopifyLineItemPayload): boolean {
  const fromProperties = (item.properties ?? []).some((property) =>
    `${property.name ?? ""} ${property.value ?? ""}`.toLowerCase().match(/artwork|logo|embroid|dtf|dtg/),
  );
  return fromProperties;
}

function mapShopifyFulfillmentStatus(input: ShopifyOrderPayload): FulfillmentStatus {
  const status = (input.fulfillment_status ?? "").toLowerCase();
  if (status.includes("fulfilled")) {
    return FulfillmentStatus.FULFILLED;
  }
  if (status.includes("partial")) {
    return FulfillmentStatus.PARTIALLY_FULFILLED;
  }
  if (status.includes("restock")) {
    return FulfillmentStatus.RESTOCKED;
  }
  return FulfillmentStatus.UNFULFILLED;
}

function determineInitialLifecycle(input: ShopifyOrderPayload): MainLifecycle {
  const fulfillmentStatus = mapShopifyFulfillmentStatus(input);
  if (fulfillmentStatus === FulfillmentStatus.FULFILLED) {
    return MainLifecycle.COMPLETED;
  }

  return MainLifecycle.INGESTED;
}

function resolveCustomerName(input: ShopifyOrderPayload): string | undefined {
  const first = input.customer?.first_name?.trim() ?? "";
  const last = input.customer?.last_name?.trim() ?? "";
  const combined = `${first} ${last}`.trim();
  if (combined) {
    return combined;
  }
  return input.shipping_address?.name?.trim() || input.billing_address?.name?.trim() || undefined;
}

function resolveCompany(input: ShopifyOrderPayload): string | undefined {
  return (
    input.shipping_address?.company?.trim() ||
    input.billing_address?.company?.trim() ||
    input.customer?.default_address?.company?.trim() ||
    undefined
  );
}

async function generateUniqueInternalJobId(
  tx: Prisma.TransactionClient,
  suggestedBase: string,
): Promise<string> {
  let suffix = 0;
  while (suffix < 1000) {
    const candidate = suffix === 0 ? suggestedBase : `${suggestedBase}-${suffix}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await tx.job.findUnique({
      where: { internalJobId: candidate },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
    suffix += 1;
  }

  return `ST-${Date.now()}`;
}

function formatSuggestedInternalId(order: ShopifyOrderPayload): string {
  if (order.order_number !== undefined && order.order_number !== null) {
    return `ST-${String(order.order_number)}`;
  }
  if (order.id !== undefined && order.id !== null) {
    return `ST-${String(order.id).slice(-6)}`;
  }
  return `ST-${Date.now().toString().slice(-6)}`;
}

export async function upsertJobFromShopify(
  payload: ShopifyOrderPayload,
  options?: { prismaClient?: PrismaClient; activityType?: string },
): Promise<{ jobId: string; internalJobId: string }> {
  const shopifyOrderId = String(payload.id ?? "").trim();
  if (!shopifyOrderId) {
    throw new Error("Shopify payload missing order id");
  }

  const client = options?.prismaClient ?? prisma;
  const activityType = options?.activityType ?? "shopify.order.upserted";
  const tags = parseShopifyTags(payload.tags);
  const company = resolveCompany(payload);
  const sourceGroup = inferSourceGroup({
    tags,
    note: payload.note,
    company,
  });

  const result = await client.$transaction(async (tx) => {
    const link = await tx.externalLink.findUnique({
      where: {
        provider_externalId: {
          provider: ExternalProvider.SHOPIFY_ORDER,
          externalId: shopifyOrderId,
        },
      },
      select: {
        jobId: true,
      },
    });

    const baseData = {
      source: JobSource.SHOPIFY,
      sourceGroupKey: sourceGroup.key,
      sourceGroupLabel: sourceGroup.label,
      sourceGroupType: sourceGroup.type,
      shopifyOrderId,
      shopifyOrderName: payload.name ?? undefined,
      customerName: resolveCustomerName(payload),
      customerEmail: payload.email ?? payload.customer?.email ?? undefined,
      customerCompany: company,
      currencyCode: payload.currency ?? "GBP",
      subtotalMinor: parsePriceToMinor(payload.subtotal_price),
      totalMinor: parsePriceToMinor(payload.total_price) ?? 0,
      orderPlacedAt: parseDate(payload.processed_at) ?? parseDate(payload.created_at),
      fulfillmentStatus: mapShopifyFulfillmentStatus(payload),
      lifecycle: determineInitialLifecycle(payload),
      shopifyMetadata: {
        shopifyTags: tags,
        shopifyNote: payload.note ?? null,
      } satisfies JsonObject,
    };

    let jobId: string;
    let internalJobId: string;

    if (link) {
      const updated = await tx.job.update({
        where: { id: link.jobId },
        data: baseData,
        select: { id: true, internalJobId: true },
      });
      jobId = updated.id;
      internalJobId = updated.internalJobId;
    } else {
      const suggestedId = formatSuggestedInternalId(payload);
      const internal = await generateUniqueInternalJobId(tx, suggestedId);

      const created = await tx.job.create({
        data: {
          ...baseData,
          internalJobId: internal,
        },
        select: { id: true, internalJobId: true },
      });

      jobId = created.id;
      internalJobId = created.internalJobId;

      await tx.externalLink.create({
        data: {
          jobId,
          provider: ExternalProvider.SHOPIFY_ORDER,
          externalId: shopifyOrderId,
        },
      });
    }

    const lineItems = payload.line_items ?? [];
    await tx.jobItem.deleteMany({
      where: { jobId },
    });

    if (lineItems.length > 0) {
      await tx.jobItem.createMany({
        data: lineItems.map((item) => {
          const unitPriceMinor = parsePriceToMinor(item.price);
          const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
          return {
            jobId,
            sku: item.sku ?? undefined,
            productTitle: item.title ?? item.name ?? "Untitled Product",
            variantTitle: item.variant_title ?? undefined,
            quantity: qty,
            decorationMethod: inferArtworkRequirement(item) ? "custom" : undefined,
            unitPriceMinor,
            totalPriceMinor: unitPriceMinor ? unitPriceMinor * qty : undefined,
            metadata: {
              vendor: item.vendor ?? null,
            } satisfies JsonObject,
          };
        }),
      });
    }

    await applyAccountAwareConfiguration(tx, jobId, payload);

    await tx.activityLog.create({
      data: {
        jobId,
        eventType: activityType,
        message: `Shopify order ${payload.name ?? shopifyOrderId} synced`,
        payload: {
          shopifyOrderId,
          fulfillmentStatus: mapShopifyFulfillmentStatus(payload),
        } satisfies JsonObject,
      },
    });

    return { jobId, internalJobId };
  });

  return result;
}

export async function processShopifyFulfillmentWebhook(payload: ShopifyFulfillmentPayload): Promise<boolean> {
  const orderExternalId = String(payload.order_id ?? "").trim();
  if (!orderExternalId) {
    throw new Error("Shopify fulfillment payload missing order_id");
  }

  const maybeLink = await prisma.externalLink.findUnique({
    where: {
      provider_externalId: {
        provider: ExternalProvider.SHOPIFY_ORDER,
        externalId: orderExternalId,
      },
    },
    select: {
      jobId: true,
    },
  });

  if (!maybeLink) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: maybeLink.jobId },
      data: {
        fulfillmentStatus: FulfillmentStatus.FULFILLED,
        lifecycle: MainLifecycle.COMPLETED,
      },
    });

    if (payload.id !== undefined && payload.id !== null) {
      await tx.externalLink.upsert({
        where: {
          provider_externalId: {
            provider: ExternalProvider.SHOPIFY_FULFILLMENT,
            externalId: String(payload.id),
          },
        },
        update: {
          jobId: maybeLink.jobId,
          metadata: {
            status: payload.status ?? null,
            trackingNumber:
              payload.tracking_number ?? payload.tracking_numbers?.find((value) => value.length > 0) ?? null,
            createdAt: payload.created_at ?? null,
          } satisfies JsonObject,
        },
        create: {
          jobId: maybeLink.jobId,
          provider: ExternalProvider.SHOPIFY_FULFILLMENT,
          externalId: String(payload.id),
          metadata: {
            status: payload.status ?? null,
            trackingNumber:
              payload.tracking_number ?? payload.tracking_numbers?.find((value) => value.length > 0) ?? null,
            createdAt: payload.created_at ?? null,
          } satisfies JsonObject,
        },
      });
    }

    await tx.activityLog.create({
      data: {
        jobId: maybeLink.jobId,
        eventType: "shopify.fulfillment.created",
        message: "Shopify fulfillment received — job marked complete",
        payload: {
          fulfillmentId: payload.id ?? null,
          status: payload.status ?? null,
        } satisfies JsonObject,
      },
    });
  });

  return true;
}

export async function createManualJob(input: ManualOrderInput): Promise<{ jobId: string; internalJobId: string }> {
  const sourceGroup = inferSourceGroup({
    company: input.sourceGroupLabel,
    note: input.note,
    tags: [],
  });

  const created = await prisma.$transaction(async (tx) => {
    const baseId = `ST-M-${Date.now().toString().slice(-6)}`;
    const internalJobId = await generateUniqueInternalJobId(tx, baseId);

    const job = await tx.job.create({
      data: {
        internalJobId,
        source: JobSource.MANUAL,
        lifecycle: MainLifecycle.INGESTED,
        fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
        accountMatchStatus: MatchStatus.REVIEW_REQUIRED,
        requiresReview: true,
        reviewReason: "Manual job requires account/template review.",
        sourceGroupKey: sourceGroup.key,
        sourceGroupLabel: sourceGroup.label,
        sourceGroupType: sourceGroup.type,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        currencyCode: "GBP",
        metadata: {
          note: input.note ?? null,
        } satisfies JsonObject,
      },
      select: { id: true, internalJobId: true },
    });

    await tx.jobItem.createMany({
      data: input.lineItems.map((item) => ({
        jobId: job.id,
        sku: item.sku,
        productTitle: item.productTitle,
        variantTitle: item.variantTitle,
        quantity: item.quantity,
        decorationMethod: item.decorationMethod,
        unitPriceMinor: item.unitPriceMinor,
        totalPriceMinor:
          item.unitPriceMinor !== undefined ? item.unitPriceMinor * item.quantity : undefined,
      })),
    });

    await tx.activityLog.create({
      data: {
        jobId: job.id,
        eventType: "manual.job.created",
        message: "Manual job created in Stash",
      },
    });

    return job;
  });

  return { jobId: created.id, internalJobId: created.internalJobId };
}
