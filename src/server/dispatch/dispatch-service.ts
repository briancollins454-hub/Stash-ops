import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";
import {
  mapBackendJobToLegacyRecord,
  type BackendJobFull,
} from "@/lib/backend-order-adapter";
import { fulfillShopifyOrder } from "@/server/integrations/shopify-fulfillment";
import {
  printShipstationLabels,
  type ShipstationPrintItemInput,
} from "@/server/integrations/shipstation-connector";

export type BulkDispatchItemResult = {
  orderId: string;
  printed: boolean;
  shopifyFulfilled: boolean;
  transitionedToDispatched: boolean;
  shipmentId?: string;
  message: string;
};

export type BulkDispatchResult = {
  requested: number;
  processed: number;
  dispatched: number;
  fulfilled: number;
  emulatedPrint: boolean;
  batchId: string;
  note: string;
  results: BulkDispatchItemResult[];
};

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export async function bulkDispatchOrders(
  orderIds: string[],
  actor = "dispatch.ui",
): Promise<BulkDispatchResult> {
  const uniqueIds = unique(orderIds);
  if (uniqueIds.length === 0) {
    return {
      requested: 0,
      processed: 0,
      dispatched: 0,
      fulfilled: 0,
      emulatedPrint: true,
      batchId: randomId("ship-batch"),
      note: "No orders selected.",
      results: [],
    };
  }

  if (!isBackendApiConfigured()) {
    return {
      requested: uniqueIds.length,
      processed: 0,
      dispatched: 0,
      fulfilled: 0,
      emulatedPrint: true,
      batchId: randomId("ship-batch"),
      note: "Backend API not configured.",
      results: uniqueIds.map((id) => ({
        orderId: id,
        printed: false,
        shopifyFulfilled: false,
        transitionedToDispatched: false,
        message: "Backend API not configured.",
      })),
    };
  }

  // Load orders from backend
  const loadedOrders = await Promise.all(
    uniqueIds.map(async (orderId) => {
      try {
        const job = await fetchBackendJson<BackendJobFull>(
          `/api/v1/jobs/${encodeURIComponent(orderId)}`,
        );
        return mapBackendJobToLegacyRecord(job);
      } catch {
        return null;
      }
    }),
  );

  const byId = new Map(
    loadedOrders
      .filter((order): order is NonNullable<typeof order> => Boolean(order))
      .map((order) => [order.internalOrderId, order]),
  );

  const results: BulkDispatchItemResult[] = [];
  const printItems: ShipstationPrintItemInput[] = [];

  uniqueIds.forEach((orderId) => {
    const order = byId.get(orderId);
    if (!order) {
      results.push({
        orderId,
        printed: false,
        shopifyFulfilled: false,
        transitionedToDispatched: false,
        message: "Order not found.",
      });
      return;
    }

    if (order.origin !== "shopify" || !order.externalReferences.shopifyOrderId) {
      results.push({
        orderId,
        printed: false,
        shopifyFulfilled: false,
        transitionedToDispatched: false,
        message: "Order is not linked to Shopify.",
      });
      return;
    }

    if (order.production.stage !== "ready_for_dispatch") {
      results.push({
        orderId,
        printed: false,
        shopifyFulfilled: false,
        transitionedToDispatched: false,
        message: `Order is in ${order.production.stage}, not ready_for_dispatch.`,
      });
      return;
    }

    if (order.production.dispatchBlocked) {
      results.push({
        orderId,
        printed: false,
        shopifyFulfilled: false,
        transitionedToDispatched: false,
        message: `Order is blocked: ${order.blockedReason ?? "dispatch blocker active"}.`,
      });
      return;
    }

    printItems.push({
      internalOrderId: order.internalOrderId,
      shopifyOrderId: order.externalReferences.shopifyOrderId,
      shopifyOrderNumber: order.externalReferences.shopifyOrderNumber,
      customer: order.customer.name,
      company: order.customer.company ?? order.customer.name,
      quantity: order.lineItems.reduce((sum, line) => sum + line.quantity, 0),
    });
  });

  const printBatch = await printShipstationLabels(printItems);
  const printByOrderId = new Map(printBatch.labels.map((label) => [label.internalOrderId, label]));

  for (const item of printItems) {
    const printResult = printByOrderId.get(item.internalOrderId);

    if (!printResult || !printResult.printed) {
      results.push({
        orderId: item.internalOrderId,
        printed: false,
        shopifyFulfilled: false,
        transitionedToDispatched: false,
        message: printResult?.error ?? "ShipStation print failed.",
      });
      continue;
    }

    const fulfillment = await fulfillShopifyOrder(item.shopifyOrderId);

    if (!fulfillment.fulfilled) {
      results.push({
        orderId: item.internalOrderId,
        printed: true,
        shopifyFulfilled: false,
        transitionedToDispatched: false,
        shipmentId: printResult.shipmentId,
        message: `Printed, but Shopify fulfillment failed: ${fulfillment.note}`,
      });
      continue;
    }

    // Transition via backend API
    let transitioned = false;
    try {
      const result = await fetchBackendJson<{ ok: boolean }>(
        `/api/v1/jobs/${encodeURIComponent(item.internalOrderId)}/transition`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ target: "COMPLETED", actor, force: false }),
        },
      );
      transitioned = result.ok;
    } catch {
      transitioned = false;
    }

    results.push({
      orderId: item.internalOrderId,
      printed: true,
      shopifyFulfilled: true,
      transitionedToDispatched: transitioned,
      shipmentId: printResult.shipmentId,
      message: fulfillment.alreadyFulfilled
        ? "Already fulfilled in Shopify; moved to dispatched."
        : "Printed, fulfilled in Shopify, and moved to dispatched.",
    });
  }

  return {
    requested: uniqueIds.length,
    processed: printItems.length,
    dispatched: results.filter((row) => row.transitionedToDispatched).length,
    fulfilled: results.filter((row) => row.shopifyFulfilled).length,
    emulatedPrint: printBatch.emulated,
    batchId: printBatch.batchId,
    note: printBatch.note,
    results,
  };
}
