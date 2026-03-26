import { ExternalProvider, FulfillmentStatus, JobSource, MainLifecycle } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { buildDecoPreparedPayload } from "../services/deco-linking-service";
import { createManualJob } from "../services/order-service";

const listJobsQuerySchema = z.object({
  lane: z.enum(["active", "fulfilled", "all"]).optional(),
  groupKey: z.string().optional(),
  source: z.enum(["SHOPIFY", "DECO", "MANUAL"]).optional(),
  requiresReview: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return undefined;
    }),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
});

const createManualJobSchema = z.object({
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

    const items = await prisma.job.findMany({
      where: {
        requiresReview: true,
      },
      include: {
        items: true,
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
    const query = listJobsQuerySchema.parse(request.query);
    const lane = query.lane ?? "active";
    const limit = query.limit ?? 500;

    const where =
      lane === "fulfilled"
        ? { fulfillmentStatus: FulfillmentStatus.FULFILLED }
        : lane === "active"
          ? { fulfillmentStatus: { not: FulfillmentStatus.FULFILLED } }
          : {};

    const groupFilter = query.groupKey ? { sourceGroupKey: query.groupKey } : {};
    const sourceFilter = query.source ? { source: query.source as JobSource } : {};
    const reviewFilter =
      query.requiresReview === undefined ? {} : { requiresReview: query.requiresReview };

    const combinedWhere = {
      ...where,
      ...groupFilter,
      ...sourceFilter,
      ...reviewFilter,
    };

    // Get actual total counts by source (not limited by take)
    const [totalCount, shopifyCount, decoCount, manualCount, jobs] = await Promise.all([
      prisma.job.count({ where: combinedWhere }),
      prisma.job.count({ where: { ...where, ...groupFilter, ...reviewFilter, source: JobSource.SHOPIFY } }),
      prisma.job.count({ where: { ...where, ...groupFilter, ...reviewFilter, source: JobSource.DECO } }),
      prisma.job.count({ where: { ...where, ...groupFilter, ...reviewFilter, source: JobSource.MANUAL } }),
      prisma.job.findMany({
        where: combinedWhere,
        include: {
          items: true,
          account: true,
        },
        orderBy: [{ orderPlacedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
      }),
    ]);

    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        type: string;
        count: number;
        jobs: typeof jobs;
      }
    >();

    for (const job of jobs) {
      const key = job.sourceGroupKey ?? "unassigned";
      const label = job.sourceGroupLabel ?? "Unassigned";
      const type = job.sourceGroupType ?? "unassigned";
      const existing = groups.get(key);
      if (existing) {
        existing.jobs.push(job);
        existing.count += 1;
      } else {
        groups.set(key, {
          key,
          label,
          type,
          count: 1,
          jobs: [job],
        });
      }
    }

    return {
      lane,
      total: totalCount,
      fetched: jobs.length,
      counts: {
        all: totalCount,
        shopify: shopifyCount,
        deco: decoCount,
        manual: manualCount,
      },
      items: jobs,
      groupedBySource: Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label)),
    };
  });

  app.post("/v1/orders/manual", async (request, reply) => {
    const body = createManualJobSchema.parse(request.body);
    const created = await createManualJob(body);
    reply.status(201);
    return {
      ok: true,
      jobId: created.jobId,
      internalJobId: created.internalJobId,
    };
  });

  app.get("/v1/orders/:jobId/deco-prepared", async (request, reply) => {
    const params = z
      .object({
        jobId: z.string(),
      })
      .parse(request.params);

    const link = await prisma.externalLink.findFirst({
      where: {
        provider: ExternalProvider.SHOPIFY_ORDER,
        OR: [
          { externalId: params.jobId },
          {
            job: {
              internalJobId: params.jobId.toUpperCase(),
            },
          },
        ],
      },
      select: {
        jobId: true,
      },
    });

    const job =
      (link
        ? await prisma.job.findUnique({
            where: { id: link.jobId },
            select: { id: true },
          })
        : await prisma.job.findFirst({
            where: {
              OR: [
                { id: params.jobId },
                { internalJobId: params.jobId.toUpperCase() },
              ],
            },
            select: { id: true },
          })) ?? null;

    if (!job) {
      reply.status(404);
      return { error: "Job not found." };
    }

    const payload = await prisma.$transaction((tx) =>
      buildDecoPreparedPayload(tx, job.id),
    );

    if (!payload) {
      reply.status(422);
      return {
        error:
          "Job is not ready for Deco payload. Ensure account is matched and a Deco customer is linked.",
      };
    }

    return {
      ok: true,
      data: payload,
    };
  });

  /* ── Accounts Receivable — approved but unpaid, excludes Shopify ── */

  app.get("/v1/accounts-receivable", async (request) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(5000).optional(),
      })
      .parse(request.query);

    const limit = query.limit ?? 2000;

    const jobs = await prisma.job.findMany({
      where: {
        source: { not: JobSource.SHOPIFY },
        lifecycle: {
          notIn: [MainLifecycle.CANCELLED],
        },
        approvalStatus: {
          in: ["APPROVED", "NOT_REQUIRED"],
        },
        fulfillmentStatus: {
          not: FulfillmentStatus.RESTOCKED,
        },
      },
      include: {
        items: true,
        account: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ orderPlacedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return {
      total: jobs.length,
      items: jobs,
    };
  });
}
