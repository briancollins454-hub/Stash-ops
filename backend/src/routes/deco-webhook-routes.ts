import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, isDecoConfigured } from "../config/env";
import { processDecoWebhook, type DecoWebhookPayload } from "../services/deco-api-service";
import { logger } from "../lib/logger";

function verifyDecoHmac(rawBody: string | Buffer, providedSignature: string | undefined): boolean {
  if (!env.DECO_WEBHOOK_SECRET) {
    return true;
  }

  if (!providedSignature) {
    return false;
  }

  const digest = createHmac("sha256", env.DECO_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(providedSignature, "utf8"));
  } catch {
    return false;
  }
}

function extractHeader(header: string | string[] | undefined): string | undefined {
  if (!header) return undefined;
  return Array.isArray(header) ? header[0] : header;
}

function inferTopic(payload: DecoWebhookPayload, fallback?: string): string {
  if (payload.event) return payload.event;
  if (payload.type) return payload.type;
  return fallback ?? "deco/unknown";
}

export async function registerDecoWebhookRoutes(app: FastifyInstance): Promise<void> {
  // Generic Deco webhook endpoint — supports all event types
  app.post(
    "/webhooks/deco",
    { config: { rawBody: true } },
    async (request, reply) => {
      if (!isDecoConfigured()) {
        reply.status(503);
        return { accepted: false, reason: "deco_not_configured" };
      }

      const signature = extractHeader(
        (request.headers as Record<string, string | string[] | undefined>)["x-deco-signature"]
          ?? (request.headers as Record<string, string | string[] | undefined>)["x-webhook-signature"],
      );

      const rawBody =
        request.rawBody ??
        (typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}));

      if (!verifyDecoHmac(rawBody, signature)) {
        reply.status(401);
        return { accepted: false, reason: "invalid_signature" };
      }

      const payload = request.body as DecoWebhookPayload;
      const topic = inferTopic(payload);

      logger.info({ topic, externalId: payload.orderId ?? payload.id }, "Deco webhook received");

      const result = await processDecoWebhook(topic, payload);

      reply.status(result.accepted ? 202 : 400);
      return result;
    },
  );

  // Specific topic endpoints for direct URL mapping
  app.post(
    "/webhooks/deco/order-updated",
    { config: { rawBody: true } },
    async (request, reply) => {
      if (!isDecoConfigured()) {
        reply.status(503);
        return { accepted: false, reason: "deco_not_configured" };
      }

      const signature = extractHeader(
        (request.headers as Record<string, string | string[] | undefined>)["x-deco-signature"],
      );
      const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});

      if (!verifyDecoHmac(rawBody, signature)) {
        reply.status(401);
        return { accepted: false, reason: "invalid_signature" };
      }

      const payload = request.body as DecoWebhookPayload;
      const result = await processDecoWebhook("orders/updated", payload);

      reply.status(result.accepted ? 202 : 400);
      return result;
    },
  );

  app.post(
    "/webhooks/deco/stock-updated",
    { config: { rawBody: true } },
    async (request, reply) => {
      if (!isDecoConfigured()) {
        reply.status(503);
        return { accepted: false, reason: "deco_not_configured" };
      }

      const signature = extractHeader(
        (request.headers as Record<string, string | string[] | undefined>)["x-deco-signature"],
      );
      const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});

      if (!verifyDecoHmac(rawBody, signature)) {
        reply.status(401);
        return { accepted: false, reason: "invalid_signature" };
      }

      const payload = request.body as DecoWebhookPayload;
      const result = await processDecoWebhook("stock/updated", payload);

      reply.status(result.accepted ? 202 : 400);
      return result;
    },
  );
}
