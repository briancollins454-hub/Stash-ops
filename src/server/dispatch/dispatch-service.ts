import {
  getUnifiedOrder,
  saveUnifiedOrder,
} from "@/server/repositories/unified-order-repository";
import { transitionProductionStage } from "@/server/core/order-orchestrator";
import { fulfillShopifyOrder } from "@/server/integrations/shopify-fulfillment";
import type { ShopifyFulfillmentStatus } from "@/server/core/order-types";
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

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function activity(message: string, actor: string) {
  return {
    activityId: randomId("act"),
    type: "integration_sync" as const,
    message,
    actor,
    source: "system" as const,
    createdAt: nowIso(),
  };
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

  const loadedOrders = await Promise.all(uniqueIds.map((orderId) => getUnifiedOrder(orderId)));
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
    const order = byId.get(item.internalOrderId);
    const printResult = printByOrderId.get(item.internalOrderId);

    if (!order || !printResult) {
      results.push({
        orderId: item.internalOrderId,
        printed: false,
        shopifyFulfilled: false,
        transitionedToDispatched: false,
        message: "ShipStation print result missing.",
      });
      continue;
    }

    if (!printResult.printed) {
      const failedOrder = {
        ...order,
        activityLog: [
          ...order.activityLog,
          activity(
            `ShipStation label print failed for ${order.internalOrderId}: ${printResult.error ?? "unknown error"}`,
            actor,
          ),
        ],
        updatedAt: nowIso(),
      };
      await saveUnifiedOrder(failedOrder);

      results.push({
        orderId: item.internalOrderId,
        printed: false,
        shopifyFulfilled: false,
        transitionedToDispatched: false,
        message: printResult.error ?? "ShipStation print failed.",
      });
      continue;
    }

    const orderWithPrint = {
      ...order,
      externalReferences: {
        ...order.externalReferences,
        shipstationLabelBatchId: printBatch.batchId,
        shipstationShipmentId: printResult.shipmentId ?? order.externalReferences.shipstationShipmentId,
      },
      activityLog: [
        ...order.activityLog,
        activity(
          printBatch.emulated
            ? `ShipStation label batch simulated (${printBatch.batchId}).`
            : `ShipStation label printed (${printResult.shipmentId ?? printBatch.batchId}).`,
          actor,
        ),
      ],
      updatedAt: nowIso(),
    };

    await saveUnifiedOrder(orderWithPrint);

    const fulfillment = await fulfillShopifyOrder(item.shopifyOrderId);
    const refreshedAfterPrint = await getUnifiedOrder(item.internalOrderId);
    if (!refreshedAfterPrint) {
      results.push({
        orderId: item.internalOrderId,
        printed: true,
        shopifyFulfilled: false,
        transitionedToDispatched: false,
        shipmentId: printResult.shipmentId,
        message: "Order disappeared after print step.",
      });
      continue;
    }

    const nextShopifyFulfillmentStatus: ShopifyFulfillmentStatus = fulfillment.fulfilled
      ? "fulfilled"
      : "unfulfilled";

    const withFulfillment = {
      ...refreshedAfterPrint,
      externalReferences: {
        ...refreshedAfterPrint.externalReferences,
        shopifyFulfillmentStatus: nextShopifyFulfillmentStatus,
      },
      activityLog: [
        ...refreshedAfterPrint.activityLog,
        activity(
          fulfillment.note,
          actor,
        ),
      ],
      updatedAt: nowIso(),
    };
    await saveUnifiedOrder(withFulfillment);

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

    const transitioned = await transitionProductionStage(
      item.internalOrderId,
      "dispatched",
      actor,
      "Dispatch confirmed after ShipStation label print + Shopify fulfillment.",
    );

    if (!transitioned.ok) {
      results.push({
        orderId: item.internalOrderId,
        printed: true,
        shopifyFulfilled: true,
        transitionedToDispatched: false,
        shipmentId: printResult.shipmentId,
        message: `Fulfilled, but stage transition failed: ${transitioned.reason}`,
      });
      continue;
    }

    results.push({
      orderId: item.internalOrderId,
      printed: true,
      shopifyFulfilled: true,
      transitionedToDispatched: true,
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
