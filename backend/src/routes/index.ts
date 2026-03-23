import type { FastifyInstance } from "fastify";
import { registerAccountRoutes } from "./account-routes";
import { registerConversionRoutes } from "./conversion-routes";
import { registerDecoWebhookRoutes } from "./deco-webhook-routes";
import { registerHealthRoutes } from "./health-routes";
import { registerJobRoutes } from "./job-routes";
import { registerOrderRoutes } from "./order-routes";
import { registerQuoteRoutes } from "./quote-routes";
import { registerShopifyWebhookRoutes } from "./shopify-webhook-routes";
import { registerSyncRoutes } from "./sync-routes";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerHealthRoutes(app);
  await registerAccountRoutes(app);
  await registerConversionRoutes(app);
  await registerOrderRoutes(app);
  await registerJobRoutes(app);
  await registerQuoteRoutes(app);
  await registerSyncRoutes(app);
  await registerShopifyWebhookRoutes(app);
  await registerDecoWebhookRoutes(app);
}
