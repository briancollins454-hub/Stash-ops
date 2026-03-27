import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BatchStatus, BatchConfidence } from "@prisma/client";
import {
  batchJobItems,
  listBatches,
  getBatchDetail,
  transitionBatchStatus,
  rebatchAccount,
} from "../services/batch-engine";
import {
  applyTemplateToBatch,
  snapshotBatchConfig,
} from "../services/template-matching";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

// ── Validation schemas ──

const batchListQuerySchema = z.object({
  accountId: z.string().optional(),
  status: z.string().optional(), // comma-separated BatchStatus values
  confidence: z.nativeEnum(BatchConfidence).optional(),
  decorationMethod: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const batchIdParamsSchema = z.object({
  batchId: z.string().min(1),
});

const transitionBodySchema = z.object({
  status: z.nativeEnum(BatchStatus),
  notes: z.string().optional(),
});

const batchJobBodySchema = z.object({
  jobId: z.string().min(1),
});

const rebatchBodySchema = z.object({
  accountId: z.string().min(1),
});

const snapshotBodySchema = z.object({
  approvedBy: z.string().min(1).default("system"),
});

const personalisationBodySchema = z.object({
  items: z.array(
    z.object({
      size: z.string().min(1),
      position: z.number().int().min(1).default(1),
      text: z.string().min(1),
      font: z.string().optional(),
      threadColour: z.string().optional(),
      notes: z.string().optional(),
    })
  ),
});

const updateBatchBodySchema = z.object({
  decorationProfileId: z.string().nullable().optional(),
  decorationMethod: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── Register routes ──

export async function registerBatchRoutes(app: FastifyInstance): Promise<void> {
  // ─────────────── GET /v1/batches ───────────────

  app.get("/v1/batches", async (request) => {
    const query = batchListQuerySchema.parse(request.query);

    const statusFilter = query.status
      ? (query.status.split(",").filter((s) => s in BatchStatus) as BatchStatus[])
      : undefined;

    const result = await listBatches({
      accountId: query.accountId,
      status: statusFilter,
      confidence: query.confidence,
      decorationMethod: query.decorationMethod,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      items: result.items,
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    };
  });

  // ─────────────── GET /v1/batches/stats ───────────────

  app.get("/v1/batches/stats", async () => {
    const [byStatus, byConfidence, total] = await Promise.all([
      prisma.productionBatch.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.productionBatch.groupBy({
        by: ["confidence"],
        _count: true,
      }),
      prisma.productionBatch.count(),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      byConfidence: Object.fromEntries(byConfidence.map((c) => [c.confidence, c._count])),
    };
  });

  // ── Static POST routes BEFORE parameterized :batchId routes ──

  // ─────────────── POST /v1/batches/batch-job ───────────────

  app.post("/v1/batches/batch-job", async (request) => {
    const { jobId } = batchJobBodySchema.parse(request.body);
    const result = await batchJobItems(jobId);

    logger.info(
      { jobId, created: result.batchesCreated, updated: result.batchesUpdated, items: result.itemsBatched },
      "Job batched"
    );

    return result;
  });

  // ─────────────── POST /v1/batches/rebatch-account ───────────────

  app.post("/v1/batches/rebatch-account", async (request) => {
    const { accountId } = rebatchBodySchema.parse(request.body);
    const result = await rebatchAccount(accountId);

    logger.info(
      { accountId, jobsProcessed: result.jobsProcessed },
      "Account rebatched"
    );

    return result;
  });

  // ─────────────── POST /v1/batches/batch-all ───────────────

  app.post("/v1/batches/batch-all", async () => {
    const jobs = await prisma.job.findMany({
      where: {
        accountId: { not: null },
        items: {
          some: {
            batchSourceLines: { none: {} },
          },
        },
      },
      select: { id: true },
      take: 500,
    });

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalItems = 0;
    const errors: string[] = [];

    for (const job of jobs) {
      const r = await batchJobItems(job.id);
      totalCreated += r.batchesCreated;
      totalUpdated += r.batchesUpdated;
      totalItems += r.itemsBatched;
      errors.push(...r.errors);
    }

    logger.info(
      { jobsProcessed: jobs.length, totalCreated, totalUpdated, totalItems },
      "Batch-all completed"
    );

    return {
      jobsProcessed: jobs.length,
      batchesCreated: totalCreated,
      batchesUpdated: totalUpdated,
      itemsBatched: totalItems,
      errors: errors.slice(0, 20),
    };
  });

  // ── Parameterized :batchId routes ──

  // ─────────────── GET /v1/batches/:batchId ───────────────

  app.get("/v1/batches/:batchId", async (request, reply) => {
    const { batchId } = batchIdParamsSchema.parse(request.params);
    const batch = await getBatchDetail(batchId);

    if (!batch) {
      reply.status(404);
      return { error: "Batch not found" };
    }

    return batch;
  });

  // ─────────────── PATCH /v1/batches/:batchId ───────────────

  app.patch("/v1/batches/:batchId", async (request, reply) => {
    const { batchId } = batchIdParamsSchema.parse(request.params);
    const body = updateBatchBodySchema.parse(request.body);

    const batch = await prisma.productionBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      reply.status(404);
      return { error: "Batch not found" };
    }

    const updateData: Record<string, unknown> = {};
    if (body.decorationProfileId !== undefined) updateData.decorationProfileId = body.decorationProfileId;
    if (body.decorationMethod !== undefined) updateData.decorationMethod = body.decorationMethod;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const updated = await prisma.productionBatch.update({
      where: { id: batchId },
      data: updateData,
    });

    return updated;
  });

  // ─────────────── POST /v1/batches/:batchId/transition ───────────────

  app.post("/v1/batches/:batchId/transition", async (request, reply) => {
    const { batchId } = batchIdParamsSchema.parse(request.params);
    const { status, notes } = transitionBodySchema.parse(request.body);

    const result = await transitionBatchStatus(batchId, status, notes);

    if (!result.success) {
      reply.status(400);
      return { error: result.error };
    }

    return { success: true, status };
  });

  // ─────────────── POST /v1/batches/:batchId/match-template ───────────────

  app.post("/v1/batches/:batchId/match-template", async (request, reply) => {
    const { batchId } = batchIdParamsSchema.parse(request.params);

    try {
      const match = await applyTemplateToBatch(batchId);
      return {
        success: true,
        match: {
          source: match.matchSource,
          confidence: match.confidence,
          confidenceScore: match.confidenceScore,
          decorationMethod: match.decorationMethod,
          reasons: match.matchReasons,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reply.status(400);
      return { error: msg };
    }
  });

  // ─────────────── POST /v1/batches/:batchId/snapshot ───────────────

  app.post("/v1/batches/:batchId/snapshot", async (request, reply) => {
    const { batchId } = batchIdParamsSchema.parse(request.params);
    const { approvedBy } = snapshotBodySchema.parse(request.body ?? {});

    try {
      const snapshotId = await snapshotBatchConfig(batchId, approvedBy);
      return { success: true, snapshotId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reply.status(400);
      return { error: msg };
    }
  });

  // ─────────────── POST /v1/batches/:batchId/personalisation ───────────────

  app.post("/v1/batches/:batchId/personalisation", async (request, reply) => {
    const { batchId } = batchIdParamsSchema.parse(request.params);
    const { items } = personalisationBodySchema.parse(request.body);

    const batch = await prisma.productionBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      reply.status(404);
      return { error: "Batch not found" };
    }

    const created = await prisma.personalisationItem.createMany({
      data: items.map((item) => ({
        batchId,
        size: item.size,
        position: item.position,
        text: item.text,
        font: item.font ?? null,
        threadColour: item.threadColour ?? null,
        notes: item.notes ?? null,
      })),
    });

    await prisma.productionBatch.update({
      where: { id: batchId },
      data: { hasPersonalisation: true },
    });

    return { success: true, count: created.count };
  });

  // ─────────────── DELETE /v1/batches/:batchId/personalisation ───────────────

  app.delete("/v1/batches/:batchId/personalisation", async (request, reply) => {
    const { batchId } = batchIdParamsSchema.parse(request.params);

    const batch = await prisma.productionBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      reply.status(404);
      return { error: "Batch not found" };
    }

    await prisma.personalisationItem.deleteMany({ where: { batchId } });

    await prisma.productionBatch.update({
      where: { id: batchId },
      data: { hasPersonalisation: false },
    });

    return { success: true };
  });
}
