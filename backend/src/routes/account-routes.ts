import { AssetType, ProductMatcherType, type AccountType } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { normalizeMatchToken } from "../services/shopify-order-context";
import { getAccountDecoArtwork, fetchDecoDesignImage, getDecoSessionCookies } from "../services/deco-api-service";

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

  // ── Artwork stats (must be before :accountId param route) ──
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

  app.patch("/v1/accounts/:accountId/assets/:assetId", async (request, reply) => {
    const params = z.object({ accountId: z.string(), assetId: z.string() }).parse(request.params);
    const body = z.object({
      label: z.string().min(1).optional(),
      assetType: assetTypeSchema.optional(),
      decorationMethod: z.string().optional().nullable(),
      isDefault: z.boolean().optional(),
      priority: z.coerce.number().int().optional(),
      fileUrl: z.string().optional(),
      colorway: z.string().optional().nullable(),
      active: z.boolean().optional(),
    }).parse(request.body);

    // If setting as default, unset other defaults for same account + type
    if (body.isDefault) {
      const existing = await prisma.accountAsset.findUnique({ where: { id: params.assetId } });
      if (existing) {
        await prisma.accountAsset.updateMany({
          where: { accountId: params.accountId, assetType: existing.assetType, isDefault: true, id: { not: params.assetId } },
          data: { isDefault: false },
        });
      }
    }

    const updated = await prisma.accountAsset.update({
      where: { id: params.assetId, accountId: params.accountId },
      data: {
        ...(body.label !== undefined && { label: body.label.trim() }),
        ...(body.assetType !== undefined && { assetType: body.assetType as AssetType }),
        ...(body.decorationMethod !== undefined && { decorationMethod: body.decorationMethod?.trim() || null }),
        ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.fileUrl !== undefined && { fileUrl: body.fileUrl }),
        ...(body.colorway !== undefined && { colorway: body.colorway?.trim() || null }),
        ...(body.active !== undefined && { active: body.active }),
      },
    });

    return { ok: true, data: updated };
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
          fileUrl: item.fullUrl || item.thumbnailUrl,
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
                  fileUrl: item.fullUrl || item.thumbnailUrl,
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

  // ── Debug: test artwork URL resolution for a single design ──
  app.get("/v1/accounts/debug-artwork-url", async (request) => {
    const { designId } = request.query as { designId?: string };
    if (!designId) return { error: "Pass ?designId=123" };

    // Find the asset
    const asset = await prisma.accountAsset.findFirst({
      where: { decoDesignId: designId },
      select: { id: true, label: true, fileUrl: true, account: { select: { decoCustomerId: true } } },
    });

    if (!asset) return { error: "No asset found with that decoDesignId" };

    const currentSize = asset.fileUrl?.length ?? 0;

    // Fetch design list to get URLs
    const customerIds = asset.account.decoCustomerId ? [asset.account.decoCustomerId] : [];
    const result = await getAccountDecoArtwork(customerIds);
    const match = result.items.find((i) => i.id === designId);

    if (!match) return { error: "Design not found in Deco", label: asset.label, currentSize };

    // Try to fetch both thumb and full URLs
    const cookies = await getDecoSessionCookies();
    const headers: Record<string, string> = cookies ? { Cookie: cookies } : {};

    const thumbSize = await fetch(match.thumbnailUrl, { headers, signal: AbortSignal.timeout(10_000) })
      .then((r) => r.ok ? r.arrayBuffer().then((b) => b.byteLength) : -1)
      .catch(() => -1);

    const fullSize = await fetch(match.fullUrl, { headers, signal: AbortSignal.timeout(10_000) })
      .then((r) => r.ok ? r.arrayBuffer().then((b) => b.byteLength) : -1)
      .catch(() => -1);

    // Try different URL variations
    const basePath = match.thumbnailUrl.replace(/\/thumb\d+\.\w+(\?.*)?$/, "");
    const variations: Record<string, number> = {};
    for (const suffix of ["/original.png", "/thumb500.png", "/thumb300.png", "/thumb200.png", "/full.png", "/large.png"]) {
      const url = basePath + suffix;
      const size = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) })
        .then((r) => r.ok ? r.arrayBuffer().then((b) => b.byteLength) : -1)
        .catch(() => -1);
      variations[suffix] = size;
    }

    return {
      label: asset.label,
      currentStoredSize: currentSize,
      thumbnailUrl: match.thumbnailUrl,
      fullUrl: match.fullUrl,
      thumbDownloadBytes: thumbSize,
      fullDownloadBytes: fullSize,
      urlVariations: variations,
    };
  });

  // ── Upgrade artwork quality: re-fetch full-res images from Deco for assets that have decoDesignId ──
  app.post("/v1/accounts/upgrade-artwork-quality", async (request, reply) => {
    // Step 1: Find all accounts that have Deco-imported assets
    const assetsWithAccounts = await prisma.accountAsset.findMany({
      where: {
        decoDesignId: { not: null },
        active: true,
      },
      select: {
        id: true,
        decoDesignId: true,
        label: true,
        fileUrl: true,
        accountId: true,
        account: { select: { decoCustomerId: true, name: true } },
      },
    });

    if (assetsWithAccounts.length === 0) {
      return { upgraded: 0, failed: 0, skipped: 0, total: 0, note: "No Deco-imported artwork found." };
    }

    // Step 2: Group by account and collect decoCustomerIds
    const accountMap = new Map<string, { decoCustomerIds: Set<string>; name: string }>();
    for (const a of assetsWithAccounts) {
      if (!accountMap.has(a.accountId)) {
        const ids = new Set<string>();
        if (a.account.decoCustomerId) ids.add(a.account.decoCustomerId);
        accountMap.set(a.accountId, { decoCustomerIds: ids, name: a.account.name });
      }
    }

    // Also collect related accounts (Stash Shop variants)
    for (const [accountId, info] of accountMap) {
      const baseName = info.name.replace(/^Stash Shop\s*-\s*/i, "").trim();
      const related = await prisma.account.findMany({
        where: { OR: [{ name: { contains: baseName, mode: "insensitive" } }] },
        select: { decoCustomerId: true },
      });
      for (const rel of related) {
        if (rel.decoCustomerId) info.decoCustomerIds.add(rel.decoCustomerId);
      }
    }

    // Step 3: Fetch design lists from Deco for each unique set of customer IDs
    // Build a decoDesignId → fullUrl lookup map
    const allCustomerIds = new Set<string>();
    for (const info of accountMap.values()) {
      for (const id of info.decoCustomerIds) allCustomerIds.add(id);
    }

    logger.info(`[UpgradeArtwork] Fetching design lists from Deco for ${allCustomerIds.size} customer IDs...`);
    const result = await getAccountDecoArtwork([...allCustomerIds]);
    logger.info(`[UpgradeArtwork] Found ${result.items.length} designs from Deco`);

    // Build lookup: decoDesignId → fullUrl
    const designUrlMap = new Map<string, string>();
    for (const item of result.items) {
      if (item.fullUrl) {
        designUrlMap.set(item.id, item.fullUrl);
      }
    }

    reply.raw.writeHead(200, {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
    });

    let upgraded = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Step 4: For each asset, download the full-res image and store it
    const batchSize = 5;
    for (let i = 0; i < assetsWithAccounts.length; i += batchSize) {
      const batch = assetsWithAccounts.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (asset) => {
          const fullUrl = designUrlMap.get(asset.decoDesignId!);
          if (!fullUrl) {
            skipped++;
            return false;
          }

          try {
            // Fetch the full-res image using web session cookies
            const cookies = await getDecoSessionCookies();

            const res = await fetch(fullUrl, {
              headers: cookies ? { Cookie: cookies } : {},
              signal: AbortSignal.timeout(20_000),
            });
            if (!res.ok) {
              // Try without cookies (some assets are public)
              const res2 = await fetch(fullUrl, { signal: AbortSignal.timeout(20_000) });
              if (!res2.ok) {
                skipped++;
                return false;
              }
              const contentType = res2.headers.get("content-type") || "image/png";
              const buffer = await res2.arrayBuffer();
              const dataUrl = `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;

              if (dataUrl.length <= (asset.fileUrl?.length ?? 0)) {
                skipped++;
                return false;
              }

              await prisma.accountAsset.update({
                where: { id: asset.id },
                data: { fileUrl: dataUrl },
              });
              return true;
            }

            const contentType = res.headers.get("content-type") || "image/png";
            const buffer = await res.arrayBuffer();
            const dataUrl = `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;

            // Only upgrade if the new image is actually larger
            if (dataUrl.length <= (asset.fileUrl?.length ?? 0)) {
              skipped++;
              return false;
            }

            await prisma.accountAsset.update({
              where: { id: asset.id },
              data: { fileUrl: dataUrl },
            });
            return true;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${asset.label} (${asset.id}): ${msg}`);
            failed++;
            return false;
          }
        }),
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) upgraded++;
        else if (r.status === "rejected") failed++;
      }

      const progress = { processed: Math.min(i + batchSize, assetsWithAccounts.length), total: assetsWithAccounts.length, upgraded, failed, skipped };
      reply.raw.write(JSON.stringify(progress) + "\n");

      if (i + batchSize < assetsWithAccounts.length) {
        await new Promise((r) => setTimeout(r, 300));
      }

      if ((i + batchSize) % 50 === 0 || i + batchSize >= assetsWithAccounts.length) {
        logger.info(`[UpgradeArtwork] Progress: ${Math.min(i + batchSize, assetsWithAccounts.length)}/${assetsWithAccounts.length} (${upgraded} upgraded, ${skipped} skipped, ${failed} failed)`);
      }
    }

    const finalResult = {
      upgraded, failed, skipped, total: assetsWithAccounts.length, done: true,
      designsFoundInDeco: designUrlMap.size,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    };
    reply.raw.write(JSON.stringify(finalResult) + "\n");
    reply.raw.end();
  });

}
