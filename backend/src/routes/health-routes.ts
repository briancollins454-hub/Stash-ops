import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { redisHealthClient } from "../queue/connection";
import { debugDecoProductViews } from "../services/deco-api-service";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return {
      ok: true,
      service: "stash-ops-backend",
      version: "2024-03-24-v3",
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/ready", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redisHealthClient.ping();
      return {
        ok: true,
        dependencies: {
          postgres: "ok",
          redis: "ok",
        },
      };
    } catch (error) {
      app.log.error({ err: error }, "Readiness check failed");
      reply.status(503);
      return {
        ok: false,
        dependencies: {
          postgres: "error",
          redis: "error",
        },
      };
    }
  });

  // Temporary diagnostic endpoint for Deco product view HTML inspection
  app.get("/debug/deco-views/:productId", async (request) => {
    const { productId } = request.params as { productId: string };
    return debugDecoProductViews(Number(productId));
  });
}
