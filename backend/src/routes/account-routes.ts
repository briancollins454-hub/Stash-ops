import { AssetType, ProductMatcherType, type AccountType } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { normalizeMatchToken } from "../services/shopify-order-context";
import { getAccountDecoArtwork } from "../services/deco-api-service";

const accountTypeSchema = z.enum(["SCHOOL", "CLUB", "CLIENT", "OTHER"]);
const assetTypeSchema = z.enum(["LOGO", "TEMPLATE", "DESIGN_REFERENCE", "PROOF"]);
const matcherTypeSchema = z.enum([
  "ANY",
  "SKU_EXACT",
  "SKU_PREFIX",
  "SKU_CONTAINS",
  "TITLE_CONTAINS",
  "TAG_CONTAINS",
  "METAFIELD_EQUALS",
]);

const createAccountSchema = z.object({
  key: z.string().min(2),
  name: z.string().min(2),
  type: accountTypeSchema.optional().default("CLIENT"),
  decoCustomerId: z.string().optional(),
  defaultDecorationMethod: z.string().optional(),
  notes: z.string().optional(),
  aliases: z.array(z.string().min(2)).optional().default([]),
});

const createAssetSchema = z.object({
  assetType: assetTypeSchema,
  label: z.string().min(2),
  decoDesignId: z.string().optional(),
  decoTemplateId: z.string().optional(),
  fileUrl: z.string().url().optional(),
  colorway: z.string().optional(),
  decorationMethod: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
  priority: z.coerce.number().int().optional().default(100),
});

const createPlacementSchema = z.object({
  label: z.string().min(2),
  placementKey: z.string().min(2),
  decorationMethod: z.string().optional(),
  widthMm: z.coerce.number().optional(),
  heightMm: z.coerce.number().optional(),
  offsetXMm: z.coerce.number().optional(),
  offsetYMm: z.coerce.number().optional(),
  rotationDegrees: z.coerce.number().optional(),
  priority: z.coerce.number().int().optional().default(100),
});

const createRuleSchema = z.object({
  matcherType: matcherTypeSchema,
  matcherKey: z.string().optional(),
  matcherValue: z.string().min(1),
  priority: z.coerce.number().int().optional().default(100),
  decorationMethod: z.string().optional(),
  templateAssetId: z.string().optional(),
  placementConfigId: z.string().optional(),
  requireReview: z.boolean().optional().default(false),
});

function mapAccountType(value: z.infer<typeof accountTypeSchema>): AccountType {
  return value as AccountType;
}

export async function registerAccountRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/accounts", async () => {
    const accounts = await prisma.account.findMany({
      include: {
        aliases: true,
        assets: true,
        placementConfigs: true,
        productRules: true,
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });

    return {
      total: accounts.length,
      items: accounts.map((account) => ({
        ...account,
        counts: {
          aliases: account.aliases.length,
          assets: account.assets.length,
          placementConfigs: account.placementConfigs.length,
          productRules: account.productRules.length,
        },
      })),
    };
  });

  app.get("/v1/accounts/:accountId", async (request, reply) => {
    const params = z
      .object({
        accountId: z.string(),
      })
      .parse(request.params);

    const account = await prisma.account.findUnique({
      where: { id: params.accountId },
      include: {
        aliases: true,
        assets: true,
        placementConfigs: true,
        productRules: {
          include: {
            templateAsset: true,
            placementConfig: true,
          },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!account) {
      reply.status(404);
      return { error: "Account not found." };
    }

    return { data: account };
  });

  app.post("/v1/accounts", async (request, reply) => {
    const body = createAccountSchema.parse(request.body);

    const created = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          key: body.key.trim(),
          name: body.name.trim(),
          type: mapAccountType(body.type),
          decoCustomerId: body.decoCustomerId?.trim() || undefined,
          defaultDecorationMethod: body.defaultDecorationMethod?.trim() || undefined,
          notes: body.notes?.trim() || undefined,
        },
      });

      if (body.aliases.length > 0) {
        await tx.accountAlias.createMany({
          data: body.aliases.map((alias) => ({
            accountId: account.id,
            aliasRaw: alias.trim(),
            aliasNormalized: normalizeMatchToken(alias),
            source: "manual",
            weight: 120,
          })),
          skipDuplicates: true,
        });
      }

      return account;
    });

    reply.status(201);
    return {
      ok: true,
      data: created,
    };
  });

  app.post("/v1/accounts/:accountId/aliases", async (request, reply) => {
    const params = z
      .object({
        accountId: z.string(),
      })
      .parse(request.params);
    const body = z
      .object({
        alias: z.string().min(2),
        weight: z.coerce.number().int().min(1).max(500).optional().default(120),
        source: z.string().optional().default("manual"),
      })
      .parse(request.body);

    const created = await prisma.accountAlias.create({
      data: {
        accountId: params.accountId,
        aliasRaw: body.alias.trim(),
        aliasNormalized: normalizeMatchToken(body.alias),
        source: body.source,
        weight: body.weight,
      },
    });

    reply.status(201);
    return { ok: true, data: created };
  });

  app.get("/v1/accounts/:accountId/assets", async (request, reply) => {
    const params = z.object({ accountId: z.string() }).parse(request.params);

    const assets = await prisma.accountAsset.findMany({
      where: { accountId: params.accountId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return { data: assets };
  });

  app.post("/v1/accounts/:accountId/assets", async (request, reply) => {
    const params = z
      .object({
        accountId: z.string(),
      })
      .parse(request.params);
    const body = createAssetSchema.parse(request.body);

    const created = await prisma.accountAsset.create({
      data: {
        accountId: params.accountId,
        assetType: body.assetType as AssetType,
        label: body.label.trim(),
        decoDesignId: body.decoDesignId?.trim() || undefined,
        decoTemplateId: body.decoTemplateId?.trim() || undefined,
        fileUrl: body.fileUrl,
        colorway: body.colorway?.trim() || undefined,
        decorationMethod: body.decorationMethod?.trim() || undefined,
        isDefault: body.isDefault,
        priority: body.priority,
      },
    });

    reply.status(201);
    return { ok: true, data: created };
  });

  app.post("/v1/accounts/:accountId/placement-configs", async (request, reply) => {
    const params = z
      .object({
        accountId: z.string(),
      })
      .parse(request.params);
    const body = createPlacementSchema.parse(request.body);

    const created = await prisma.accountPlacementConfig.create({
      data: {
        accountId: params.accountId,
        label: body.label.trim(),
        placementKey: body.placementKey.trim(),
        decorationMethod: body.decorationMethod?.trim() || undefined,
        widthMm: body.widthMm,
        heightMm: body.heightMm,
        offsetXMm: body.offsetXMm,
        offsetYMm: body.offsetYMm,
        rotationDegrees: body.rotationDegrees,
        priority: body.priority,
      },
    });

    reply.status(201);
    return { ok: true, data: created };
  });

  app.post("/v1/accounts/:accountId/product-rules", async (request, reply) => {
    const params = z
      .object({
        accountId: z.string(),
      })
      .parse(request.params);
    const body = createRuleSchema.parse(request.body);

    const created = await prisma.accountProductRule.create({
      data: {
        accountId: params.accountId,
        matcherType: body.matcherType as ProductMatcherType,
        matcherKey: body.matcherKey ? body.matcherKey.trim().toLowerCase() : undefined,
        matcherValue: body.matcherValue.trim(),
        priority: body.priority,
        decorationMethod: body.decorationMethod?.trim() || undefined,
        templateAssetId: body.templateAssetId,
        placementConfigId: body.placementConfigId,
        requireReview: body.requireReview,
      },
    });

    reply.status(201);
    return { ok: true, data: created };
  });

  app.delete("/v1/accounts/:accountId/assets/:assetId", async (request, reply) => {
    const params = z
      .object({
        accountId: z.string(),
        assetId: z.string(),
      })
      .parse(request.params);

    await prisma.accountAsset.deleteMany({
      where: { id: params.assetId, accountId: params.accountId },
    });

    return { ok: true };
  });

  app.get("/v1/accounts/:accountId/deco-artwork", async (request, reply) => {
    const params = z
      .object({
        accountId: z.string(),
      })
      .parse(request.params);

    const account = await prisma.account.findUnique({
      where: { id: params.accountId },
      select: { id: true, decoCustomerId: true, name: true },
    });

    if (!account) {
      reply.status(404);
      return { error: "Account not found." };
    }

    // Find all related account IDs (this account + Stash Shop variants)
    const baseName = account.name.replace(/^Stash Shop\s*-\s*/i, "").trim();
    const relatedAccounts = await prisma.account.findMany({
      where: {
        OR: [
          { name: { contains: baseName, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, decoCustomerId: true },
    });

    // Collect all unique Deco customer IDs from this account and related accounts
    const decoCustomerIds = new Set<string>();
    if (account.decoCustomerId) decoCustomerIds.add(account.decoCustomerId);
    for (const rel of relatedAccounts) {
      const relBase = rel.name.replace(/^Stash Shop\s*-\s*/i, "").trim();
      if (relBase.toLowerCase() === baseName.toLowerCase() && rel.decoCustomerId) {
        decoCustomerIds.add(rel.decoCustomerId);
      }
    }

    if (decoCustomerIds.size === 0) {
      return {
        items: [],
        note: "No Deco customer IDs found for this account.",
      };
    }

    const result = await getAccountDecoArtwork([...decoCustomerIds]);
    return result;
  });

  // ── Import Deco artwork as permanent AccountAsset records ──
  app.post("/v1/accounts/:accountId/import-deco-artwork", async (request, reply) => {
    const params = z.object({ accountId: z.string() }).parse(request.params);

    const account = await prisma.account.findUnique({
      where: { id: params.accountId },
      select: { id: true, decoCustomerId: true, name: true },
    });
    if (!account) {
      reply.status(404);
      return { error: "Account not found." };
    }

    // Gather Deco customer IDs (this account + related Stash Shop variants)
    const baseName = account.name.replace(/^Stash Shop\s*-\s*/i, "").trim();
    const relatedAccounts = await prisma.account.findMany({
      where: { OR: [{ name: { contains: baseName, mode: "insensitive" } }] },
      select: { id: true, name: true, decoCustomerId: true },
    });
    const decoCustomerIds = new Set<string>();
    if (account.decoCustomerId) decoCustomerIds.add(account.decoCustomerId);
    for (const rel of relatedAccounts) {
      const relBase = rel.name.replace(/^Stash Shop\s*-\s*/i, "").trim();
      if (relBase.toLowerCase() === baseName.toLowerCase() && rel.decoCustomerId) {
        decoCustomerIds.add(rel.decoCustomerId);
      }
    }

    if (decoCustomerIds.size === 0) {
      return { imported: 0, skipped: 0, note: "No Deco customer IDs found." };
    }

    // Fetch designs from Deco
    const result = await getAccountDecoArtwork([...decoCustomerIds]);
    if (!result.items.length) {
      return { imported: 0, skipped: 0, note: "No designs found in Deco." };
    }

    // Check which decoDesignIds already exist as AccountAssets
    const existing = await prisma.accountAsset.findMany({
      where: { accountId: params.accountId, decoDesignId: { in: result.items.map((i) => i.id) } },
      select: { decoDesignId: true },
    });
    const existingIds = new Set(existing.map((e) => e.decoDesignId));

    let imported = 0;
    let skipped = 0;
    for (const item of result.items) {
      if (existingIds.has(item.id)) {
        skipped++;
        continue;
      }
      await prisma.accountAsset.create({
        data: {
          accountId: params.accountId,
          assetType: "LOGO" as AssetType,
          label: item.name,
          decoDesignId: item.id,
          fileUrl: item.thumbnailUrl,
          active: true,
          priority: 100,
        },
      });
      imported++;
    }

    return { imported, skipped, total: result.items.length };
  });

  // ── Bulk import Deco artwork for ALL accounts ──
  app.post("/v1/accounts/bulk-import-deco-artwork", async (request, reply) => {
    // Find all accounts that have a decoCustomerId
    const accounts = await prisma.account.findMany({
      where: { decoCustomerId: { not: null } },
      select: { id: true, name: true, decoCustomerId: true },
    });

    if (accounts.length === 0) {
      return { accountsProcessed: 0, accountsWithArtwork: 0, totalImported: 0, totalSkipped: 0, note: "No accounts with Deco customer IDs found." };
    }

    // De-duplicate: group accounts by their unique decoCustomerId to avoid fetching duplicates
    const customerIdToAccounts = new Map<string, typeof accounts>();
    for (const acct of accounts) {
      const cid = acct.decoCustomerId!;
      const list = customerIdToAccounts.get(cid) ?? [];
      list.push(acct);
      customerIdToAccounts.set(cid, list);
    }

    let accountsProcessed = 0;
    let accountsWithArtwork = 0;
    let totalImported = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    // Process unique customer IDs in batches of 5 to avoid hammering Deco
    const customerIds = [...customerIdToAccounts.keys()];
    const batchSize = 5;

    for (let i = 0; i < customerIds.length; i += batchSize) {
      const batch = customerIds.slice(i, i + batchSize);

      for (const customerId of batch) {
        try {
          const result = await getAccountDecoArtwork([customerId]);
          const linkedAccounts = customerIdToAccounts.get(customerId)!;

          for (const acct of linkedAccounts) {
            accountsProcessed++;

            if (!result.items.length) continue;
            accountsWithArtwork++;

            // Check existing assets for this account
            const existing = await prisma.accountAsset.findMany({
              where: { accountId: acct.id, decoDesignId: { in: result.items.map((it) => it.id) } },
              select: { decoDesignId: true },
            });
            const existingIds = new Set(existing.map((e) => e.decoDesignId));

            for (const item of result.items) {
              if (existingIds.has(item.id)) {
                totalSkipped++;
                continue;
              }
              await prisma.accountAsset.create({
                data: {
                  accountId: acct.id,
                  assetType: "LOGO" as AssetType,
                  label: item.name,
                  decoDesignId: item.id,
                  fileUrl: item.thumbnailUrl,
                  active: true,
                  priority: 100,
                },
              });
              totalImported++;
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(`[BulkDecoImport] Error for customer ${customerId}: ${msg}`);
          errors.push(`Customer ${customerId}: ${msg}`);
        }
      }

      // Small delay between batches to be polite to Deco
      if (i + batchSize < customerIds.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return {
      accountsProcessed,
      accountsWithArtwork,
      totalImported,
      totalSkipped,
      uniqueDecoCustomers: customerIds.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  });

  // ── Archive artwork images: download external URLs and store as base64 data URLs ──
  app.post("/v1/accounts/archive-artwork-images", async (request, reply) => {
    // Find all assets with external URLs (not data URLs, not empty)
    const assets = await prisma.accountAsset.findMany({
      where: {
        fileUrl: { startsWith: "http" },
      },
      select: { id: true, fileUrl: true, label: true },
    });

    if (assets.length === 0) {
      return { archived: 0, failed: 0, total: 0, note: "No external image URLs to archive." };
    }

    let archived = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process in batches of 10
    const batchSize = 10;
    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (asset) => {
          try {
            const res = await fetch(asset.fileUrl!, {
              signal: AbortSignal.timeout(15_000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const contentType = res.headers.get("content-type") || "image/png";
            const buffer = await res.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const dataUrl = `data:${contentType};base64,${base64}`;

            await prisma.accountAsset.update({
              where: { id: asset.id },
              data: { fileUrl: dataUrl },
            });

            return true;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${asset.label} (${asset.id}): ${msg}`);
            return false;
          }
        }),
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) archived++;
        else failed++;
      }

      // Small delay between batches
      if (i + batchSize < assets.length) {
        await new Promise((r) => setTimeout(r, 200));
      }

      // Log progress
      if ((i + batchSize) % 100 === 0 || i + batchSize >= assets.length) {
        logger.info(`[ArchiveArtwork] Progress: ${Math.min(i + batchSize, assets.length)}/${assets.length} (${archived} archived, ${failed} failed)`);
      }
    }

    return {
      archived,
      failed,
      total: assets.length,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    };
  });

  // ── Artwork stats ──
  app.get("/v1/accounts/artwork-stats", async () => {
    const [total, archived, external, accountsWithArtwork] = await Promise.all([
      prisma.accountAsset.count(),
      prisma.accountAsset.count({ where: { fileUrl: { startsWith: "data:" } } }),
      prisma.accountAsset.count({ where: { fileUrl: { startsWith: "http" } } }),
      prisma.accountAsset.groupBy({ by: ["accountId"], _count: true }).then((g) => g.length),
    ]);

    return {
      totalAssets: total,
      archived,
      external,
      noImage: total - archived - external,
      accountsWithArtwork,
    };
  });
}
