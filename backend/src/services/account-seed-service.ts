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
            requiresReview: false,
            reviewReason: null,
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

// ── Seed accounts from DecoCustomers ──

export type DecoAccountSeedResult = {
  created: number;
  linked: number;
  skipped: number;
  jobsUpdated: number;
  errors: number;
};

/**
 * For every DecoCustomer record that isn't already linked to an Account,
 * create a new Account (or find a fuzzy name match) and link it.
 * Also backfills sourceGroupKey/Label on Deco-sourced Jobs.
 */
export async function seedAccountsFromDecoCustomers(): Promise<DecoAccountSeedResult> {
  const result: DecoAccountSeedResult = { created: 0, linked: 0, skipped: 0, jobsUpdated: 0, errors: 0 };

  // Find DecoCustomers whose decoCustomerId is NOT yet on any Account
  const allDecoCustomers = await prisma.decoCustomer.findMany({
    orderBy: { name: "asc" },
  });

  const linkedIds = new Set(
    (await prisma.account.findMany({
      where: { decoCustomerId: { not: null } },
      select: { decoCustomerId: true },
    })).map((a) => a.decoCustomerId!),
  );

  for (const dc of allDecoCustomers) {
    if (linkedIds.has(dc.decoCustomerId)) {
      result.skipped++;
      continue;
    }

    const displayName = dc.company?.trim() || dc.name?.trim();
    if (!displayName) {
      result.skipped++;
      continue;
    }

    try {
      // Try to find existing account by fuzzy name match
      const normalized = normalizeMatchToken(displayName);
      let accountId: string | undefined;

      if (normalized && normalized.length >= 3) {
        const nameMatch = await prisma.account.findFirst({
          where: {
            active: true,
            OR: [
              { name: { equals: displayName, mode: "insensitive" } },
              { aliases: { some: { active: true, aliasNormalized: normalized } } },
            ],
          },
          select: { id: true },
        });

        if (nameMatch) {
          // Link existing account to this Deco customer
          await prisma.account.update({
            where: { id: nameMatch.id },
            data: { decoCustomerId: dc.decoCustomerId },
          });
          accountId = nameMatch.id;
          result.linked++;
          linkedIds.add(dc.decoCustomerId);
        }
      }

      if (!accountId) {
        // Create new account from Deco customer
        const key = `deco-${dc.decoCustomerId}`;
        const existing = await prisma.account.findUnique({
          where: { key },
          select: { id: true },
        });

        if (existing) {
          accountId = existing.id;
          result.skipped++;
        } else {
          const accountType = inferAccountType(displayName);
          const aliasVariants = generateAliasVariants(displayName);

          const account = await prisma.$transaction(async (tx) => {
            const created = await tx.account.create({
              data: {
                key,
                name: displayName,
                type: accountType,
                decoCustomerId: dc.decoCustomerId,
                active: true,
              },
            });

            const seen = new Set<string>();
            const aliasData = aliasVariants
              .map((v) => ({
                accountId: created.id,
                aliasRaw: v,
                aliasNormalized: normalizeMatchToken(v),
                source: "deco-seed",
                weight: 120,
                active: true,
              }))
              .filter((a) => {
                if (!a.aliasNormalized || a.aliasNormalized.length < 3 || seen.has(a.aliasNormalized)) return false;
                seen.add(a.aliasNormalized);
                return true;
              });

            if (aliasData.length > 0) {
              await tx.accountAlias.createMany({ data: aliasData, skipDuplicates: true });
            }

            return created;
          });

          accountId = account.id;
          result.created++;
          linkedIds.add(dc.decoCustomerId);
        }
      }

      // Link unmatched Deco jobs with this decoCustomerId to the account
      if (accountId) {
        const updated = await prisma.job.updateMany({
          where: {
            decoCustomerId: dc.decoCustomerId,
            accountId: null,
          },
          data: {
            accountId,
            accountMatchStatus: MatchStatus.AUTO_MATCHED,
            accountMatchScore: 200,
            accountMatchReason: `Deco customer auto-match: ${displayName}`,
          },
        });
        result.jobsUpdated += updated.count;
      }
    } catch (error) {
      result.errors++;
      logger.warn({ decoCustomerId: dc.decoCustomerId, name: displayName, err: error }, "Failed to seed account from Deco customer");
    }
  }

  return result;
}

// ── Backfill source group on Deco jobs ──

export type BackfillSourceGroupResult = {
  updated: number;
  skipped: number;
};

/**
 * For Deco-sourced jobs that have no sourceGroupKey, set it based on the
 * linked account or customerName.
 */
export async function backfillDecoJobSourceGroups(): Promise<BackfillSourceGroupResult> {
  const result: BackfillSourceGroupResult = { updated: 0, skipped: 0 };

  const jobs = await prisma.job.findMany({
    where: {
      source: "DECO",
      sourceGroupKey: null,
    },
    select: {
      id: true,
      customerName: true,
      customerCompany: true,
      decoCustomerId: true,
      accountId: true,
      account: { select: { key: true, name: true } },
    },
    take: 5000,
  });

  for (const job of jobs) {
    const label = job.account?.name ?? job.customerCompany ?? job.customerName;
    const key = job.account?.key ?? (job.decoCustomerId ? `deco-${job.decoCustomerId}` : null);

    if (!label || !key) {
      result.skipped++;
      continue;
    }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        sourceGroupKey: key,
        sourceGroupLabel: label,
        sourceGroupType: inferAccountType(label),
      },
    });
    result.updated++;
  }

  return result;
}
