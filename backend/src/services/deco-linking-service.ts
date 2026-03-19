import type { Prisma } from "@prisma/client";

type JsonObject = Record<string, unknown>;

export type DecoPreparedPayload = {
  internalOrderId: string;
  shopifyOrderId?: string | null;
  decoCustomerId: string;
  customer: {
    name?: string | null;
    email?: string | null;
    company?: string | null;
  };
  lineItems: Array<{
    orderLineItemId: string;
    sku?: string | null;
    productTitle: string;
    quantity: number;
    decorationMethod?: string | null;
    assetDesignId?: string | null;
    assetTemplateId?: string | null;
    placementKey?: string | null;
    widthMm?: number | null;
    heightMm?: number | null;
    offsetXMm?: number | null;
    offsetYMm?: number | null;
    rotationDegrees?: number | null;
  }>;
};

export async function buildDecoPreparedPayload(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<DecoPreparedPayload | null> {
  const order = await tx.order.findUnique({
    where: {
      id: orderId,
    },
    include: {
      lineItems: true,
      account: true,
    },
  });

  if (!order?.account?.decoCustomerId) {
    return null;
  }

  const preconfiguration = (order.preconfiguration ?? {}) as JsonObject;
  const lineRecommendations = Array.isArray(preconfiguration.lineRecommendations)
    ? (preconfiguration.lineRecommendations as JsonObject[])
    : [];

  const recommendationByLineItemId = new Map<string, JsonObject>();
  for (const recommendation of lineRecommendations) {
    const lineItemId = typeof recommendation.orderLineItemId === "string"
      ? recommendation.orderLineItemId
      : undefined;
    if (lineItemId) {
      recommendationByLineItemId.set(lineItemId, recommendation);
    }
  }

  return {
    internalOrderId: order.internalOrderId,
    shopifyOrderId: order.shopifyOrderId,
    decoCustomerId: order.account.decoCustomerId,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      company: order.customerCompany,
    },
    lineItems: order.lineItems.map((lineItem) => {
      const recommendation = recommendationByLineItemId.get(lineItem.id) ?? {};
      const asset = (recommendation.asset ?? {}) as JsonObject;
      const placement = (recommendation.placement ?? {}) as JsonObject;

      return {
        orderLineItemId: lineItem.id,
        sku: lineItem.sku,
        productTitle: lineItem.productTitle,
        quantity: lineItem.quantity,
        decorationMethod: (recommendation.decorationMethod as string | undefined) ?? lineItem.decorationMethod,
        assetDesignId: (asset.decoDesignId as string | undefined) ?? null,
        assetTemplateId: (asset.decoTemplateId as string | undefined) ?? null,
        placementKey: (placement.placementKey as string | undefined) ?? null,
        widthMm: (placement.widthMm as number | undefined) ?? null,
        heightMm: (placement.heightMm as number | undefined) ?? null,
        offsetXMm: (placement.offsetXMm as number | undefined) ?? null,
        offsetYMm: (placement.offsetYMm as number | undefined) ?? null,
        rotationDegrees: (placement.rotationDegrees as number | undefined) ?? null,
      };
    }),
  };
}

