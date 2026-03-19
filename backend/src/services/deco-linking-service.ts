import type { Prisma } from "@prisma/client";

type JsonObject = Record<string, unknown>;

export type DecoPreparedPayload = {
  internalJobId: string;
  shopifyOrderId?: string | null;
  decoCustomerId: string;
  customer: {
    name?: string | null;
    email?: string | null;
    company?: string | null;
  };
  lineItems: Array<{
    jobItemId: string;
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
  jobId: string,
): Promise<DecoPreparedPayload | null> {
  const job = await tx.job.findUnique({
    where: {
      id: jobId,
    },
    include: {
      items: true,
      account: true,
    },
  });

  if (!job?.account?.decoCustomerId) {
    return null;
  }

  const preconfiguration = (job.preconfiguration ?? {}) as JsonObject;
  const lineRecommendations = Array.isArray(preconfiguration.lineRecommendations)
    ? (preconfiguration.lineRecommendations as JsonObject[])
    : [];

  const recommendationByItemId = new Map<string, JsonObject>();
  for (const recommendation of lineRecommendations) {
    const itemId = typeof recommendation.orderLineItemId === "string"
      ? recommendation.orderLineItemId
      : undefined;
    if (itemId) {
      recommendationByItemId.set(itemId, recommendation);
    }
  }

  return {
    internalJobId: job.internalJobId,
    shopifyOrderId: job.shopifyOrderId,
    decoCustomerId: job.account.decoCustomerId,
    customer: {
      name: job.customerName,
      email: job.customerEmail,
      company: job.customerCompany,
    },
    lineItems: job.items.map((item) => {
      const recommendation = recommendationByItemId.get(item.id) ?? {};
      const asset = (recommendation.asset ?? {}) as JsonObject;
      const placement = (recommendation.placement ?? {}) as JsonObject;

      return {
        jobItemId: item.id,
        sku: item.sku,
        productTitle: item.productTitle,
        quantity: item.quantity,
        decorationMethod: (recommendation.decorationMethod as string | undefined) ?? item.decorationMethod,
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

