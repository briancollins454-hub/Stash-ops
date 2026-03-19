import type { DispatchOrder } from "@/lib/types";
import type { ShopifyFulfillmentStatus, UnifiedOrderRecord } from "@/server/core/order-types";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";
import {
  mapBackendJobToLegacyRecord,
  type BackendJobFull,
} from "@/lib/backend-order-adapter";

function formatMonthDay(value?: string) {
  if (!value) {
    return "TBD";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return date.toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
  });
}

function deriveFulfillmentStatus(order: UnifiedOrderRecord): ShopifyFulfillmentStatus {
  const explicit = order.externalReferences.shopifyFulfillmentStatus;
  if (explicit) {
    return explicit;
  }

  if (order.production.stage === "dispatched" || order.production.stage === "complete") {
    return "fulfilled";
  }

  return "unfulfilled";
}

function mapFulfillmentStatus(value: ShopifyFulfillmentStatus): DispatchOrder["fulfillmentStatus"] {
  if (value === "fulfilled") {
    return "Fulfilled";
  }
  if (value === "partial") {
    return "Partial";
  }
  if (value === "unfulfilled" || value === "restocked") {
    return "Unfulfilled";
  }
  return "Unknown";
}

function isShopifyLinked(order: UnifiedOrderRecord) {
  return order.origin === "shopify" && Boolean(order.externalReferences.shopifyOrderId);
}

function mapDispatchOrder(order: UnifiedOrderRecord): DispatchOrder {
  const fulfillment = deriveFulfillmentStatus(order);
  return {
    id: order.internalOrderId,
    shopifyOrderId: order.externalReferences.shopifyOrderId ?? "",
    shopifyOrderNumber: order.externalReferences.shopifyOrderNumber,
    customer: order.customer.name,
    company: order.customer.company ?? order.customer.name,
    quantity: order.lineItems.reduce((sum, line) => sum + line.quantity, 0),
    dueDate: formatMonthDay(order.dueAt),
    stage: order.production.stage,
    fulfillmentStatus: mapFulfillmentStatus(fulfillment),
    blocked: order.production.dispatchBlocked,
    blockedReason: order.blockedReason,
    readyToShip:
      order.production.stage === "ready_for_dispatch" && order.production.dispatchBlocked === false,
  } satisfies DispatchOrder;
}

function sortDispatchOrders(a: DispatchOrder, b: DispatchOrder) {
  if (a.readyToShip && !b.readyToShip) return -1;
  if (!a.readyToShip && b.readyToShip) return 1;
  if (a.dueDate < b.dueDate) return -1;
  if (a.dueDate > b.dueDate) return 1;
  return a.id.localeCompare(b.id);
}

async function buildDispatchOrders() {
  let orders: UnifiedOrderRecord[] = [];

  if (isBackendApiConfigured()) {
    try {
      const payload = await fetchBackendJson<{ items: BackendJobFull[] }>(
        "/api/v1/orders?lane=all&limit=300",
      );
      orders = payload.items.map(mapBackendJobToLegacyRecord);
    } catch (error) {
      console.error("Failed to load jobs from backend for dispatch projections.", error);
    }
  }

  return orders.filter(isShopifyLinked).map(mapDispatchOrder).sort(sortDispatchOrders);
}

export async function projectDispatchQueue(): Promise<DispatchOrder[]> {
  const orders = await buildDispatchOrders();
  return orders.filter((order) => order.fulfillmentStatus !== "Fulfilled");
}

export async function projectFulfilledDispatchQueue(): Promise<DispatchOrder[]> {
  const orders = await buildDispatchOrders();
  return orders.filter((order) => order.fulfillmentStatus === "Fulfilled");
}

export async function projectDispatchBoard() {
  const orders = await buildDispatchOrders();
  return {
    unfulfilled: orders.filter((order) => order.fulfillmentStatus !== "Fulfilled"),
    fulfilled: orders.filter((order) => order.fulfillmentStatus === "Fulfilled"),
  };
}
