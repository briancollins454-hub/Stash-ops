import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";
import { isDecoConnectorConfigured } from "@/server/integrations/deco-connector";
import { isShopifyConnectorConfigured } from "@/server/integrations/shopify-connector";
import { isQboConnectorConfigured } from "@/server/integrations/qbo-connector";
import { isGmailConnectorConfigured } from "@/server/integrations/gmail-connector";
import { isSlackConnectorConfigured } from "@/server/integrations/slack-connector";
import { isShipstationConnectorConfigured } from "@/server/integrations/shipstation-connector";

function getConfiguredProviders(): Record<string, boolean> {
  return {
    deco: isDecoConnectorConfigured() || isBackendApiConfigured(),
    shopify: isShopifyConnectorConfigured() || isBackendApiConfigured(),
    qbo: isQboConnectorConfigured(),
    gmail: isGmailConnectorConfigured(),
    slack: isSlackConnectorConfigured(),
    shipstation: isShipstationConnectorConfigured(),
  };
}

const providerOrder = [
  "shopify",
  "deco",
  "qbo",
  "shipstation",
  "gmail",
  "slack",
] as const;

type ProviderName = (typeof providerOrder)[number];

type BackendSyncCursor = {
  provider: string;
  updatedAt: string;
};

type BackendSyncStatusPayload = {
  ok: boolean;
  events: {
    received: number;
    processed: number;
    failed: number;
  };
  queue: {
    waiting?: number;
    active?: number;
    completed?: number;
    failed?: number;
    delayed?: number;
  };
  cursors: BackendSyncCursor[];
};

function mapBackendSyncStatusToLegacy(payload: BackendSyncStatusPayload) {
  const generatedAt = new Date().toISOString();
  const queueWaiting = payload.queue.waiting ?? 0;
  const queueActive = payload.queue.active ?? 0;
  const queueCompleted = payload.queue.completed ?? 0;
  const queueFailed = payload.queue.failed ?? 0;

  const providers = providerOrder.map((provider) => {
    const cursor = payload.cursors.find((entry) => entry.provider === provider);
    const isShopify = provider === "shopify";

    return {
      provider,
      running: isShopify ? queueActive > 0 : false,
      queued: isShopify ? queueWaiting + queueActive : 0,
      lastStartedAt: isShopify && queueActive > 0 ? generatedAt : undefined,
      lastCompletedAt: cursor?.updatedAt,
      lastSuccessAt: cursor?.updatedAt,
      lastError:
        isShopify && payload.events.failed > 0
          ? `${payload.events.failed} event(s) failed. Check backend worker logs.`
          : undefined,
      totalRuns: isShopify ? queueCompleted + queueFailed : 0,
      successfulRuns: isShopify ? queueCompleted : 0,
      failedRuns: isShopify ? queueFailed : 0,
    };
  });

  const jobs = queueWaiting + queueActive + queueCompleted + queueFailed > 0
    ? [
        {
          jobId: "backend-shopify-queue",
          provider: "shopify" as ProviderName,
          trigger: "backend-worker",
          status:
            queueActive > 0
              ? ("running" as const)
              : queueWaiting > 0
                ? ("queued" as const)
                : queueFailed > 0
                  ? ("failed" as const)
                  : ("completed" as const),
          createdAt: generatedAt,
          note: `waiting:${queueWaiting} active:${queueActive} processed:${payload.events.processed}`,
          error: queueFailed > 0 ? `${queueFailed} failed jobs` : undefined,
        },
      ]
    : [];

  return {
    providers,
    jobs,
    generatedAt,
  };
}

export async function GET() {
  if (isBackendApiConfigured()) {
    try {
      const payload = await fetchBackendJson<BackendSyncStatusPayload>("/api/sync/status");
      const legacyShape = mapBackendSyncStatusToLegacy(payload);

      return NextResponse.json({
        data: legacyShape,
        configured: getConfiguredProviders(),
        generatedAt: legacyShape.generatedAt,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to load backend sync status.",
        },
        { status: 502 },
      );
    }
  }

  const generatedAt = new Date().toISOString();
  const emptyStatus = {
    providers: providerOrder.map((provider) => ({
      provider,
      running: false,
      queued: 0,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
    })),
    jobs: [],
    generatedAt,
  };

  return NextResponse.json({
    data: emptyStatus,
    configured: getConfiguredProviders(),
    generatedAt,
  });
}
