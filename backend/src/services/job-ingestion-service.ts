import type { ShopifyOrderPayload } from "./order-service";
import { upsertOrderFromShopify } from "./order-service";

export type IngestionSource = "shopify" | "manual" | "deco";

export type IngestionResult = {
  orderId: string;
  internalOrderId: string;
  source: IngestionSource;
};

export async function ingestShopifyOrder(
  payload: ShopifyOrderPayload,
): Promise<IngestionResult> {
  const upserted = await upsertOrderFromShopify(payload, {
    activityType: "shopify.order.ingested",
  });

  return {
    orderId: upserted.orderId,
    internalOrderId: upserted.internalOrderId,
    source: "shopify",
  };
}
