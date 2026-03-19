import { EventProvider } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";
import { buildPayloadHash, createInboxEvent } from "../services/event-inbox-service";

function verifyShopifyHmac(rawBody: string | Buffer, providedHmac: string | undefined): boolean {
  if (!env.SHOPIFY_WEBHOOK_SECRET) {
    return true;
  }

  if (!providedHmac) {
    return false;
  }

  const digest = createHmac("sha256", env.SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("base64");

  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(providedHmac));
  } catch {
    return false;
  }
}

function extractHeaderValue(header: string | string[] | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  return Array.isArray(header) ? header[0] : header;
}

async function ingestShopifyEvent(args: {
  app: FastifyInstance;
  request: {
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    rawBody?: string | Buffer;
  };
  topic: string;
}): Promise<{ accepted: boolean; eventInboxId?: string; reason?: string }> {
  const hmac = extractHeaderValue(args.request.headers["x-shopify-hmac-sha256"]);
  const webhookId = extractHeaderValue(args.request.headers["x-shopify-webhook-id"]);
  const rawBody =
    args.request.rawBody ??
    (typeof args.request.body === "string" ? args.request.body : JSON.stringify(args.request.body ?? {}));

  if (!verifyShopifyHmac(rawBody, hmac)) {
    return { accepted: false, reason: "invalid_hmac" };
  }

  const payload = args.request.body as Record<string, unknown>;
  const externalId = String(payload.id ?? payload.order_id ?? "");
  const idempotencyKey = webhookId
    ? `shopify:webhook:${webhookId}`
    : `shopify:${args.topic}:${externalId}:${buildPayloadHash(rawBody)}`;

  const eventInboxId = await createInboxEvent({
    provider: EventProvider.SHOPIFY,
    topic: args.topic,
    externalId: externalId || undefined,
    idempotencyKey,
    payload: payload as Prisma.InputJsonValue,
  });

  return { accepted: true, eventInboxId };
}

export async function registerShopifyWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/webhooks/shopify/orders-create",
    { config: { rawBody: true } },
    async (request, reply) => {
      const result = await ingestShopifyEvent({
        app,
        request: {
          headers: request.headers as Record<string, string | string[] | undefined>,
          body: request.body,
          rawBody: request.rawBody,
        },
        topic: "orders/create",
      });

      if (!result.accepted) {
        reply.status(401);
      } else {
        reply.status(202);
      }

      return result;
    },
  );

  app.post(
    "/webhooks/shopify/orders-updated",
    { config: { rawBody: true } },
    async (request, reply) => {
      const result = await ingestShopifyEvent({
        app,
        request: {
          headers: request.headers as Record<string, string | string[] | undefined>,
          body: request.body,
          rawBody: request.rawBody,
        },
        topic: "orders/updated",
      });

      if (!result.accepted) {
        reply.status(401);
      } else {
        reply.status(202);
      }

      return result;
    },
  );

  app.post(
    "/webhooks/shopify/fulfillments-create",
    { config: { rawBody: true } },
    async (request, reply) => {
      const result = await ingestShopifyEvent({
        app,
        request: {
          headers: request.headers as Record<string, string | string[] | undefined>,
          body: request.body,
          rawBody: request.rawBody,
        },
        topic: "fulfillments/create",
      });

      if (!result.accepted) {
        reply.status(401);
      } else {
        reply.status(202);
      }

      return result;
    },
  );
}
