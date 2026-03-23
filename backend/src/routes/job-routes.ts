import type { FastifyInstance } from "fastify";
import {
  MainLifecycle,
  ClassificationStatus,
  ConfigurationStatus,
  StockStatus,
  ProductionStatus,
  ApprovalStatus,
  ProductionDepartment,
  CommunicationChannel,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { mainLifecycleStates } from "../domain/job-status";
import {
  transitionJobLifecycle,
  updateSubStatuses,
  getJobSnapshot,
} from "../services/lifecycle-transition-service";
import { recordSupplierOrder } from "../services/stock-purchasing-service";
import { recordWarehouseReceipt } from "../services/warehouse-receiving-service";
import { routeJobToProduction } from "../services/production-routing-service";
import { appendCommunicationEvent } from "../services/communications-service";
import { markReviewDecision } from "../services/job-configuration-service";

// ── Shared helpers ──

async function resolveJobId(jobIdParam: string): Promise<string | null> {
  const upper = jobIdParam.toUpperCase();

  const direct = await prisma.job.findFirst({
    where: {
      OR: [
        { id: upper },
        { id: jobIdParam },
        { internalJobId: upper },
      ],
    },
    select: { id: true },
  });

  return direct?.id ?? null;
}

const jobIdParamsSchema = z.object({
  jobId: z.string().min(1),
});

// ── Register routes ──

export async function registerJobRoutes(app: FastifyInstance): Promise<void> {
  // ─────────────── GET /v1/jobs/:jobId ───────────────

  app.get("/v1/jobs/:jobId", async (request, reply) => {
    const { jobId: param } = jobIdParamsSchema.parse(request.params);
    const id = await resolveJobId(param);

    if (!id) {
      reply.status(404);
      return { error: "Job not found." };
    }

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        items: true,
        account: {
          include: {
            aliases: true,
            assets: true,
          },
        },
        externalLinks: true,
        activityLogs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!job) {
      reply.status(404);
      return { error: "Job not found." };
    }

    const result = await prisma.$transaction((tx) => getJobSnapshot(tx, id));

    return {
      ...job,
      workflow: result ?? undefined,
    };
  });

  // ─────────────── GET /v1/jobs/:jobId/snapshot ───────────────

  app.get("/v1/jobs/:jobId/snapshot", async (request, reply) => {
    const { jobId: param } = jobIdParamsSchema.parse(request.params);
    const id = await resolveJobId(param);

    if (!id) {
      reply.status(404);
      return { error: "Job not found." };
    }

    const result = await prisma.$transaction((tx) => getJobSnapshot(tx, id));

    if (!result) {
      reply.status(404);
      return { error: "Job not found." };
    }

    return result;
  });

  // ─────────────── POST /v1/jobs/:jobId/transition ───────────────

  const transitionSchema = z.object({
    target: z.enum(mainLifecycleStates as unknown as [string, ...string[]]),
    actor: z.string().min(1),
    force: z.boolean().optional(),
  });

  app.post("/v1/jobs/:jobId/transition", async (request, reply) => {
    const { jobId: param } = jobIdParamsSchema.parse(request.params);
    const body = transitionSchema.parse(request.body);
    const id = await resolveJobId(param);

    if (!id) {
      reply.status(404);
      return { error: "Job not found." };
    }

    const result = await prisma.$transaction((tx) =>
      transitionJobLifecycle(tx, id, body.target as typeof mainLifecycleStates[number], body.actor, {
        force: body.force,
      }),
    );

    if (!result.ok) {
      reply.status(422);
      return { ok: false, reasons: result.reasons };
    }

    return { ok: true, from: result.from, to: result.to };
  });

  // ─────────────── PATCH /v1/jobs/:jobId/substatus ───────────────

  const substatusSchema = z
    .object({
      classificationStatus: z.nativeEnum(ClassificationStatus).optional(),
      configurationStatus: z.nativeEnum(ConfigurationStatus).optional(),
      stockStatus: z.nativeEnum(StockStatus).optional(),
      productionStatus: z.nativeEnum(ProductionStatus).optional(),
      approvalStatus: z.nativeEnum(ApprovalStatus).optional(),
      assignedDepartment: z.nativeEnum(ProductionDepartment).optional(),
      actor: z.string().min(1),
    })
    .refine(
      (data) => {
        const { actor: _a, ...rest } = data;
        return Object.values(rest).some((v) => v !== undefined);
      },
      { message: "At least one sub-status field is required." },
    );

  app.patch("/v1/jobs/:jobId/substatus", async (request, reply) => {
    const { jobId: param } = jobIdParamsSchema.parse(request.params);
    const body = substatusSchema.parse(request.body);
    const id = await resolveJobId(param);

    if (!id) {
      reply.status(404);
      return { error: "Job not found." };
    }

    const { actor, ...updates } = body;

    await prisma.$transaction((tx) => updateSubStatuses(tx, id, updates, actor));

    return { ok: true };
  });

  // ─────────────── POST /v1/jobs/:jobId/stock/order ───────────────

  const stockOrderSchema = z.object({
    supplierName: z.string().min(1),
    supplierReference: z.string().optional(),
    eta: z.string().optional(),
    notes: z.string().optional(),
    actor: z.string().min(1),
  });

  app.post("/v1/jobs/:jobId/stock/order", async (request, reply) => {
    const { jobId: param } = jobIdParamsSchema.parse(request.params);
    const body = stockOrderSchema.parse(request.body);
    const id = await resolveJobId(param);

    if (!id) {
      reply.status(404);
      return { error: "Job not found." };
    }

    await prisma.$transaction(async (tx) => {
      await recordSupplierOrder(tx, id, body);
      await updateSubStatuses(tx, id, { stockStatus: StockStatus.ORDERED }, body.actor);
    });

    return { ok: true };
  });

  // ─────────────── POST /v1/jobs/:jobId/warehouse/receipt ───────────────

  const warehouseReceiptSchema = z.object({
    receivedQuantity: z.number().int().min(0),
    expectedQuantity: z.number().int().min(1),
    location: z.string().min(1),
    branch: z.string().min(1),
    actor: z.string().min(1),
    notes: z.string().optional(),
  });

  app.post("/v1/jobs/:jobId/warehouse/receipt", async (request, reply) => {
    const { jobId: param } = jobIdParamsSchema.parse(request.params);
    const body = warehouseReceiptSchema.parse(request.body);
    const id = await resolveJobId(param);

    if (!id) {
      reply.status(404);
      return { error: "Job not found." };
    }

    const status = await prisma.$transaction(async (tx) => {
      const receiptStatus = await recordWarehouseReceipt(tx, id, body);
      const stockUpdate =
        receiptStatus === "full"
          ? StockStatus.FULLY_RECEIVED
          : StockStatus.PARTIALLY_RECEIVED;
      await updateSubStatuses(tx, id, { stockStatus: stockUpdate }, body.actor);
      return receiptStatus;
    });

    return { ok: true, receiptStatus: status };
  });

  // ─────────────── POST /v1/jobs/:jobId/production/route ───────────────

  const productionRouteSchema = z.object({
    department: z.enum(["embroidery", "dtf", "mixed"]),
    lane: z.enum(["queued", "in_progress", "qc", "complete"]),
    actor: z.string().min(1),
    notes: z.string().optional(),
  });

  const laneToProductionStatus: Record<string, Record<string, ProductionStatus>> = {
    embroidery: {
      queued: ProductionStatus.QUEUED_EMBROIDERY,
      in_progress: ProductionStatus.IN_EMBROIDERY,
      qc: ProductionStatus.QC,
      complete: ProductionStatus.COMPLETE,
    },
    dtf: {
      queued: ProductionStatus.QUEUED_DTF,
      in_progress: ProductionStatus.IN_DTF,
      qc: ProductionStatus.QC,
      complete: ProductionStatus.COMPLETE,
    },
    mixed: {
      queued: ProductionStatus.QUEUED_MIXED,
      in_progress: ProductionStatus.IN_MIXED,
      qc: ProductionStatus.QC,
      complete: ProductionStatus.COMPLETE,
    },
  };

  const departmentToPrisma: Record<string, ProductionDepartment> = {
    embroidery: ProductionDepartment.EMBROIDERY,
    dtf: ProductionDepartment.DTF,
    mixed: ProductionDepartment.MIXED,
  };

  app.post("/v1/jobs/:jobId/production/route", async (request, reply) => {
    const { jobId: param } = jobIdParamsSchema.parse(request.params);
    const body = productionRouteSchema.parse(request.body);
    const id = await resolveJobId(param);

    if (!id) {
      reply.status(404);
      return { error: "Job not found." };
    }

    const productionStatus = laneToProductionStatus[body.department]?.[body.lane];
    if (!productionStatus) {
      reply.status(422);
      return { error: "Invalid department/lane combination." };
    }

    await prisma.$transaction(async (tx) => {
      await routeJobToProduction(tx, id, body);
      await updateSubStatuses(
        tx,
        id,
        {
          productionStatus,
          assignedDepartment: departmentToPrisma[body.department],
        },
        body.actor,
      );
    });

    return { ok: true };
  });

  // ─────────────── POST /v1/jobs/:jobId/communications ───────────────

  const communicationSchema = z.object({
    channel: z.enum(["gmail", "slack", "internal"]),
    direction: z.enum(["inbound", "outbound", "internal"]),
    subject: z.string().min(1),
    bodyPreview: z.string().optional(),
    externalMessageId: z.string().optional(),
    actor: z.string().min(1),
  });

  app.post("/v1/jobs/:jobId/communications", async (request, reply) => {
    const { jobId: param } = jobIdParamsSchema.parse(request.params);
    const body = communicationSchema.parse(request.body);
    const id = await resolveJobId(param);

    if (!id) {
      reply.status(404);
      return { error: "Job not found." };
    }

    await prisma.$transaction((tx) => appendCommunicationEvent(tx, id, body));

    return { ok: true };
  });

  // ─────────────── POST /v1/jobs/:jobId/review ───────────────

  const reviewSchema = z.object({
    accepted: z.boolean(),
    actor: z.string().min(1),
    note: z.string().optional(),
  });

  app.post("/v1/jobs/:jobId/review", async (request, reply) => {
    const { jobId: param } = jobIdParamsSchema.parse(request.params);
    const body = reviewSchema.parse(request.body);
    const id = await resolveJobId(param);

    if (!id) {
      reply.status(404);
      return { error: "Job not found." };
    }

    await prisma.$transaction((tx) =>
      markReviewDecision(tx, id, body.accepted, body.actor, body.note),
    );

    return { ok: true, accepted: body.accepted };
  });

  // ─────────────── GET /v1/jobs/:jobId/activity ───────────────

  const activityQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  });

  app.get("/v1/jobs/:jobId/activity", async (request, reply) => {
    const { jobId: param } = jobIdParamsSchema.parse(request.params);
    const query = activityQuerySchema.parse(request.query);
    const id = await resolveJobId(param);

    if (!id) {
      reply.status(404);
      return { error: "Job not found." };
    }

    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;

    const entries = await prisma.activityLog.findMany({
      where: { jobId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.activityLog.count({
      where: { jobId: id },
    });

    return { total, entries };
  });

  // ─────────────── GET /v1/stock-requirements ───────────────

  const stockListSchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    status: z.nativeEnum(StockStatus).optional(),
  });

  app.get("/v1/stock-requirements", async (request) => {
    const query = stockListSchema.parse(request.query);
    const limit = query.limit ?? 200;

    const where = query.status ? { status: query.status } : {};

    const items = await prisma.jobStockRequirement.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            internalJobId: true,
            customerCompany: true,
            customerName: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return { total: items.length, items };
  });

  // ─────────────── GET /v1/warehouse-receipts ───────────────

  const warehouseListSchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
  });

  app.get("/v1/warehouse-receipts", async (request) => {
    const query = warehouseListSchema.parse(request.query);
    const limit = query.limit ?? 200;

    const items = await prisma.warehouseReceipt.findMany({
      include: {
        scanEvents: true,
        job: {
          select: {
            id: true,
            internalJobId: true,
            customerCompany: true,
            customerName: true,
            stockRequirements: {
              select: { requiredQuantity: true },
            },
          },
        },
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
    });

    return { total: items.length, items };
  });

  // ─────────────── GET /v1/communications ───────────────

  const commsListSchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    channel: z.nativeEnum(CommunicationChannel).optional(),
  });

  app.get("/v1/communications", async (request) => {
    const query = commsListSchema.parse(request.query);
    const limit = query.limit ?? 200;

    const where = query.channel ? { channel: query.channel } : {};

    const items = await prisma.communication.findMany({
      where,
      include: {
        job: {
          select: {
            id: true,
            internalJobId: true,
            customerCompany: true,
            customerName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return { total: items.length, items };
  });

  // ─────────────── GET /v1/production-queue ───────────────

  const productionListSchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
    department: z.nativeEnum(ProductionDepartment).optional(),
  });

  app.get("/v1/production-queue", async (request) => {
    const query = productionListSchema.parse(request.query);
    const limit = query.limit ?? 200;

    const departmentFilter = query.department
      ? { assignedDepartment: query.department }
      : {};

    const items = await prisma.job.findMany({
      where: {
        productionStatus: {
          notIn: [ProductionStatus.NOT_READY, ProductionStatus.COMPLETE],
        },
        ...departmentFilter,
      },
      select: {
        id: true,
        internalJobId: true,
        customerCompany: true,
        customerName: true,
        productionStatus: true,
        assignedDepartment: true,
        dueAt: true,
        lifecycle: true,
        items: {
          select: { quantity: true },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: limit,
    });

    return { total: items.length, items };
  });

  // ─────────────── GET /v1/approvals ───────────────

  const approvalsListSchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional(),
  });

  app.get("/v1/approvals", async (request) => {
    const query = approvalsListSchema.parse(request.query);
    const limit = query.limit ?? 200;

    const items = await prisma.job.findMany({
      where: {
        approvalStatus: {
          notIn: [ApprovalStatus.NOT_REQUIRED, ApprovalStatus.APPROVED],
        },
      },
      select: {
        id: true,
        internalJobId: true,
        customerCompany: true,
        customerName: true,
        approvalStatus: true,
        proofVersion: true,
        proofSentAt: true,
        approvedAt: true,
        owner: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return { total: items.length, items };
  });

  // ─────────────── PATCH /v1/jobs/:jobId/items/:itemId ───────────────

  const itemUpdateSchema = z.object({
    decorationMethod: z.string().optional(),
    decorationPlacement: z.string().optional(),
    designs: z.array(z.object({
      placement: z.string(),
      decorationMethod: z.string(),
      artworkUrl: z.string().optional(),
      artworkName: z.string().optional(),
      artworkFileType: z.string().optional(),
      previewUrl: z.string().optional(),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
      stitchCount: z.number().optional(),
      notes: z.string().optional(),
    })).optional(),
    actor: z.string().min(1),
  });

  app.patch("/v1/jobs/:jobId/items/:itemId", async (request, reply) => {
    const params = z.object({ jobId: z.string(), itemId: z.string() }).parse(request.params);
    const body = itemUpdateSchema.parse(request.body);
    const jobId = await resolveJobId(params.jobId);

    if (!jobId) {
      reply.status(404);
      return { error: "Job not found." };
    }

    const item = await prisma.jobItem.findFirst({
      where: { id: params.itemId, jobId },
    });

    if (!item) {
      reply.status(404);
      return { error: "Item not found on this job." };
    }

    const data: Record<string, unknown> = {};
    if (body.decorationMethod !== undefined) data.decorationMethod = body.decorationMethod;
    if (body.decorationPlacement !== undefined) data.decorationPlacement = body.decorationPlacement;
    if (body.designs !== undefined) {
      data.metadata = {
        ...(typeof item.metadata === "object" && item.metadata !== null ? item.metadata : {}),
        designs: body.designs,
      };
    }

    const updated = await prisma.jobItem.update({
      where: { id: params.itemId },
      data,
    });

    await prisma.activityLog.create({
      data: {
        jobId,
        eventType: "item.decoration_updated",
        message: `Decoration updated on item ${item.productTitle}`,
        payload: { itemId: params.itemId, actor: body.actor, decorationMethod: body.decorationMethod, decorationPlacement: body.decorationPlacement, designCount: body.designs?.length },
      },
    });

    return { ok: true, item: updated };
  });
}
