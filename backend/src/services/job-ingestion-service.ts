import type { ShopifyOrderPayload } from "./order-service";
import { upsertJobFromShopify } from "./order-service";

export type IngestionSource = "shopify" | "manual" | "deco";

export type IngestionResult = {
  jobId: string;
  internalJobId: string;
  source: IngestionSource;
};

export async function ingestShopifyOrder(
  payload: ShopifyOrderPayload,
): Promise<IngestionResult> {
  const upserted = await upsertJobFromShopify(payload, {
    activityType: "shopify.order.ingested",
  });

  return {
    jobId: upserted.jobId,
    internalJobId: upserted.internalJobId,
    source: "shopify",
  };
}
