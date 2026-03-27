import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

const createProfileSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(2),
  decorationMethod: z.string().min(1),
  artworkAssetId: z.string().optional(),
  placementConfigId: z.string().optional(),
  colourway: z.string().optional(),
  notes: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
  priority: z.coerce.number().int().optional().default(100),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  decorationMethod: z.string().min(1).optional(),
  artworkAssetId: z.string().nullable().optional(),
  placementConfigId: z.string().nullable().optional(),
  colourway: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  priority: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
});

export async function registerDecorationProfileRoutes(app: FastifyInstance): Promise<void> {
  // List profiles (optionally filtered by accountId)
  app.get("/v1/decoration-profiles", async (req, reply) => {
    const { accountId } = req.query as { accountId?: string };
    const where: Record<string, unknown> = {};
    if (accountId) where.accountId = accountId;

    const profiles = await prisma.decorationProfile.findMany({
      where,
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
        artworkAsset: { select: { id: true, label: true, assetType: true, fileUrl: true } },
        placementConfig: { select: { id: true, label: true, placementKey: true, decorationMethod: true } },
        _count: { select: { productAssignments: true, jobItems: true } },
      },
      orderBy: [{ account: { name: "asc" } }, { priority: "desc" }, { name: "asc" }],
    });
    return reply.send(profiles);
  });

  // Get single profile
  app.get("/v1/decoration-profiles/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const profile = await prisma.decorationProfile.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
        artworkAsset: { select: { id: true, label: true, assetType: true, fileUrl: true, decoDesignId: true } },
        placementConfig: true,
        productAssignments: {
          include: {
            catalogProduct: { select: { styleCode: true, brand: true, name: true, primaryImageUrl: true } },
            storefront: { select: { id: true, name: true, type: true } },
          },
        },
        _count: { select: { jobItems: true } },
      },
    });
    if (!profile) return reply.status(404).send({ error: "Decoration profile not found" });
    return reply.send(profile);
  });

  // Create profile
  app.post("/v1/decoration-profiles", async (req, reply) => {
    const parsed = createProfileSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { accountId, ...rest } = parsed.data;

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return reply.status(404).send({ error: "Account not found" });

    // If marking as default, unset other defaults for this account+method
    if (rest.isDefault) {
      await prisma.decorationProfile.updateMany({
        where: { accountId, decorationMethod: rest.decorationMethod, isDefault: true },
        data: { isDefault: false },
      });
    }

    const profile = await prisma.decorationProfile.create({
      data: { accountId, ...rest },
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
        artworkAsset: { select: { id: true, label: true, assetType: true, fileUrl: true } },
        placementConfig: { select: { id: true, label: true, placementKey: true } },
      },
    });

    logger.info({ profileId: profile.id, accountId }, "Decoration profile created");
    return reply.status(201).send(profile);
  });

  // Update profile
  app.patch("/v1/decoration-profiles/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const existing = await prisma.decorationProfile.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Decoration profile not found" });

    // If marking as default, unset other defaults
    if (parsed.data.isDefault) {
      const method = parsed.data.decorationMethod ?? existing.decorationMethod;
      await prisma.decorationProfile.updateMany({
        where: { accountId: existing.accountId, decorationMethod: method, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const profile = await prisma.decorationProfile.update({
      where: { id },
      data: parsed.data,
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
        artworkAsset: { select: { id: true, label: true, assetType: true, fileUrl: true } },
        placementConfig: { select: { id: true, label: true, placementKey: true } },
      },
    });
    return reply.send(profile);
  });

  // Delete profile
  app.delete("/v1/decoration-profiles/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.decorationProfile.delete({ where: { id } });
    logger.info({ profileId: id }, "Decoration profile deleted");
    return reply.send({ ok: true });
  });
}
