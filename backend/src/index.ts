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
  // Ensure catalog tables exist (idempotent, each statement separate for Prisma compatibility)
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CatalogProduct" (
        "id" TEXT NOT NULL,
        "styleCode" TEXT NOT NULL,
        "manufacturerCode" TEXT,
        "brand" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "productType" TEXT,
        "gender" TEXT,
        "ageGroup" TEXT,
        "fabric" TEXT,
        "weight" TEXT,
        "sizeRange" TEXT,
        "specification" TEXT,
        "retailDescription" TEXT,
        "primaryImageUrl" TEXT,
        "categorisation" TEXT,
        "accreditations" TEXT,
        "tag" TEXT,
        "sustainable" TEXT,
        "printArea" TEXT,
        "embroideryInfo" TEXT,
        "sizeGuideUrl" TEXT,
        "specSheetUrl" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
      )`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CatalogProduct_styleCode_key" ON "CatalogProduct"("styleCode")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CatalogProduct_brand_idx" ON "CatalogProduct"("brand")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CatalogProduct_productType_idx" ON "CatalogProduct"("productType")`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CatalogColour" (
        "id" TEXT NOT NULL,
        "styleCode" TEXT NOT NULL,
        "colourCode" TEXT NOT NULL,
        "colourName" TEXT NOT NULL,
        "imageUrl" TEXT,
        "rgb" TEXT,
        "pantone" TEXT,
        "cmyk" TEXT,
        "primaryColour" TEXT,
        "colourShade" TEXT,
        "cartonPrice" TEXT,
        "packPrice" TEXT,
        "singlePrice" TEXT,
        "cartonQty" TEXT,
        "packQty" TEXT,
        "skuStatus" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "CatalogColour_pkey" PRIMARY KEY ("id")
      )`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CatalogColour_styleCode_colourCode_key" ON "CatalogColour"("styleCode", "colourCode")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CatalogColour_styleCode_idx" ON "CatalogColour"("styleCode")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CatalogColour_colourName_idx" ON "CatalogColour"("colourName")`);

    // Add foreign key if not exists
    const fkExists = await prisma.$queryRawUnsafe<Array<{exists: boolean}>>(`SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'CatalogColour_styleCode_fkey') as exists`);
    if (!fkExists[0]?.exists) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "CatalogColour" ADD CONSTRAINT "CatalogColour_styleCode_fkey" FOREIGN KEY ("styleCode") REFERENCES "CatalogProduct"("styleCode") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    logger.info("[Startup] Catalog tables ensured");
  } catch (err) {
    logger.warn({ err }, "[Startup] Catalog table creation failed (non-fatal)");
  }

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
