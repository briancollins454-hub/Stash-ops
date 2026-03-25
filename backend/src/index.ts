import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastifyRawBody from "fastify-raw-body";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redisHealthClient } from "./queue/connection";
import { registerRoutes } from "./routes";

export async function buildServer() {
  const app = Fastify({
    logger: false,
    bodyLimit: 10 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: env.FRONTEND_ORIGIN ?? true,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  // Parse text/csv and text/plain bodies as plain strings (for CSV import)
  app.addContentTypeParser(["text/csv", "text/plain"], { parseAs: "string" }, (_req, body, done) => {
    done(null, body);
  });

  await app.register(registerRoutes, {
    prefix: "/api",
  });

  app.setErrorHandler((error, request, reply) => {
    logger.error(
      {
        err: error,
        path: request.url,
        method: request.method,
      },
      "Unhandled API error",
    );
    const errMsg = error instanceof Error ? error.message : "Unexpected error";
    reply.status(500).send({
      ok: false,
      error: "internal_error",
      message: errMsg,
    });
  });

  return app;
}

async function start(): Promise<void> {
  const app = await buildServer();
  const host = "0.0.0.0";
  await app.listen({
    host,
    port: env.PORT,
  });

  logger.info({ host, port: env.PORT }, "Stash Ops backend API started");
}

if (require.main === module) {
  start().catch(async (error) => {
    logger.error({ err: error }, "Fatal startup error");
    try {
      await prisma.$disconnect();
    } finally {
      redisHealthClient.disconnect();
      process.exit(1);
    }
  });
}
