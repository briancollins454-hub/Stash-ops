import { AccountType, MatchStatus, type Prisma } from "@prisma/client";
import type { ShopifyOrderPayload } from "./order-service";
import { extractShopifyOrderContext, normalizeMatchToken, type ShopifyOrderContext } from "./shopify-order-context";

type MatchCandidate = {
  accountId: string;
  accountKey: string;
  accountName: string;
  accountType: AccountType;
  decoCustomerId?: string | null;
  score: number;
  reasons: string[];
};

export type AccountMatchResult = {
  status: MatchStatus;
  accountId?: string;
  accountKey?: string;
  accountName?: string;
  accountType?: AccountType;
  decoCustomerId?: string | null;
  score: number;
  reason: string;
  candidates: Array<{
    accountId: string;
    accountKey: string;
    accountName: string;
    score: number;
    reasons: string[];
  }>;
  context: ShopifyOrderContext;
};

type MatchOptions = {
  autoMatchThreshold?: number;
  reviewThreshold?: number;
  decisiveLead?: number;
};

function addScore(
  scores: Map<string, MatchCandidate>,
  seed: Omit<MatchCandidate, "score" | "reasons">,
  delta: number,
  reason: string,
): void {
  const existing = scores.get(seed.accountId);
  if (existing) {
    existing.score += delta;
    existing.reasons.push(reason);
    return;
  }

  scores.set(seed.accountId, {
    ...seed,
    score: delta,
    reasons: [reason],
  });
}

function typeBoost(accountType: AccountType, context: ShopifyOrderContext): number {
  if (context.schoolName && accountType === AccountType.SCHOOL) {
    return 18;
  }
  if (context.clubName && accountType === AccountType.CLUB) {
    return 18;
  }
  if (!context.schoolName && !context.clubName && accountType === AccountType.CLIENT) {
    return 6;
  }
  return 0;
}

function parseCompanyFromPayload(payload: ShopifyOrderPayload): string | undefined {
  return (
    payload.shipping_address?.company?.trim() ||
    payload.billing_address?.company?.trim() ||
    payload.customer?.default_address?.company?.trim() ||
    undefined
  );
}

export async function runAccountMatchingEngine(
  tx: Prisma.TransactionClient,
  payload: ShopifyOrderPayload,
  options?: MatchOptions,
): Promise<AccountMatchResult> {
  const context = extractShopifyOrderContext(payload);
  const autoMatchThreshold = options?.autoMatchThreshold ?? 145;
  const reviewThreshold = options?.reviewThreshold ?? 85;
  const decisiveLead = options?.decisiveLead ?? 24;

  const tokenSet = context.candidateTokens.slice(0, 200);
  const scoreMap = new Map<string, MatchCandidate>();

  if (tokenSet.length > 0) {
    const exactAliases = await tx.accountAlias.findMany({
      where: {
        active: true,
        aliasNormalized: {
          in: tokenSet,
        },
        account: {
          active: true,
        },
      },
      include: {
        account: true,
      },
    });

    for (const alias of exactAliases) {
      const token = alias.aliasNormalized;
      const sources = context.tokenSources[token] ?? [];
      const sourceBoost =
        sources.includes("metafield") || sources.includes("note_attribute")
          ? 35
          : sources.includes("tag")
            ? 25
            : 12;

      addScore(
        scoreMap,
        {
          accountId: alias.accountId,
          accountKey: alias.account.key,
          accountName: alias.account.name,
          accountType: alias.account.type,
          decoCustomerId: alias.account.decoCustomerId,
        },
        alias.weight + sourceBoost + typeBoost(alias.account.type, context),
        `alias exact: ${alias.aliasRaw} (+${alias.weight + sourceBoost})`,
      );
    }
  }

  const fuzzyPhrases = [
    context.schoolName,
    context.clubName,
    parseCompanyFromPayload(payload),
    ...context.customIdentifiers,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .slice(0, 12);

  for (const phrase of fuzzyPhrases) {
    const normalizedPhrase = normalizeMatchToken(phrase);
    if (!normalizedPhrase || normalizedPhrase.length < 3) {
      continue;
    }

    const accounts = await tx.account.findMany({
      where: {
        active: true,
        OR: [
          {
            name: {
              contains: phrase,
              mode: "insensitive",
            },
          },
          {
            aliases: {
              some: {
                active: true,
                aliasNormalized: {
                  contains: normalizedPhrase,
                },
              },
            },
          },
        ],
      },
      include: {
        aliases: {
          where: {
            active: true,
          },
          take: 10,
        },
      },
      take: 20,
    });

    for (const account of accounts) {
      const exactAlias = account.aliases.find((alias) => alias.aliasNormalized === normalizedPhrase);
      const aliasContains = account.aliases.some((alias) => alias.aliasNormalized.includes(normalizedPhrase));
      const accountNameNormalized = normalizeMatchToken(account.name);

      let delta = 0;
      const reasons: string[] = [];

      if (exactAlias) {
        delta += exactAlias.weight + 28;
        reasons.push(`alias phrase exact: ${phrase}`);
      } else if (aliasContains) {
        delta += 40;
        reasons.push(`alias phrase partial: ${phrase}`);
      }

      if (accountNameNormalized.includes(normalizedPhrase) || normalizedPhrase.includes(accountNameNormalized)) {
        delta += 44;
        reasons.push(`account name alignment: ${phrase}`);
      }

      delta += typeBoost(account.type, context);

      if (delta > 0) {
        addScore(
          scoreMap,
          {
            accountId: account.id,
            accountKey: account.key,
            accountName: account.name,
            accountType: account.type,
            decoCustomerId: account.decoCustomerId,
          },
          delta,
          reasons.join(" | "),
        );
      }
    }
  }

  const ranked = Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const second = ranked[1];

  if (!top) {
    return {
      status: MatchStatus.UNMATCHED,
      score: 0,
      reason: "No account alias or metadata signal produced a viable match.",
      candidates: [],
      context,
    };
  }

  const lead = second ? top.score - second.score : top.score;
  if (top.score >= autoMatchThreshold && lead >= decisiveLead) {
    return {
      status: MatchStatus.AUTO_MATCHED,
      accountId: top.accountId,
      accountKey: top.accountKey,
      accountName: top.accountName,
      accountType: top.accountType,
      decoCustomerId: top.decoCustomerId,
      score: top.score,
      reason: `Auto matched with score ${top.score} (lead ${lead}).`,
      candidates: ranked.slice(0, 5).map((candidate) => ({
        accountId: candidate.accountId,
        accountKey: candidate.accountKey,
        accountName: candidate.accountName,
        score: candidate.score,
        reasons: candidate.reasons.slice(0, 8),
      })),
      context,
    };
  }

  if (top.score >= reviewThreshold) {
    return {
      status: MatchStatus.REVIEW_REQUIRED,
      accountId: top.accountId,
      accountKey: top.accountKey,
      accountName: top.accountName,
      accountType: top.accountType,
      decoCustomerId: top.decoCustomerId,
      score: top.score,
      reason: `Candidate found but requires review (score ${top.score}, lead ${lead}).`,
      candidates: ranked.slice(0, 5).map((candidate) => ({
        accountId: candidate.accountId,
        accountKey: candidate.accountKey,
        accountName: candidate.accountName,
        score: candidate.score,
        reasons: candidate.reasons.slice(0, 8),
      })),
      context,
    };
  }

  return {
    status: MatchStatus.UNMATCHED,
    score: top.score,
    reason: `Best candidate scored ${top.score}, below review threshold ${reviewThreshold}.`,
    candidates: ranked.slice(0, 5).map((candidate) => ({
      accountId: candidate.accountId,
      accountKey: candidate.accountKey,
      accountName: candidate.accountName,
      score: candidate.score,
      reasons: candidate.reasons.slice(0, 8),
    })),
    context,
  };
}

