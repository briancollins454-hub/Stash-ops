import { EventStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { eventInboxQueue } from "../queue/queues";
import { backfillShopifyUnfulfilledOrders } from "../services/shopify-service";

const backfillSchema = z.object({
  maxPages: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(250).optional(),
});

export async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
  app.post("/sync/shopify/backfill", async (request) => {
    const body = backfillSchema.parse(request.body ?? {});
    const result = await backfillShopifyUnfulfilledOrders(body);
    return {
      ok: true,
      provider: "shopify",
      ...result,
    };
  });

  app.get("/sync/status", async () => {
    const [received, processed, failed, queueCounts, cursors] = await Promise.all([
      prisma.eventInbox.count({ where: { status: EventStatus.RECEIVED } }),
      prisma.eventInbox.count({ where: { status: EventStatus.PROCESSED } }),
      prisma.eventInbox.count({ where: { status: EventStatus.FAILED } }),
      eventInboxQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
      prisma.syncCursor.findMany({
        orderBy: { provider: "asc" },
      }),
    ]);

    return {
      ok: true,
      events: {
        received,
        processed,
        failed,
      },
      queue: queueCounts,
      cursors,
    };
  });
}

