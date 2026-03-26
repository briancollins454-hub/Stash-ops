import { AssetType, ProductMatcherType, type AccountType } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { normalizeMatchToken } from "../services/shopify-order-context";

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
}

