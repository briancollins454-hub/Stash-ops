import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { Prisma, type BatchConfidence } from "@prisma/client";

// ── Template matching for production batches ──
// Priority: ProductAssignment → DecorationProfile → ConfigSnapshot (recent) → ConfigSnapshot (most used) → manual

export interface TemplateMatch {
  decorationProfileId: string | null;
  artworkAssetId: string | null;
  placementConfigId: string | null;
  configSnapshotId: string | null;
  decorationMethod: string | null;
  confidenceScore: number;
  confidence: BatchConfidence;
  matchSource: "product_assignment" | "decoration_profile" | "config_snapshot_recent" | "config_snapshot_popular" | "manual";
  matchReasons: string[];
}

/**
 * Find the best template match for a production batch.
 * Uses the account's existing configuration hierarchy and historical data.
 */
export async function findTemplateMatch(
  accountId: string,
  normalizedProduct: string,
  colour: string | null,
  decorationMethod: string | null
): Promise<TemplateMatch> {
  const reasons: string[] = [];
  let score = 0;

  // 1. Try ProductAssignment (strongest signal — explicit product ↔ decoration mapping)
  const assignment = await prisma.productAssignment.findFirst({
    where: {
      accountId,
      active: true,
      catalogProduct: {
        name: { contains: normalizedProduct, mode: "insensitive" },
      },
      decorationProfileId: { not: null },
    },
    include: {
      decorationProfile: {
        include: { artworkAsset: true, placementConfig: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (assignment?.decorationProfile) {
    const dp = assignment.decorationProfile;
    score = 35; // base for assignment match
    reasons.push(`Product assignment matched: ${assignment.styleCode}`);

    if (dp.artworkAssetId) { score += 20; reasons.push("Artwork asset found"); }
    if (dp.placementConfigId) { score += 15; reasons.push("Placement config found"); }
    if (dp.decorationMethod) { score += 15; reasons.push(`Method: ${dp.decorationMethod}`); }

    // Check method consistency
    if (decorationMethod && dp.decorationMethod && dp.decorationMethod === decorationMethod) {
      score += 5;
      reasons.push("Decoration method matches order");
    }

    return {
      decorationProfileId: dp.id,
      artworkAssetId: dp.artworkAssetId,
      placementConfigId: dp.placementConfigId,
      configSnapshotId: null,
      decorationMethod: dp.decorationMethod,
      confidenceScore: Math.min(99, score),
      confidence: scoreToConfidence(Math.min(99, score)),
      matchSource: "product_assignment",
      matchReasons: reasons,
    };
  }

  // 2. Try DecorationProfile directly (account-level default decoration)
  const profileWhere: Record<string, unknown> = {
    accountId,
    active: true,
  };
  if (decorationMethod) profileWhere.decorationMethod = decorationMethod;

  const profile = await prisma.decorationProfile.findFirst({
    where: profileWhere,
    include: { artworkAsset: true, placementConfig: true },
    orderBy: [{ isDefault: "desc" }, { priority: "asc" }],
  });

  if (profile) {
    score = 20; // base for profile match (no product-specific binding)
    reasons.push(`Decoration profile matched: ${profile.name}`);

    if (profile.artworkAssetId) { score += 20; reasons.push("Artwork asset found"); }
    if (profile.placementConfigId) { score += 15; reasons.push("Placement config found"); }
    if (profile.isDefault) { score += 5; reasons.push("Is default profile"); }

    return {
      decorationProfileId: profile.id,
      artworkAssetId: profile.artworkAssetId,
      placementConfigId: profile.placementConfigId,
      configSnapshotId: null,
      decorationMethod: profile.decorationMethod,
      confidenceScore: Math.min(99, score),
      confidence: scoreToConfidence(Math.min(99, score)),
      matchSource: "decoration_profile",
      matchReasons: reasons,
    };
  }

  // 3. Try ConfigSnapshot — most recently approved for this product
  const recentSnapshot = await prisma.configSnapshot.findFirst({
    where: {
      accountId,
      normalizedProduct,
      ...(decorationMethod ? { decorationMethod } : {}),
      approvedAt: { not: null },
    },
    orderBy: { approvedAt: "desc" },
  });

  if (recentSnapshot) {
    score = 15;
    reasons.push("Historical config snapshot found (most recent)");

    if (recentSnapshot.artworkAssetId) { score += 20; reasons.push("Historical artwork asset"); }
    if (recentSnapshot.placementConfigId) { score += 15; reasons.push("Historical placement config"); }
    score += Math.min(10, recentSnapshot.usageCount * 2); // up to +10 for usage
    reasons.push(`Used ${recentSnapshot.usageCount} times previously`);

    return {
      decorationProfileId: null,
      artworkAssetId: recentSnapshot.artworkAssetId,
      placementConfigId: recentSnapshot.placementConfigId,
      configSnapshotId: recentSnapshot.id,
      decorationMethod: recentSnapshot.decorationMethod,
      confidenceScore: Math.min(99, score),
      confidence: scoreToConfidence(Math.min(99, score)),
      matchSource: "config_snapshot_recent",
      matchReasons: reasons,
    };
  }

  // 4. Try ConfigSnapshot — most used across the account (broader search)
  const popularSnapshot = await prisma.configSnapshot.findFirst({
    where: {
      accountId,
      approvedAt: { not: null },
    },
    orderBy: { usageCount: "desc" },
  });

  if (popularSnapshot) {
    score = 10;
    reasons.push("Fallback: most-used account config snapshot");

    if (popularSnapshot.artworkAssetId) { score += 15; reasons.push("Has artwork asset"); }
    if (popularSnapshot.placementConfigId) { score += 10; reasons.push("Has placement config"); }

    return {
      decorationProfileId: null,
      artworkAssetId: popularSnapshot.artworkAssetId,
      placementConfigId: popularSnapshot.placementConfigId,
      configSnapshotId: popularSnapshot.id,
      decorationMethod: popularSnapshot.decorationMethod,
      confidenceScore: Math.min(99, score),
      confidence: scoreToConfidence(Math.min(99, score)),
      matchSource: "config_snapshot_popular",
      matchReasons: reasons,
    };
  }

  // 5. No match — manual setup required
  reasons.push("No template, profile, or historical config found");
  return {
    decorationProfileId: null,
    artworkAssetId: null,
    placementConfigId: null,
    configSnapshotId: null,
    decorationMethod: decorationMethod ?? null,
    confidenceScore: 0,
    confidence: "MANUAL_SETUP",
    matchSource: "manual",
    matchReasons: reasons,
  };
}

/**
 * Apply template matching to a batch and update its confidence/config.
 */
export async function applyTemplateToBatch(batchId: string): Promise<TemplateMatch> {
  const batch = await prisma.productionBatch.findUnique({
    where: { id: batchId },
    select: {
      accountId: true,
      normalizedProduct: true,
      colour: true,
      decorationMethod: true,
    },
  });

  if (!batch) throw new Error(`Batch ${batchId} not found`);

  const match = await findTemplateMatch(
    batch.accountId,
    batch.normalizedProduct,
    batch.colour,
    batch.decorationMethod
  );

  await prisma.productionBatch.update({
    where: { id: batchId },
    data: {
      decorationProfileId: match.decorationProfileId,
      configSnapshotId: match.configSnapshotId,
      confidence: match.confidence,
      decorationMethod: match.decorationMethod ?? batch.decorationMethod,
      // Auto-advance from DRAFT if high confidence
      ...(match.confidence === "AUTO_CONFIGURED" && batch.accountId
        ? { status: "CONFIGURED" }
        : match.confidence === "NEEDS_REVIEW"
          ? { status: "PENDING_REVIEW" }
          : {}),
    },
  });

  logger.info(
    {
      batchId,
      source: match.matchSource,
      confidence: match.confidence,
      score: match.confidenceScore,
    },
    "Template matching applied to batch"
  );

  return match;
}

/**
 * Create a ConfigSnapshot from a batch's current configuration.
 * Called when a batch is manually configured and approved.
 */
export async function snapshotBatchConfig(
  batchId: string,
  approvedBy: string
): Promise<string> {
  const batch = await prisma.productionBatch.findUnique({
    where: { id: batchId },
    include: {
      decorationProfile: {
        include: { artworkAsset: true, placementConfig: true },
      },
    },
  });

  if (!batch) throw new Error(`Batch ${batchId} not found`);

  const snapshot = await prisma.configSnapshot.create({
    data: {
      accountId: batch.accountId,
      normalizedProduct: batch.normalizedProduct,
      decorationMethod: batch.decorationMethod ?? "unknown",
      artworkAssetId: batch.decorationProfile?.artworkAssetId ?? null,
      placementConfigId: batch.decorationProfile?.placementConfigId ?? null,
      coordinatesJson: batch.decorationProfile?.placementConfig
        ? {
            widthMm: batch.decorationProfile.placementConfig.widthMm,
            heightMm: batch.decorationProfile.placementConfig.heightMm,
            offsetXMm: batch.decorationProfile.placementConfig.offsetXMm,
            offsetYMm: batch.decorationProfile.placementConfig.offsetYMm,
            rotationDegrees: batch.decorationProfile.placementConfig.rotationDegrees,
          }
        : Prisma.JsonNull,
      colourway: batch.decorationProfile?.colourway ?? null,
      source: "manual",
      approvedAt: new Date(),
      approvedBy,
      usageCount: 1,
    },
  });

  // Link batch to this snapshot
  await prisma.productionBatch.update({
    where: { id: batchId },
    data: { configSnapshotId: snapshot.id },
  });

  logger.info({ batchId, snapshotId: snapshot.id }, "Config snapshot created from batch");
  return snapshot.id;
}

// ── Helpers ──

function scoreToConfidence(score: number): BatchConfidence {
  if (score >= 80) return "AUTO_CONFIGURED";
  if (score >= 40) return "NEEDS_REVIEW";
  return "MANUAL_SETUP";
}
