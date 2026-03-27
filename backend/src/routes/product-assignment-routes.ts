import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

const createAssignmentSchema = z.object({
  accountId: z.string().min(1),
  storefrontId: z.string().optional(),
  catalogProductId: z.string().min(1),
  decorationProfileId: z.string().optional(),
  priceOverrideMinor: z.coerce.number().int().optional(),
  requireReview: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

const updateAssignmentSchema = z.object({
  storefrontId: z.string().nullable().optional(),
  decorationProfileId: z.string().nullable().optional(),
  priceOverrideMinor: z.coerce.number().int().nullable().optional(),
  requireReview: z.boolean().optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function registerProductAssignmentRoutes(app: FastifyInstance): Promise<void> {
  // List assignments (filter by accountId, storefrontId, or styleCode)
  app.get("/v1/product-assignments", async (req, reply) => {
    const { accountId, storefrontId, styleCode } = req.query as {
      accountId?: string;
      storefrontId?: string;
      styleCode?: string;
    };
    const where: Record<string, unknown> = {};
    if (accountId) where.accountId = accountId;
    if (storefrontId) where.storefrontId = storefrontId;
    if (styleCode) where.styleCode = styleCode;

    const assignments = await prisma.productAssignment.findMany({
      where,
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
        storefront: { select: { id: true, name: true, type: true } },
        catalogProduct: { select: { styleCode: true, brand: true, name: true, primaryImageUrl: true, productType: true } },
        decorationProfile: { select: { id: true, name: true, decorationMethod: true } },
        _count: { select: { jobItems: true } },
      },
      orderBy: [{ account: { name: "asc" } }, { catalogProduct: { brand: "asc" } }, { catalogProduct: { name: "asc" } }],
    });
    return reply.send(assignments);
  });

  // Get single assignment
  app.get("/v1/product-assignments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const assignment = await prisma.productAssignment.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
        storefront: { select: { id: true, name: true, type: true } },
        catalogProduct: {
          include: { colours: { select: { colourCode: true, colourName: true, imageUrl: true, rgb: true }, orderBy: { colourName: "asc" } } },
        },
        decorationProfile: {
          include: {
            artworkAsset: { select: { id: true, label: true, fileUrl: true } },
            placementConfig: true,
          },
        },
        _count: { select: { jobItems: true } },
      },
    });
    if (!assignment) return reply.status(404).send({ error: "Product assignment not found" });
    return reply.send(assignment);
  });

  // Create assignment
  app.post("/v1/product-assignments", async (req, reply) => {
    const parsed = createAssignmentSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { accountId, catalogProductId, ...rest } = parsed.data;

    // Verify account and product exist
    const [account, product] = await Promise.all([
      prisma.account.findUnique({ where: { id: accountId } }),
      prisma.catalogProduct.findUnique({ where: { id: catalogProductId } }),
    ]);
    if (!account) return reply.status(404).send({ error: "Account not found" });
    if (!product) return reply.status(404).send({ error: "Catalog product not found" });

    const assignment = await prisma.productAssignment.create({
      data: {
        accountId,
        catalogProductId,
        styleCode: product.styleCode,
        ...rest,
      },
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
        catalogProduct: { select: { styleCode: true, brand: true, name: true, primaryImageUrl: true } },
        decorationProfile: { select: { id: true, name: true, decorationMethod: true } },
        storefront: { select: { id: true, name: true, type: true } },
      },
    });

    logger.info({ assignmentId: assignment.id, accountId, styleCode: product.styleCode }, "Product assignment created");
    return reply.status(201).send(assignment);
  });

  // Update assignment
  app.patch("/v1/product-assignments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateAssignmentSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const assignment = await prisma.productAssignment.update({
      where: { id },
      data: parsed.data,
      include: {
        account: { select: { id: true, key: true, name: true, type: true } },
        catalogProduct: { select: { styleCode: true, brand: true, name: true, primaryImageUrl: true } },
        decorationProfile: { select: { id: true, name: true, decorationMethod: true } },
        storefront: { select: { id: true, name: true, type: true } },
      },
    });
    return reply.send(assignment);
  });

  // Delete assignment
  app.delete("/v1/product-assignments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.productAssignment.delete({ where: { id } });
    logger.info({ assignmentId: id }, "Product assignment deleted");
    return reply.send({ ok: true });
  });
}
