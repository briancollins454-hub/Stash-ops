import { ExternalProvider, FulfillmentStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { buildDecoPreparedPayload } from "../services/deco-linking-service";
import { createManualOrder } from "../services/order-service";

const listOrdersQuerySchema = z.object({
  lane: z.enum(["active", "fulfilled", "all"]).optional(),
  groupKey: z.string().optional(),
  requiresReview: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    }),
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

const createManualOrderSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  sourceGroupLabel: z.string().optional(),
  note: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        sku: z.string().optional(),
        productTitle: z.string().min(1),
        variantTitle: z.string().optional(),
        quantity: z.coerce.number().int().min(1),
        decorationMethod: z.string().optional(),
        requiresArtwork: z.boolean().optional(),
        unitPriceMinor: z.coerce.number().int().min(0).optional(),
      }),
    )
    .min(1),
});

export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/orders/review/matching", async (request) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(300).optional(),
      })
      .parse(request.query);

    const limit = query.limit ?? 100;

    const items = await prisma.order.findMany({
      where: {
        requiresReview: true,
      },
      include: {
        lineItems: true,
        account: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
    });

    return {
      total: items.length,
      items,
    };
  });

  app.get("/v1/orders", async (request) => {
    const query = listOrdersQuerySchema.parse(request.query);
    const lane = query.lane ?? "active";
    const limit = query.limit ?? 150;

    const where =
      lane === "fulfilled"
        ? { fulfillmentStatus: FulfillmentStatus.FULFILLED }
        : lane === "active"
          ? { fulfillmentStatus: { not: FulfillmentStatus.FULFILLED } }
          : {};

    const groupFilter = query.groupKey ? { sourceGroupKey: query.groupKey } : {};
    const reviewFilter =
      query.requiresReview === undefined ? {} : { requiresReview: query.requiresReview };

    const orders = await prisma.order.findMany({
      where: {
        ...where,
        ...groupFilter,
        ...reviewFilter,
      },
      include: {
        lineItems: true,
        account: true,
      },
      orderBy: [{ orderPlacedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        type: string;
        count: number;
        orders: typeof orders;
      }
    >();

    for (const order of orders) {
      const key = order.sourceGroupKey ?? "unassigned";
      const label = order.sourceGroupLabel ?? "Unassigned";
      const type = order.sourceGroupType ?? "unassigned";
      const existing = groups.get(key);
      if (existing) {
        existing.orders.push(order);
        existing.count += 1;
      } else {
        groups.set(key, {
          key,
          label,
          type,
          count: 1,
          orders: [order],
        });
      }
    }

    return {
      lane,
      total: orders.length,
      items: orders,
      groupedBySource: Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label)),
    };
  });

  app.post("/v1/orders/manual", async (request, reply) => {
    const body = createManualOrderSchema.parse(request.body);
    const created = await createManualOrder(body);
    reply.status(201);
    return {
      ok: true,
      orderId: created.orderId,
      internalOrderId: created.internalOrderId,
    };
  });

  app.get("/v1/orders/:orderId/deco-prepared", async (request, reply) => {
    const params = z
      .object({
        orderId: z.string(),
      })
      .parse(request.params);

    const link = await prisma.externalLink.findFirst({
      where: {
        provider: ExternalProvider.SHOPIFY_ORDER,
        OR: [
          { externalId: params.orderId },
          {
            order: {
              internalOrderId: params.orderId.toUpperCase(),
            },
          },
        ],
      },
      select: {
        orderId: true,
      },
    });

    const order =
      (link
        ? await prisma.order.findUnique({
            where: { id: link.orderId },
            select: { id: true },
          })
        : await prisma.order.findFirst({
            where: {
              OR: [
                { id: params.orderId },
                { internalOrderId: params.orderId.toUpperCase() },
              ],
            },
            select: { id: true },
          })) ?? null;

    if (!order) {
      reply.status(404);
      return { error: "Order not found." };
    }

    const payload = await prisma.$transaction((tx) =>
      buildDecoPreparedPayload(tx, order.id),
    );

    if (!payload) {
      reply.status(422);
      return {
        error:
          "Order is not ready for Deco payload. Ensure account is matched and a Deco customer is linked.",
      };
    }

    return {
      ok: true,
      data: payload,
    };
  });
}
