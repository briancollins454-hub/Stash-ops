import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

const storefrontTypeSchema = z.enum(["PERMANENT", "CAMPAIGN", "EVENT", "CUSTOM"]);

const createStorefrontSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(2),
  type: storefrontTypeSchema.optional().default("PERMANENT"),
  shopifyTagPattern: z.string().optional(),
  shopifyShopUrl: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const updateStorefrontSchema = z.object({
  name: z.string().min(2).optional(),
  type: storefrontTypeSchema.optional(),
  shopifyTagPattern: z.string().nullable().optional(),
  shopifyShopUrl: z.string().nullable().optional(),
  active: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function registerStorefrontRoutes(app: FastifyInstance): Promise<void> {
  // List storefronts (optionally filtered by accountId)
  app.get("/v1/storefronts", async (req, reply) => {
    const { accountId } = req.query as { accountId?: string };
    const where: Record<string, unknown> = {};
    if (accountId) where.accountId = accountId;

    const storefronts = await prisma.storefront.findMany({
      where,
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
        _count: { select: { jobs: true, productAssignments: true } },
      },
      orderBy: [{ account: { name: "asc" } }, { name: "asc" }],
    });
    return reply.send(storefronts);
  });

  // Get single storefront
  app.get("/v1/storefronts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const storefront = await prisma.storefront.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
        productAssignments: {
          include: {
            catalogProduct: { select: { styleCode: true, brand: true, name: true, primaryImageUrl: true } },
            decorationProfile: { select: { id: true, name: true, decorationMethod: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { jobs: true } },
      },
    });
    if (!storefront) return reply.status(404).send({ error: "Storefront not found" });
    return reply.send(storefront);
  });

  // Create storefront
  app.post("/v1/storefronts", async (req, reply) => {
    const parsed = createStorefrontSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { accountId, startsAt, endsAt, ...rest } = parsed.data;

    // Verify account exists
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return reply.status(404).send({ error: "Account not found" });

    const storefront = await prisma.storefront.create({
      data: {
        ...rest,
        accountId,
        startsAt: startsAt ? new Date(startsAt) : undefined,
        endsAt: endsAt ? new Date(endsAt) : undefined,
      },
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
      },
    });

    logger.info({ storefrontId: storefront.id, accountId }, "Storefront created");
    return reply.status(201).send(storefront);
  });

  // Update storefront
  app.patch("/v1/storefronts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateStorefrontSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { startsAt, endsAt, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (startsAt !== undefined) data.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt !== undefined) data.endsAt = endsAt ? new Date(endsAt) : null;

    const storefront = await prisma.storefront.update({
      where: { id },
      data,
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
      },
    });
    return reply.send(storefront);
  });

  // Delete storefront
  app.delete("/v1/storefronts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.storefront.delete({ where: { id } });
    logger.info({ storefrontId: id }, "Storefront deleted");
    return reply.send({ ok: true });
  });
}
