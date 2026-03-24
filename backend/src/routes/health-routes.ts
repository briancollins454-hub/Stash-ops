import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { redisHealthClient } from "../queue/connection";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return {
      ok: true,
      service: "stash-ops-backend",
      version: "2024-03-24-v2",
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
}
