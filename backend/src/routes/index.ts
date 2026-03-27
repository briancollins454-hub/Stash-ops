import type { FastifyInstance } from "fastify";
import { registerAccountRoutes } from "./account-routes";
import { registerBatchRoutes } from "./batch-routes";
import { registerCatalogRoutes } from "./catalog-routes";
import { registerConversionRoutes } from "./conversion-routes";
import { registerDecorationProfileRoutes } from "./decoration-profile-routes";
import { registerDecoWebhookRoutes } from "./deco-webhook-routes";
import { registerHealthRoutes } from "./health-routes";
import { registerJobRoutes } from "./job-routes";
import { registerOrderRoutes } from "./order-routes";
import { registerProductAssignmentRoutes } from "./product-assignment-routes";
import { registerQuoteRoutes } from "./quote-routes";
import { registerShopifyWebhookRoutes } from "./shopify-webhook-routes";
import { registerStorefrontRoutes } from "./storefront-routes";
import { registerSyncRoutes } from "./sync-routes";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerHealthRoutes(app);
  await registerAccountRoutes(app);
  await registerBatchRoutes(app);
  await registerCatalogRoutes(app);
  await registerConversionRoutes(app);
  await registerDecorationProfileRoutes(app);
  await registerStorefrontRoutes(app);
  await registerProductAssignmentRoutes(app);
  await registerOrderRoutes(app);
  await registerJobRoutes(app);
  await registerQuoteRoutes(app);
  await registerSyncRoutes(app);
  await registerShopifyWebhookRoutes(app);
  await registerDecoWebhookRoutes(app);
}
