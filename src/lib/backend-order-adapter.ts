import type { Order } from "@/lib/types";

type BackendWorkflowStatus =
  | "PENDING_REVIEW"
  | "AWAITING_ARTWORK"
  | "AWAITING_APPROVAL"
  | "APPROVED_AWAITING_STOCK"
  | "READY_FOR_PRODUCTION"
  | "IN_PRODUCTION"
  | "QUALITY_CHECK"
  | "READY_FOR_DISPATCH"
  | "DISPATCHED"
  | "COMPLETE"
  | "CANCELLED";

type BackendFulfillmentStatus =
  | "UNFULFILLED"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "RESTOCKED";

type BackendOrderSource = "SHOPIFY" | "MANUAL" | "DECO";

type BackendOrderLineItem = {
  quantity: number;
  totalPriceMinor?: number | null;
  unitPriceMinor?: number | null;
};

export type BackendOrderRecord = {
  id: string;
  internalOrderId: string;
  source: BackendOrderSource;
  workflowStatus: BackendWorkflowStatus;
  fulfillmentStatus: BackendFulfillmentStatus;
  sourceGroupKey?: string | null;
  sourceGroupLabel?: string | null;
  sourceGroupType?: string | null;
  customerName?: string | null;
  customerCompany?: string | null;
  totalMinor: number;
  dueAt?: string | null;
  lineItems?: BackendOrderLineItem[];
};

function formatMonthDay(value?: string | null): string {
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

function classifyGroupType(label: string): NonNullable<Order["sourceGroupType"]> {
  const normalized = label.toLowerCase();
  if (/\b(school|academy|college)\b/.test(normalized)) {
    return "School";
  }
  if (/\b(club|fc|rfc|cc|team)\b/.test(normalized)) {
    return "Club";
  }
  return "Other";
}

function mapChannel(source: BackendOrderSource): Order["channel"] {
  if (source === "SHOPIFY") {
    return "Shopify";
  }
  if (source === "MANUAL") {
    return "Manual";
  }
  return "Sales rep";
}

function mapStatus(
  workflowStatus: BackendWorkflowStatus,
  fulfillmentStatus: BackendFulfillmentStatus,
): Order["status"] {
  if (fulfillmentStatus === "FULFILLED" || workflowStatus === "DISPATCHED" || workflowStatus === "COMPLETE") {
    return "Shipping";
  }

  if (
    workflowStatus === "IN_PRODUCTION" ||
    workflowStatus === "QUALITY_CHECK" ||
    workflowStatus === "READY_FOR_DISPATCH"
  ) {
    return "Printing";
  }

  if (
    workflowStatus === "READY_FOR_PRODUCTION" ||
    workflowStatus === "APPROVED_AWAITING_STOCK"
  ) {
    return "Queued";
  }

  if (workflowStatus === "AWAITING_APPROVAL") {
    return "Approval";
  }

  if (workflowStatus === "AWAITING_ARTWORK") {
    return "Artwork";
  }

  return "New";
}

function mapArtStatus(workflowStatus: BackendWorkflowStatus): string {
  switch (workflowStatus) {
    case "AWAITING_ARTWORK":
      return "Awaiting artwork";
    case "AWAITING_APPROVAL":
      return "Awaiting customer approval";
    case "APPROVED_AWAITING_STOCK":
      return "Approved - stock gate";
    case "READY_FOR_PRODUCTION":
      return "Ready for production";
    case "IN_PRODUCTION":
      return "In production";
    case "QUALITY_CHECK":
      return "Quality check";
    case "READY_FOR_DISPATCH":
      return "Ready for dispatch";
    case "DISPATCHED":
    case "COMPLETE":
      return "Dispatched";
    case "CANCELLED":
      return "Cancelled";
    case "PENDING_REVIEW":
    default:
      return "Pending review";
  }
}

function computeOrderValue(order: BackendOrderRecord): number {
  if (typeof order.totalMinor === "number" && Number.isFinite(order.totalMinor)) {
    return order.totalMinor / 100;
  }

  const lineTotalMinor = (order.lineItems ?? []).reduce((sum, line) => {
    if (line.totalPriceMinor !== null && line.totalPriceMinor !== undefined) {
      return sum + line.totalPriceMinor;
    }
    if (line.unitPriceMinor !== null && line.unitPriceMinor !== undefined) {
      return sum + line.unitPriceMinor * line.quantity;
    }
    return sum;
  }, 0);

  return lineTotalMinor / 100;
}

export function mapBackendOrderToUiOrder(order: BackendOrderRecord): Order {
  const label = order.sourceGroupLabel?.trim() || "Unassigned";
  const normalizedType = (order.sourceGroupType ?? "").toLowerCase();
  const sourceGroupType: NonNullable<Order["sourceGroupType"]> =
    normalizedType === "school" || normalizedType === "club" || normalizedType === "other"
      ? (normalizedType[0].toUpperCase() + normalizedType.slice(1)) as NonNullable<Order["sourceGroupType"]>
      : label === "Unassigned"
        ? "Unassigned"
        : classifyGroupType(label);

  return {
    id: order.internalOrderId,
    customer: order.customerName ?? "Unknown customer",
    company: order.customerCompany ?? order.customerName ?? "Unknown company",
    sourceGroupKey: order.sourceGroupKey ?? "unassigned",
    sourceGroupLabel: label,
    sourceGroupType,
    status: mapStatus(order.workflowStatus, order.fulfillmentStatus),
    channel: mapChannel(order.source),
    dueDate: formatMonthDay(order.dueAt),
    value: computeOrderValue(order),
    assignee: "Unassigned",
    artStatus: mapArtStatus(order.workflowStatus),
  };
}

