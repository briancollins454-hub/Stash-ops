import {
  AccountType,
  MatchStatus,
  ProductMatcherType,
  type AccountAsset,
  type AccountPlacementConfig,
  type AccountProductRule,
  type Prisma,
} from "@prisma/client";
import type { ShopifyOrderPayload } from "./order-service";
import { runAccountMatchingEngine } from "./account-matching-engine";

type JsonObject = Record<string, unknown>;

type AccountRuleSet = {
  id: string;
  key: string;
  name: string;
  type: AccountType;
  decoCustomerId?: string | null;
  defaultDecorationMethod?: string | null;
  assets: AccountAsset[];
  placementConfigs: AccountPlacementConfig[];
  productRules: Array<
    AccountProductRule & {
      templateAsset: AccountAsset | null;
      placementConfig: AccountPlacementConfig | null;
    }
  >;
};

type RuleEvaluationContext = {
  tags: string[];
  combinedText: string;
  normalizedMetafields: Record<string, string>;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function chooseDefaultAsset(account: AccountRuleSet, decorationMethod?: string): AccountAsset | null {
  const activeAssets = account.assets.filter((asset) => asset.active);
  if (activeAssets.length === 0) {
    return null;
  }

  const scoped = decorationMethod
    ? activeAssets.filter((asset) => normalize(asset.decorationMethod) === normalize(decorationMethod))
    : activeAssets;

  const defaults = scoped.filter((asset) => asset.isDefault);
  const pool = defaults.length > 0 ? defaults : scoped;

  return pool.sort((a, b) => b.priority - a.priority)[0] ?? null;
}

function chooseDefaultPlacement(
  account: AccountRuleSet,
  decorationMethod?: string,
): AccountPlacementConfig | null {
  const activePlacements = account.placementConfigs.filter((placement) => placement.active);
  if (activePlacements.length === 0) {
    return null;
  }

  const scoped = decorationMethod
    ? activePlacements.filter(
        (placement) =>
          !placement.decorationMethod ||
          normalize(placement.decorationMethod) === normalize(decorationMethod),
      )
    : activePlacements;

  return scoped.sort((a, b) => b.priority - a.priority)[0] ?? null;
}

function ruleMatchesLineItem(
  rule: AccountProductRule,
  lineItem: {
    sku?: string | null;
    productTitle: string;
    variantTitle?: string | null;
  },
  context: RuleEvaluationContext,
): boolean {
  const sku = normalize(lineItem.sku);
  const title = normalize(`${lineItem.productTitle} ${lineItem.variantTitle ?? ""}`);
  const matcherValue = normalize(rule.matcherValue);
  const matcherKey = normalize(rule.matcherKey);

  switch (rule.matcherType) {
    case ProductMatcherType.ANY:
      return true;
    case ProductMatcherType.SKU_EXACT:
      return Boolean(sku) && sku === matcherValue;
    case ProductMatcherType.SKU_PREFIX:
      return Boolean(sku) && sku.startsWith(matcherValue);
    case ProductMatcherType.SKU_CONTAINS:
      return Boolean(sku) && sku.includes(matcherValue);
    case ProductMatcherType.TITLE_CONTAINS:
      return Boolean(title) && title.includes(matcherValue);
    case ProductMatcherType.TAG_CONTAINS:
      return context.tags.some((tag) => normalize(tag).includes(matcherValue));
    case ProductMatcherType.METAFIELD_EQUALS:
      if (!matcherKey) {
        return false;
      }
      return normalize(context.normalizedMetafields[matcherKey]) === matcherValue;
    default:
      return false;
  }
}

function pickBestRule(
  rules: AccountRuleSet["productRules"],
  lineItem: {
    sku?: string | null;
    productTitle: string;
    variantTitle?: string | null;
  },
  context: RuleEvaluationContext,
) {
  const candidates = rules
    .filter((rule) => rule.active)
    .filter((rule) => ruleMatchesLineItem(rule, lineItem, context))
    .sort((a, b) => b.priority - a.priority);

  return candidates[0] ?? null;
}

function serializeAsset(asset: AccountAsset | null) {
  if (!asset) {
    return null;
  }

  return {
    assetId: asset.id,
    label: asset.label,
    assetType: asset.assetType,
    decoDesignId: asset.decoDesignId,
    decoTemplateId: asset.decoTemplateId,
    fileUrl: asset.fileUrl,
    decorationMethod: asset.decorationMethod,
    priority: asset.priority,
  };
}

function serializePlacement(placement: AccountPlacementConfig | null) {
  if (!placement) {
    return null;
  }

  return {
    placementConfigId: placement.id,
    label: placement.label,
    placementKey: placement.placementKey,
    decorationMethod: placement.decorationMethod,
    widthMm: placement.widthMm,
    heightMm: placement.heightMm,
    offsetXMm: placement.offsetXMm,
    offsetYMm: placement.offsetYMm,
    rotationDegrees: placement.rotationDegrees,
    priority: placement.priority,
  };
}

export async function applyAccountAwareConfiguration(
  tx: Prisma.TransactionClient,
  jobId: string,
  payload: ShopifyOrderPayload,
): Promise<void> {
  const match = await runAccountMatchingEngine(tx, payload);

  const job = await tx.job.findUnique({
    where: { id: jobId },
    include: {
      items: true,
    },
  });

  if (!job) {
    throw new Error(`Job ${jobId} was not found during account preconfiguration.`);
  }

  if (!match.accountId) {
    await tx.job.update({
      where: { id: jobId },
      data: {
        accountMatchStatus: match.status,
        accountMatchScore: match.score,
        accountMatchReason: match.reason,
        requiresReview: true,
        reviewReason: "No confident account match found.",
        shopifyMetadata: {
          context: match.context,
        } satisfies JsonObject,
        preconfiguration: {
          accountMatch: {
            status: match.status,
            score: match.score,
            reason: match.reason,
            candidates: match.candidates,
          },
          recommendation: "manual_review_required",
        } satisfies JsonObject,
        preconfiguredAt: new Date(),
      },
    });

    await tx.activityLog.create({
      data: {
        jobId,
        eventType: "account.match.unmatched",
        message: "Job requires review: no account match was found.",
        payload: {
          score: match.score,
          reason: match.reason,
          candidates: match.candidates,
        } satisfies JsonObject,
      },
    });

    return;
  }

  const account = await tx.account.findUnique({
    where: {
      id: match.accountId,
    },
    include: {
      assets: true,
      placementConfigs: true,
      productRules: {
        include: {
          templateAsset: true,
          placementConfig: true,
        },
      },
    },
  });

  if (!account || !account.active) {
    await tx.job.update({
      where: { id: jobId },
      data: {
        accountMatchStatus: MatchStatus.REVIEW_REQUIRED,
        accountMatchScore: match.score,
        accountMatchReason: `Matched account ${match.accountName ?? match.accountId} is inactive or missing.`,
        requiresReview: true,
        reviewReason: "Matched account is inactive or not configured.",
      },
    });
    return;
  }

  const accountRuleSet: AccountRuleSet = {
    id: account.id,
    key: account.key,
    name: account.name,
    type: account.type,
    decoCustomerId: account.decoCustomerId,
    defaultDecorationMethod: account.defaultDecorationMethod,
    assets: account.assets,
    placementConfigs: account.placementConfigs,
    productRules: account.productRules,
  };

  const context: RuleEvaluationContext = {
    tags: match.context.tags,
    combinedText: match.context.combinedText,
    normalizedMetafields: match.context.normalizedMetafields,
  };

  const lineRecommendations = job.items.map((lineItem) => {
    const matchedRule = pickBestRule(accountRuleSet.productRules, lineItem, context);
    const decorationMethod =
      matchedRule?.decorationMethod ?? accountRuleSet.defaultDecorationMethod ?? lineItem.decorationMethod ?? "embroidery";
    const chosenAsset =
      matchedRule?.templateAsset ?? chooseDefaultAsset(accountRuleSet, decorationMethod);
    const chosenPlacement =
      matchedRule?.placementConfig ?? chooseDefaultPlacement(accountRuleSet, decorationMethod);

    const lineReviewReasons: string[] = [];
    if (!matchedRule) {
      lineReviewReasons.push("No account product rule matched this line item.");
    }
    if (!chosenAsset) {
      lineReviewReasons.push("No default account logo/template asset found.");
    }
    if (!chosenPlacement) {
      lineReviewReasons.push("No placement configuration found.");
    }
    if (matchedRule?.requireReview) {
      lineReviewReasons.push("Matched rule explicitly requires manual review.");
    }

    const reviewRequired = lineReviewReasons.length > 0;
    const confidenceScore = Math.min(
      99,
      30 +
        (matchedRule ? 28 : 0) +
        (chosenAsset ? 22 : 0) +
        (chosenPlacement ? 16 : 0) +
        (match.status === MatchStatus.AUTO_MATCHED ? 16 : 6),
    );

    return {
      orderLineItemId: lineItem.id,
      sku: lineItem.sku,
      productTitle: lineItem.productTitle,
      variantTitle: lineItem.variantTitle,
      quantity: lineItem.quantity,
      decorationMethod,
      matchedRuleId: matchedRule?.id ?? null,
      matchedRulePriority: matchedRule?.priority ?? null,
      ruleMatcherType: matchedRule?.matcherType ?? null,
      asset: serializeAsset(chosenAsset),
      placement: serializePlacement(chosenPlacement),
      confidenceScore,
      reviewRequired,
      reviewReasons: lineReviewReasons,
    };
  });

  const allReviewReasons = lineRecommendations.flatMap((line) => line.reviewReasons);
  const requiresReview =
    match.status !== MatchStatus.AUTO_MATCHED ||
    lineRecommendations.some((line) => line.reviewRequired);

  const decoLinkage = {
    decoCustomerId: accountRuleSet.decoCustomerId,
    assetDesignIds: lineRecommendations
      .map((line) => line.asset?.decoDesignId)
      .filter((value): value is string => Boolean(value)),
    assetTemplateIds: lineRecommendations
      .map((line) => line.asset?.decoTemplateId)
      .filter((value): value is string => Boolean(value)),
  };

  await tx.job.update({
    where: {
      id: jobId,
    },
    data: {
      accountId: accountRuleSet.id,
      accountMatchStatus: match.status,
      accountMatchScore: match.score,
      accountMatchReason: match.reason,
      requiresReview,
      reviewReason: requiresReview
        ? allReviewReasons.slice(0, 4).join(" | ") || "Account match requires manual confirmation."
        : null,
      shopifyMetadata: {
        context: match.context,
      } satisfies JsonObject,
      preconfiguration: {
        matchedAccount: {
          accountId: accountRuleSet.id,
          accountKey: accountRuleSet.key,
          name: accountRuleSet.name,
          type: accountRuleSet.type,
          decoCustomerId: accountRuleSet.decoCustomerId,
        },
        accountMatch: {
          status: match.status,
          score: match.score,
          reason: match.reason,
          candidates: match.candidates,
        },
        lineRecommendations,
        decoLinkage,
        readyForDecoPush: !requiresReview && Boolean(accountRuleSet.decoCustomerId),
      } satisfies JsonObject,
      preconfiguredAt: new Date(),
    },
  });

  await tx.activityLog.createMany({
    data: [
      {
        jobId,
        eventType: "account.match.completed",
        message: `Job matched to account ${accountRuleSet.name} (${match.status}).`,
        payload: {
          status: match.status,
          score: match.score,
          reason: match.reason,
          candidates: match.candidates,
        } satisfies JsonObject,
      },
      {
        jobId,
        eventType: requiresReview ? "preconfiguration.review_required" : "preconfiguration.completed",
        message: requiresReview
          ? "Preconfiguration created, but manual review is required before Deco handoff."
          : "Preconfiguration generated from account templates and placement rules.",
        payload: {
          requiresReview,
          lineCount: lineRecommendations.length,
          decoCustomerId: accountRuleSet.decoCustomerId,
        } satisfies JsonObject,
      },
    ],
  });
}
