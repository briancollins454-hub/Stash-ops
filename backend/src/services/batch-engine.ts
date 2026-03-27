import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { createHash } from "crypto";
import type { BatchStatus, BatchConfidence } from "@prisma/client";

// ── Variant title parsing ──

export interface ParsedVariant {
  colour: string | null;
  size: string | null;
}

const SIZE_TOKENS = new Set([
  "xxs", "xs", "s", "m", "l", "xl", "2xl", "xxl", "3xl", "xxxl",
  "4xl", "5xl", "6xl", "7xl", "8xl",
  "small", "medium", "large",
  "one size", "os",
  // Junior / child sizes
  "age 1-2", "age 2-3", "age 3-4", "age 5-6", "age 7-8", "age 9-11", "age 12-13",
  "yxs", "ys", "ym", "yl", "yxl",
  // Numeric sizes
  "6", "8", "10", "12", "14", "16", "18", "20", "22", "24", "26",
  "28", "30", "32", "34", "36", "38", "40", "42", "44", "46", "48",
]);

/**
 * Parse a Shopify variant_title like "Pink / XL" into { colour, size }.
 * Handles formats: "Colour / Size", "Size / Colour", "Size", "Colour"
 */
export function parseVariantTitle(variantTitle: string | null | undefined): ParsedVariant {
  if (!variantTitle || !variantTitle.trim()) {
    return { colour: null, size: null };
  }

  const parts = variantTitle.split("/").map((p) => p.trim()).filter(Boolean);

  if (parts.length === 1) {
    const lower = parts[0].toLowerCase();
    if (SIZE_TOKENS.has(lower)) {
      return { colour: null, size: parts[0] };
    }
    return { colour: parts[0], size: null };
  }

  // Two+ parts: figure out which is size and which is colour
  const firstLower = parts[0].toLowerCase();
  const secondLower = parts[1].toLowerCase();

  if (SIZE_TOKENS.has(firstLower)) {
    // "XL / Pink" → size first
    return { colour: parts[1], size: parts[0] };
  }
  if (SIZE_TOKENS.has(secondLower)) {
    // "Pink / XL" → colour first (most common Shopify format)
    return { colour: parts[0], size: parts[1] };
  }

  // Neither matches known sizes; assume first is colour, second is size
  return { colour: parts[0], size: parts[1] };
}

// ── Batch key computation ──

function normalizeProduct(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Compute a deterministic batch key from the grouping dimensions.
 * Batches group by: account + product + colour + decoration profile + method
 */
export function computeBatchKey(
  accountId: string,
  productTitle: string,
  colour: string | null,
  decorationProfileId: string | null,
  decorationMethod: string | null
): string {
  const parts = [
    accountId,
    normalizeProduct(productTitle),
    (colour ?? "").trim().toLowerCase(),
    decorationProfileId ?? "",
    (decorationMethod ?? "").trim().toLowerCase(),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);
}

// ── Display title generation ──

function buildDisplayTitle(
  accountName: string,
  productTitle: string,
  colour: string | null,
  decorationMethod: string | null
): string {
  const parts = [accountName, productTitle];
  if (colour) parts.push(colour);
  if (decorationMethod) parts.push(`(${decorationMethod})`);
  return parts.join(" – ");
}

// ── Batch engine: process a job's items into production batches ──

export interface BatchResult {
  jobId: string;
  batchesCreated: number;
  batchesUpdated: number;
  itemsBatched: number;
  errors: string[];
}

/**
 * Process all line items for a job, grouping them into ProductionBatches.
 * Each unique combination of account+product+colour+decoProfile+method = one batch.
 */
export async function batchJobItems(jobId: string): Promise<BatchResult> {
  const result: BatchResult = {
    jobId,
    batchesCreated: 0,
    batchesUpdated: 0,
    itemsBatched: 0,
    errors: [],
  };

  // Load job with items, account
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      items: {
        include: {
          decorationProfile: true,
          batchSourceLines: true,
        },
      },
      account: true,
    },
  });

  if (!job) {
    result.errors.push(`Job ${jobId} not found`);
    return result;
  }

  if (!job.accountId || !job.account) {
    result.errors.push(`Job ${jobId} has no matched account — cannot batch`);
    return result;
  }

  const accountId = job.accountId;
  const accountName = job.account.name;

  for (const item of job.items) {
    try {
      // Skip items already batched
      if (item.batchSourceLines.length > 0) {
        logger.debug({ jobId, itemId: item.id }, "Item already batched, skipping");
        continue;
      }

      const parsed = parseVariantTitle(item.variantTitle);
      const colour = parsed.colour;
      const size = parsed.size ?? "One Size";

      const decoProfileId = item.decorationProfileId ?? null;
      const decoMethod = item.decorationMethod ?? item.decorationProfile?.decorationMethod ?? null;

      const batchKey = computeBatchKey(
        accountId,
        item.productTitle,
        colour,
        decoProfileId,
        decoMethod
      );

      // Upsert the ProductionBatch
      const existingBatch = await prisma.productionBatch.findUnique({
        where: { batchKey },
      });

      const batch = await prisma.productionBatch.upsert({
        where: { batchKey },
        create: {
          batchKey,
          accountId,
          displayTitle: buildDisplayTitle(accountName, item.productTitle, colour, decoMethod),
          normalizedProduct: normalizeProduct(item.productTitle),
          colour,
          decorationMethod: decoMethod,
          decorationProfileId: decoProfileId,
          status: "DRAFT",
          confidence: "MANUAL_SETUP",
          totalQuantity: 0,
        },
        update: {},
      });

      if (!existingBatch) {
        result.batchesCreated++;
        logger.info({ batchKey, batchId: batch.id }, "Created new production batch");
      } else {
        result.batchesUpdated++;
      }

      // Upsert BatchItem for this size
      const batchItem = await prisma.batchItem.upsert({
        where: { batchId_size: { batchId: batch.id, size } },
        create: {
          batchId: batch.id,
          size,
          quantity: item.quantity,
        },
        update: {
          quantity: { increment: item.quantity },
        },
      });

      // Create BatchSourceLine linking this job item to the batch
      await prisma.batchSourceLine.create({
        data: {
          batchItemId: batchItem.id,
          jobItemId: item.id,
          jobId: job.id,
          shopifyLineId: item.externalLineId,
          quantity: item.quantity,
          personalisationText: extractPersonalisationText(item),
        },
      });

      // Update batch totals
      await updateBatchTotals(batch.id);

      result.itemsBatched++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ jobId, itemId: item.id, err: msg }, "Failed to batch item");
      result.errors.push(`Item ${item.id}: ${msg}`);
    }
  }

  return result;
}

/**
 * Recalculate totalQuantity and sizeBreakdownJson for a batch.
 */
async function updateBatchTotals(batchId: string): Promise<void> {
  const items = await prisma.batchItem.findMany({
    where: { batchId },
    select: { size: true, quantity: true },
  });

  const breakdown: Record<string, number> = {};
  let total = 0;
  for (const item of items) {
    breakdown[item.size] = item.quantity;
    total += item.quantity;
  }

  // Check for personalisation
  const personalisationCount = await prisma.batchSourceLine.count({
    where: {
      batchItem: { batchId },
      personalisationText: { not: null },
    },
  });

  await prisma.productionBatch.update({
    where: { id: batchId },
    data: {
      totalQuantity: total,
      sizeBreakdownJson: breakdown,
      hasPersonalisation: personalisationCount > 0,
    },
  });
}

/**
 * Extract personalisation text from line item properties.
 * Shopify line items often have properties like "Initials" or "Name".
 */
function extractPersonalisationText(item: {
  customOptions?: unknown;
  metadata?: unknown;
}): string | null {
  const options = item.customOptions as Record<string, unknown> | null;
  if (!options) return null;

  // Check common personalisation property names
  const personalisationKeys = [
    "initials", "name", "personalisation", "personalization",
    "custom text", "text", "monogram", "number",
  ];

  if (Array.isArray(options)) {
    // Shopify properties format: [{name: "Initials", value: "JB"}]
    for (const prop of options) {
      const p = prop as { name?: string; value?: string };
      if (p.name && p.value && personalisationKeys.includes(p.name.toLowerCase())) {
        return p.value;
      }
    }
  } else if (typeof options === "object") {
    for (const key of Object.keys(options)) {
      if (personalisationKeys.includes(key.toLowerCase())) {
        const val = options[key];
        if (typeof val === "string" && val.trim()) return val.trim();
      }
    }
  }

  return null;
}

// ── Rebatch all pending items for an account ──

export async function rebatchAccount(accountId: string): Promise<{
  jobsProcessed: number;
  results: BatchResult[];
}> {
  // Find all jobs for this account that are in early lifecycle stages
  const jobs = await prisma.job.findMany({
    where: {
      accountId,
      lifecycle: { in: ["INGESTED", "CLASSIFIED", "CONFIGURED"] },
    },
    select: { id: true },
  });

  const results: BatchResult[] = [];
  for (const job of jobs) {
    const r = await batchJobItems(job.id);
    results.push(r);
  }

  return { jobsProcessed: jobs.length, results };
}

// ── Batch status transitions ──

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_REVIEW", "CONFIGURED", "CANCELLED"],
  PENDING_REVIEW: ["CONFIGURED", "MANUAL_SETUP", "ON_HOLD", "CANCELLED"],
  CONFIGURED: ["PERSONALISATION", "READY_TO_ORDER", "PENDING_REVIEW", "ON_HOLD", "CANCELLED"],
  PERSONALISATION: ["READY_TO_ORDER", "CONFIGURED", "ON_HOLD", "CANCELLED"],
  READY_TO_ORDER: ["ORDERED", "CONFIGURED", "ON_HOLD", "CANCELLED"],
  ORDERED: ["AWAITING_STOCK", "ON_HOLD", "CANCELLED"],
  AWAITING_STOCK: ["IN_PRODUCTION", "ON_HOLD", "CANCELLED"],
  IN_PRODUCTION: ["QC", "ON_HOLD", "CANCELLED"],
  QC: ["COMPLETE", "IN_PRODUCTION", "ON_HOLD"],
  COMPLETE: [],
  ON_HOLD: ["DRAFT", "PENDING_REVIEW", "CONFIGURED", "PERSONALISATION", "READY_TO_ORDER", "ORDERED", "AWAITING_STOCK", "IN_PRODUCTION", "QC", "CANCELLED"],
  CANCELLED: [],
};

export async function transitionBatchStatus(
  batchId: string,
  newStatus: BatchStatus,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const batch = await prisma.productionBatch.findUnique({
    where: { id: batchId },
    select: { status: true },
  });

  if (!batch) return { success: false, error: "Batch not found" };

  const allowed = VALID_TRANSITIONS[batch.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return {
      success: false,
      error: `Cannot transition from ${batch.status} to ${newStatus}`,
    };
  }

  const updateData: Record<string, unknown> = { status: newStatus };
  if (notes) updateData.notes = notes;

  // Track timestamps for key transitions
  if (newStatus === "ORDERED") updateData.orderedAt = new Date();
  if (newStatus === "AWAITING_STOCK") updateData.stockReceivedAt = null;
  if (newStatus === "IN_PRODUCTION") updateData.productionStartedAt = new Date();
  if (newStatus === "COMPLETE") updateData.productionCompleteAt = new Date();
  if (newStatus === "CONFIGURED" || newStatus === "CANCELLED") updateData.closedAt = new Date();

  await prisma.productionBatch.update({
    where: { id: batchId },
    data: updateData,
  });

  logger.info({ batchId, from: batch.status, to: newStatus }, "Batch status transitioned");
  return { success: true };
}

// ── Batch queries ──

export interface BatchListFilter {
  accountId?: string;
  status?: BatchStatus | BatchStatus[];
  confidence?: BatchConfidence;
  decorationMethod?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listBatches(filter: BatchListFilter = {}) {
  const where: Record<string, unknown> = {};

  if (filter.accountId) where.accountId = filter.accountId;
  if (filter.status) {
    where.status = Array.isArray(filter.status)
      ? { in: filter.status }
      : filter.status;
  }
  if (filter.confidence) where.confidence = filter.confidence;
  if (filter.decorationMethod) where.decorationMethod = filter.decorationMethod;
  if (filter.search) {
    where.displayTitle = { contains: filter.search, mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    prisma.productionBatch.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, type: true } },
        items: {
          select: { id: true, size: true, quantity: true },
          orderBy: { size: "asc" },
        },
        _count: { select: { personalisations: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: filter.limit ?? 50,
      skip: filter.offset ?? 0,
    }),
    prisma.productionBatch.count({ where }),
  ]);

  return { items, total };
}

export async function getBatchDetail(batchId: string) {
  return prisma.productionBatch.findUnique({
    where: { id: batchId },
    include: {
      account: { select: { id: true, name: true, type: true } },
      decorationProfile: {
        include: {
          artworkAsset: true,
          placementConfig: true,
        },
      },
      configSnapshot: true,
      items: {
        include: {
          sourceLines: {
            include: {
              jobItem: {
                select: {
                  id: true,
                  sku: true,
                  productTitle: true,
                  variantTitle: true,
                  quantity: true,
                },
              },
              job: {
                select: {
                  id: true,
                  internalJobId: true,
                  shopifyOrderName: true,
                  customerName: true,
                },
              },
            },
          },
        },
        orderBy: { size: "asc" },
      },
      personalisations: {
        orderBy: [{ size: "asc" }, { position: "asc" }],
      },
    },
  });
}
