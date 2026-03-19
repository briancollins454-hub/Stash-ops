import type { FastifyInstance } from "fastify";
import { registerAccountRoutes } from "./account-routes";
import { registerHealthRoutes } from "./health-routes";
import { registerOrderRoutes } from "./order-routes";
import { registerShopifyWebhookRoutes } from "./shopify-webhook-routes";
import { registerSyncRoutes } from "./sync-routes";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerHealthRoutes(app);
  await registerAccountRoutes(app);
  await registerOrderRoutes(app);
  await registerSyncRoutes(app);
  await registerShopifyWebhookRoutes(app);
}
