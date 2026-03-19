import { AccountType, MatchStatus, type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { normalizeMatchToken } from "./shopify-order-context";
import { runAccountMatchingEngine } from "./account-matching-engine";
import type { ShopifyOrderPayload } from "./order-service";

// ── Account type inference ──

function inferAccountType(label: string): AccountType {
  const lower = label.toLowerCase();
  if (/\b(school|academy|college|primary|grammar|high school|ps|prep|secondary|campus)\b/.test(lower)) {
    return AccountType.SCHOOL;
  }
  if (/\b(club|fc|rfc|cc|afc|rugby|hockey|cricket|swim|yfc|netball|volleyball|athletics|gaa|boxing|tennis|bb|team|sport)\b/.test(lower)) {
    return AccountType.CLUB;
  }
  return AccountType.CLIENT;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build extra alias variants from a source group label:
 *   "Ballyclare High School Leavers" → also generates
 *   "Ballyclare High School", "Ballyclare High"
 */
function generateAliasVariants(label: string): string[] {
  const variants: string[] = [label];
  const lower = label.toLowerCase();

  // Strip trailing "leavers 2025", "leavers", "shop", "staff" etc.
  const stripped = label
    .replace(/\s+(leavers|staff|shop|store|athletics vest)\s*\d*/i, "")
    .trim();
  if (stripped && stripped.toLowerCase() !== lower) {
    variants.push(stripped);
  }

  // Strip further trailing year
  const noYear = stripped.replace(/\s+\d{4}$/, "").trim();
  if (noYear && noYear !== stripped) {
    variants.push(noYear);
  }

  return variants;
}

// ── Seed accounts from existing jobs ──

export type AccountSeedResult = {
  created: number;
  skipped: number;
  aliases: number;
  errors: number;
};

/**
 * Scans all jobs in the database, extracts unique sourceGroupLabel values,
 * and creates Account + AccountAlias records for each one that doesn't
 * already exist.
 */
export async function seedAccountsFromJobs(): Promise<AccountSeedResult> {
  const result: AccountSeedResult = { created: 0, skipped: 0, aliases: 0, errors: 0 };

  // Get all distinct source groups from jobs
  const groups = await prisma.job.groupBy({
    by: ["sourceGroupKey", "sourceGroupLabel"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  for (const group of groups) {
    const label = group.sourceGroupLabel?.trim();
    const key = group.sourceGroupKey?.trim();

    if (!label || !key || key === "unassigned" || label === "Unassigned") {
      result.skipped++;
      continue;
    }

    try {
      // Check if account with this key already exists
      const existing = await prisma.account.findUnique({
        where: { key },
        select: { id: true },
      });

      if (existing) {
        result.skipped++;
        continue;
      }

      // Also check by normalized alias to avoid duplicates
      const normalizedLabel = normalizeMatchToken(label);
      const existingAlias = await prisma.accountAlias.findFirst({
        where: { aliasNormalized: normalizedLabel, active: true },
        select: { accountId: true },
      });

      if (existingAlias) {
        result.skipped++;
        continue;
      }

      const accountType = inferAccountType(label);
      const aliasVariants = generateAliasVariants(label);

      await prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            key,
            name: label,
            type: accountType,
            active: true,
          },
        });

        const aliasData = aliasVariants.map((variant) => ({
          accountId: account.id,
          aliasRaw: variant,
          aliasNormalized: normalizeMatchToken(variant),
          source: "auto-seed",
          weight: 120,
          active: true,
        }));

        // Deduplicate by normalized form
        const seen = new Set<string>();
        const uniqueAliases = aliasData.filter((a) => {
          if (!a.aliasNormalized || a.aliasNormalized.length < 3 || seen.has(a.aliasNormalized)) {
            return false;
          }
          seen.add(a.aliasNormalized);
          return true;
        });

        if (uniqueAliases.length > 0) {
          await tx.accountAlias.createMany({
            data: uniqueAliases,
            skipDuplicates: true,
          });
          result.aliases += uniqueAliases.length;
        }

        // Link existing jobs with this sourceGroupKey to the new account
        await tx.job.updateMany({
          where: { sourceGroupKey: key, accountId: null },
          data: {
            accountId: account.id,
            accountMatchStatus: MatchStatus.AUTO_MATCHED,
            accountMatchScore: 200,
            accountMatchReason: `Auto-matched via source group key: ${key}`,
          },
        });
      });

      result.created++;
      logger.info({ key, label, type: accountType }, "Seeded account from source group");
    } catch (error) {
      result.errors++;
      logger.warn({ key, label, err: error }, "Failed to seed account from source group");
    }
  }

  return result;
}

// ── Re-match unmatched jobs ──

export type RematchResult = {
  total: number;
  matched: number;
  reviewRequired: number;
  unmatched: number;
  errors: number;
};

/**
 * For all UNMATCHED jobs, try to match against account aliases using
 * the sourceGroupLabel and then the full Shopify-style matching engine.
 */
export async function rematchUnmatchedJobs(): Promise<RematchResult> {
  const result: RematchResult = {
    total: 0,
    matched: 0,
    reviewRequired: 0,
    unmatched: 0,
    errors: 0,
  };

  const unmatchedJobs = await prisma.job.findMany({
    where: {
      accountId: null,
      lifecycle: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    select: {
      id: true,
      internalJobId: true,
      sourceGroupKey: true,
      sourceGroupLabel: true,
      customerName: true,
      customerCompany: true,
      customerEmail: true,
      tags: true,
      shopifyMetadata: true,
    },
    take: 1000,
  });

  result.total = unmatchedJobs.length;

  for (const job of unmatchedJobs) {
    try {
      // Step 1: Try direct sourceGroupKey match
      if (job.sourceGroupKey && job.sourceGroupKey !== "unassigned") {
        const account = await prisma.account.findUnique({
          where: { key: job.sourceGroupKey },
          select: { id: true },
        });

        if (account) {
          await prisma.job.update({
            where: { id: job.id },
            data: {
              accountId: account.id,
              accountMatchStatus: MatchStatus.AUTO_MATCHED,
              accountMatchScore: 200,
              accountMatchReason: `Direct source group key match: ${job.sourceGroupKey}`,
            },
          });
          result.matched++;
          continue;
        }
      }

      // Step 2: Try alias match on sourceGroupLabel
      if (job.sourceGroupLabel) {
        const normalized = normalizeMatchToken(job.sourceGroupLabel);
        if (normalized && normalized.length >= 3) {
          const aliasMatch = await prisma.accountAlias.findFirst({
            where: {
              active: true,
              aliasNormalized: normalized,
            },
            select: { accountId: true },
          });

          if (aliasMatch) {
            await prisma.job.update({
              where: { id: job.id },
              data: {
                accountId: aliasMatch.accountId,
                accountMatchStatus: MatchStatus.AUTO_MATCHED,
                accountMatchScore: 180,
                accountMatchReason: `Alias match on sourceGroupLabel: ${job.sourceGroupLabel}`,
              },
            });
            result.matched++;
            continue;
          }

          // Try partial/fuzzy match on account name
          const nameMatch = await prisma.account.findFirst({
            where: {
              active: true,
              OR: [
                { name: { contains: job.sourceGroupLabel, mode: "insensitive" } },
                { aliases: { some: { active: true, aliasNormalized: { contains: normalized } } } },
              ],
            },
            select: { id: true, name: true },
          });

          if (nameMatch) {
            await prisma.job.update({
              where: { id: job.id },
              data: {
                accountId: nameMatch.id,
                accountMatchStatus: MatchStatus.AUTO_MATCHED,
                accountMatchScore: 150,
                accountMatchReason: `Fuzzy name match: "${job.sourceGroupLabel}" → "${nameMatch.name}"`,
              },
            });
            result.matched++;
            continue;
          }
        }
      }

      // Step 3: Try the full Shopify matching engine if we have metadata
      const meta = job.shopifyMetadata as Record<string, unknown> | null;
      if (meta) {
        const syntheticPayload: ShopifyOrderPayload = {
          tags: (meta.shopifyTags as string[] | undefined)?.join(", "),
          note: meta.shopifyNote as string | null,
          customer: {
            first_name: job.customerName?.split(" ")[0] ?? null,
            last_name: job.customerName?.split(" ").slice(1).join(" ") ?? null,
            email: job.customerEmail ?? null,
          },
          shipping_address: {
            company: job.customerCompany ?? null,
          },
        };

        const matchResult = await prisma.$transaction((tx) =>
          runAccountMatchingEngine(tx, syntheticPayload),
        );

        if (matchResult.status === MatchStatus.AUTO_MATCHED && matchResult.accountId) {
          await prisma.job.update({
            where: { id: job.id },
            data: {
              accountId: matchResult.accountId,
              accountMatchStatus: matchResult.status,
              accountMatchScore: matchResult.score,
              accountMatchReason: matchResult.reason,
            },
          });
          result.matched++;
          continue;
        }

        if (matchResult.status === MatchStatus.REVIEW_REQUIRED && matchResult.accountId) {
          await prisma.job.update({
            where: { id: job.id },
            data: {
              accountId: matchResult.accountId,
              accountMatchStatus: matchResult.status,
              accountMatchScore: matchResult.score,
              accountMatchReason: matchResult.reason,
              requiresReview: true,
              reviewReason: matchResult.reason,
            },
          });
          result.reviewRequired++;
          continue;
        }
      }

      result.unmatched++;
    } catch (error) {
      result.errors++;
      logger.warn({ jobId: job.id, err: error }, "Error re-matching job");
    }
  }

  return result;
}
