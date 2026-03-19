import type {
  FulfillmentLabel,
  Order,
  StockPurchaseTask,
  WarehouseReceiptTask,
  CommunicationSignal,
  ProductionJob,
  Approval,
} from "@/lib/types";
import type { UnifiedOrderRecord } from "@/server/core/order-types";

type BackendLifecycle =
  | "INGESTED"
  | "CLASSIFIED"
  | "CONFIGURED"
  | "PUSHED_TO_DECO"
  | "AWAITING_STOCK"
  | "STOCK_RECEIVED"
  | "PRODUCTION_QUEUED"
  | "IN_PRODUCTION"
  | "COMPLETED"
  | "ON_HOLD"
  | "CANCELLED";

type BackendJobSource = "SHOPIFY" | "MANUAL" | "DECO";

type BackendJobItem = {
  quantity: number;
  totalPriceMinor?: number | null;
  unitPriceMinor?: number | null;
};

type BackendFulfillment =
  | "UNFULFILLED"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "RESTOCKED";

export type BackendJobRecord = {
  id: string;
  internalJobId: string;
  source: BackendJobSource;
  lifecycle: BackendLifecycle;
  approvalStatus?: string | null;
  fulfillmentStatus?: BackendFulfillment | null;
  sourceGroupKey?: string | null;
  sourceGroupLabel?: string | null;
  sourceGroupType?: string | null;
  customerName?: string | null;
  customerCompany?: string | null;
  totalMinor: number;
  dueAt?: string | null;
  items?: BackendJobItem[];
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

function mapChannel(source: BackendJobSource): Order["channel"] {
  if (source === "SHOPIFY") {
    return "Shopify";
  }
  if (source === "MANUAL") {
    return "Manual";
  }
  return "Sales rep";
}

function mapFulfillment(status?: BackendFulfillment | null): FulfillmentLabel {
  switch (status) {
    case "FULFILLED":
      return "fulfilled";
    case "PARTIALLY_FULFILLED":
      return "partial";
    case "RESTOCKED":
      return "restocked";
    default:
      return "unfulfilled";
  }
}

function mapStatus(lifecycle: BackendLifecycle, approvalStatus?: string | null): Order["status"] {
  if (lifecycle === "COMPLETED") {
    return "Complete";
  }
  if (lifecycle === "CANCELLED") {
    return "Cancelled";
  }
  if (lifecycle === "ON_HOLD") {
    return "On hold";
  }
  if (lifecycle === "IN_PRODUCTION") {
    return "Printing";
  }
  if (lifecycle === "PRODUCTION_QUEUED" || lifecycle === "STOCK_RECEIVED") {
    return "Queued";
  }
  if (lifecycle === "AWAITING_STOCK") {
    return "Stock";
  }
  if (approvalStatus === "AWAITING_CUSTOMER" || approvalStatus === "PROOF_SENT") {
    return "Approval";
  }
  if (lifecycle === "PUSHED_TO_DECO") {
    return "Artwork";
  }
  return "New";
}

function mapArtStatus(lifecycle: BackendLifecycle, approvalStatus?: string | null): string {
  if (lifecycle === "CANCELLED") return "Cancelled";
  if (lifecycle === "ON_HOLD") return "On hold";
  if (lifecycle === "COMPLETED") return "Complete";
  if (lifecycle === "IN_PRODUCTION") return "In production";
  if (lifecycle === "PRODUCTION_QUEUED") return "Ready for production";
  if (lifecycle === "STOCK_RECEIVED") return "Stock received";
  if (lifecycle === "AWAITING_STOCK") return "Awaiting stock";
  if (approvalStatus === "AWAITING_CUSTOMER") return "Awaiting customer approval";
  if (approvalStatus === "PROOF_SENT") return "Proof sent";
  if (lifecycle === "PUSHED_TO_DECO") return "Pushed to decorator";
  if (lifecycle === "CONFIGURED") return "Configured";
  if (lifecycle === "CLASSIFIED") return "Classified";
  return "Ingested";
}

function computeJobValue(job: BackendJobRecord): number {
  if (typeof job.totalMinor === "number" && Number.isFinite(job.totalMinor)) {
    return job.totalMinor / 100;
  }

  const lineTotalMinor = (job.items ?? []).reduce((sum, line) => {
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

export function mapBackendJobToUiOrder(job: BackendJobRecord): Order {
  const label = job.sourceGroupLabel?.trim() || "Unassigned";
  const normalizedType = (job.sourceGroupType ?? "").toLowerCase();
  const sourceGroupType: NonNullable<Order["sourceGroupType"]> =
    normalizedType === "school" || normalizedType === "club" || normalizedType === "other"
      ? (normalizedType[0].toUpperCase() + normalizedType.slice(1)) as NonNullable<Order["sourceGroupType"]>
      : label === "Unassigned"
        ? "Unassigned"
        : classifyGroupType(label);

  return {
    id: job.internalJobId,
    customer: job.customerName ?? "Unknown customer",
    company: job.customerCompany ?? job.customerName ?? "Unknown company",
    sourceGroupKey: job.sourceGroupKey ?? "unassigned",
    sourceGroupLabel: label,
    sourceGroupType,
    status: mapStatus(job.lifecycle, job.approvalStatus),
    fulfillment: mapFulfillment(job.fulfillmentStatus),
    channel: mapChannel(job.source),
    dueDate: formatMonthDay(job.dueAt),
    value: computeJobValue(job),
    assignee: "Unassigned",
    artStatus: mapArtStatus(job.lifecycle, job.approvalStatus),
  };
}

// ── Stock requirement adapter ──

type BackendStockStatus =
  | "NOT_REQUIRED"
  | "AWAITING_ORDER"
  | "ORDERED"
  | "AWAITING_ARRIVAL"
  | "PARTIALLY_RECEIVED"
  | "FULLY_RECEIVED"
  | "STOCK_ISSUE";

export type BackendStockRequirement = {
  id: string;
  jobId: string;
  requiredQuantity: number;
  receivedQuantity: number;
  status: BackendStockStatus;
  supplierName?: string | null;
  supplierReference?: string | null;
  eta?: string | null;
  isBlocking: boolean;
  job: {
    id: string;
    internalJobId: string;
    customerCompany?: string | null;
    customerName?: string | null;
  };
};

function mapStockStatus(status: BackendStockStatus): StockPurchaseTask["status"] {
  switch (status) {
    case "FULLY_RECEIVED":
      return "Ready";
    case "PARTIALLY_RECEIVED":
      return "Partially received";
    case "AWAITING_ARRIVAL":
      return "Awaiting arrival";
    case "ORDERED":
      return "Ordered";
    default:
      return "Awaiting order";
  }
}

export function mapBackendStockToUi(item: BackendStockRequirement): StockPurchaseTask {
  const uiStatus = mapStockStatus(item.status);
  const blocker =
    uiStatus === "Awaiting order"
      ? "Supplier order reference not logged"
      : uiStatus === "Awaiting arrival" && item.isBlocking
        ? "ETA window approaching"
        : undefined;

  return {
    id: item.id,
    jobId: item.job.internalJobId,
    account: item.job.customerCompany ?? item.job.customerName ?? "Unknown",
    supplier: item.supplierName ?? "Not set",
    requiredQty: item.requiredQuantity,
    status: uiStatus,
    eta: item.eta ? formatMonthDay(item.eta) : uiStatus === "Ready" ? "In stock" : "TBD",
    blocker,
  };
}

// ── Warehouse receipt adapter ──

export type BackendWarehouseReceipt = {
  id: string;
  jobId: string;
  totalReceived: number;
  branch: string;
  isPartial: boolean;
  receivedAt: string;
  scanEvents: { quantity: number }[];
  job: {
    id: string;
    internalJobId: string;
    customerCompany?: string | null;
    customerName?: string | null;
    stockRequirements: { requiredQuantity: number }[];
  };
};

export function mapBackendWarehouseToUi(item: BackendWarehouseReceipt): WarehouseReceiptTask {
  const expectedQty = item.job.stockRequirements.reduce((sum, r) => sum + r.requiredQuantity, 0);
  const receivedQty = item.totalReceived;
  const status: WarehouseReceiptTask["status"] =
    receivedQty === 0
      ? "Pending receipt"
      : receivedQty < expectedQty
        ? "Partial receipt"
        : "Complete";

  const now = Date.now();
  const receivedMs = new Date(item.receivedAt).getTime();
  const hoursAgo = Math.max(1, Math.round((now - receivedMs) / 3_600_000));

  return {
    id: item.id,
    jobId: item.job.internalJobId,
    account: item.job.customerCompany ?? item.job.customerName ?? "Unknown",
    expectedQty: expectedQty || receivedQty,
    receivedQty,
    branch: item.branch,
    status,
    lastScan: receivedQty === 0 ? "No scan yet" : `${hoursAgo}h ago`,
  };
}

// ── Communication adapter ──

type BackendCommunicationChannel = "GMAIL" | "SLACK" | "INTERNAL_NOTE";
type BackendCommunicationDirection = "INBOUND" | "OUTBOUND" | "INTERNAL";

export type BackendCommunication = {
  id: string;
  jobId: string;
  channel: BackendCommunicationChannel;
  direction: BackendCommunicationDirection;
  subject: string;
  sentAt?: string | null;
  createdAt: string;
  job: {
    id: string;
    internalJobId: string;
    customerCompany?: string | null;
    customerName?: string | null;
  };
};

function mapCommChannel(ch: BackendCommunicationChannel): CommunicationSignal["channel"] {
  switch (ch) {
    case "GMAIL": return "Gmail";
    case "SLACK": return "Slack";
    default: return "Internal";
  }
}

function mapCommDirection(dir: BackendCommunicationDirection): CommunicationSignal["direction"] {
  switch (dir) {
    case "INBOUND": return "Inbound";
    case "OUTBOUND": return "Outbound";
    default: return "Alert";
  }
}

export function mapBackendCommToUi(item: BackendCommunication): CommunicationSignal {
  return {
    id: item.id,
    jobId: item.job.internalJobId,
    account: item.job.customerCompany ?? item.job.customerName ?? "Unknown",
    channel: mapCommChannel(item.channel),
    direction: mapCommDirection(item.direction),
    subject: item.subject,
    state: "Unread",
    updatedAt: item.sentAt ?? item.createdAt,
  };
}

// ── Production queue adapter ──

type BackendProductionStatus =
  | "NOT_READY"
  | "QUEUED_EMBROIDERY"
  | "QUEUED_DTF"
  | "QUEUED_MIXED"
  | "IN_EMBROIDERY"
  | "IN_DTF"
  | "IN_MIXED"
  | "QC"
  | "READY_FOR_DISPATCH"
  | "COMPLETE";

type BackendProductionDepartment = "EMBROIDERY" | "DTF" | "MIXED";

export type BackendProductionItem = {
  id: string;
  internalJobId: string;
  customerCompany?: string | null;
  customerName?: string | null;
  productionStatus: BackendProductionStatus;
  assignedDepartment?: BackendProductionDepartment | null;
  dueAt?: string | null;
  lifecycle: BackendLifecycle;
  items: { quantity: number }[];
};

function mapProductionStage(status: BackendProductionStatus): ProductionJob["stage"] {
  switch (status) {
    case "QUEUED_EMBROIDERY":
    case "QUEUED_DTF":
    case "QUEUED_MIXED":
      return "Ready for print";
    case "IN_EMBROIDERY":
    case "IN_DTF":
    case "IN_MIXED":
      return "On press";
    case "QC":
      return "Packing";
    case "READY_FOR_DISPATCH":
      return "Packing";
    default:
      return "Waiting on stock";
  }
}

function mapProductionProcess(dept?: BackendProductionDepartment | null): ProductionJob["process"] {
  switch (dept) {
    case "EMBROIDERY": return "Embroidery";
    case "DTF": return "DTF";
    default: return "Screen print";
  }
}

export function mapBackendProductionToUi(item: BackendProductionItem): ProductionJob {
  const totalQty = item.items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    id: item.id,
    jobId: item.internalJobId,
    customer: item.customerCompany ?? item.customerName ?? "Unknown",
    stage: mapProductionStage(item.productionStatus),
    process: mapProductionProcess(item.assignedDepartment),
    shipDate: formatMonthDay(item.dueAt),
    quantity: totalQty,
    operator: "Unassigned",
  };
}

// ── Approval adapter ──

type BackendApprovalStatus =
  | "NOT_REQUIRED"
  | "AWAITING_ARTWORK"
  | "PROOF_IN_PROGRESS"
  | "PROOF_SENT"
  | "AWAITING_CUSTOMER_APPROVAL"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REJECTED";

export type BackendApprovalItem = {
  id: string;
  internalJobId: string;
  customerCompany?: string | null;
  customerName?: string | null;
  approvalStatus: BackendApprovalStatus;
  proofVersion?: string | null;
  proofSentAt?: string | null;
  approvedAt?: string | null;
  owner?: string | null;
};

function mapApprovalStatusToUi(status: BackendApprovalStatus): Approval["status"] {
  switch (status) {
    case "APPROVED": return "Approved";
    case "AWAITING_CUSTOMER_APPROVAL":
    case "PROOF_SENT": return "Awaiting client";
    default: return "Needs proof";
  }
}

export function mapBackendApprovalToUi(item: BackendApprovalItem): Approval {
  return {
    id: item.id,
    jobId: item.internalJobId,
    customer: item.customerCompany ?? item.customerName ?? "Unknown",
    status: mapApprovalStatusToUi(item.approvalStatus),
    asset: item.proofVersion ? `Proof v${item.proofVersion}` : "No proof",
    sentAt: item.proofSentAt ?? "Not sent",
    proofOwner: item.owner ?? "Unassigned",
  };
}

// ── Backend → Legacy UnifiedOrderRecord shape ──
// Used by projection queries that still need the legacy shape internally.

function mapLifecycleToProductionStage(
  lifecycle: BackendLifecycle,
): UnifiedOrderRecord["production"]["stage"] {
  switch (lifecycle) {
    case "COMPLETED": return "complete";
    case "IN_PRODUCTION": return "in_production";
    case "PRODUCTION_QUEUED": return "ready_for_production";
    case "STOCK_RECEIVED": return "ready_for_production";
    case "AWAITING_STOCK": return "approved_awaiting_stock";
    case "PUSHED_TO_DECO": return "awaiting_artwork";
    case "CANCELLED": return "complete";
    case "ON_HOLD": return "pending_review";
    default: return "pending_review";
  }
}

function mapApprovalStatusToLegacy(
  status?: string | null,
): UnifiedOrderRecord["approval"]["status"] {
  switch (status) {
    case "APPROVED": return "approved";
    case "AWAITING_CUSTOMER_APPROVAL":
    case "AWAITING_CUSTOMER": return "awaiting_customer_approval";
    case "PROOF_SENT": return "proof_sent";
    case "PROOF_IN_PROGRESS": return "proof_in_progress";
    case "CHANGES_REQUESTED": return "changes_requested";
    case "REJECTED": return "rejected";
    case "NOT_REQUIRED": return "not_required";
    default: return "awaiting_artwork";
  }
}

function mapStockStatusToLegacy(
  status?: string | null,
): UnifiedOrderRecord["stock"]["status"] {
  switch (status) {
    case "IN_STOCK":
    case "FULLY_RECEIVED": return "in_stock";
    case "STOCK_CONFIRMED": return "stock_confirmed";
    case "PARTIALLY_RECEIVED":
    case "PARTIALLY_IN_STOCK": return "partially_in_stock";
    case "AWAITING_ARRIVAL":
    case "AWAITING_SUPPLIER": return "awaiting_supplier";
    case "STOCK_ISSUE":
    case "STOCK_RISK": return "stock_risk";
    case "PURCHASING_REQUIRED":
    case "AWAITING_ORDER": return "purchasing_required";
    default: return "in_stock";
  }
}

function mapSourceToOrigin(
  source: BackendJobSource,
): UnifiedOrderRecord["origin"] {
  switch (source) {
    case "SHOPIFY": return "shopify";
    case "DECO": return "deco";
    default: return "manual";
  }
}

function mapUrgency(
  value?: string | null,
): UnifiedOrderRecord["urgency"] {
  if (value === "RUSH" || value === "rush") return "rush";
  if (value === "CRITICAL" || value === "critical") return "critical";
  return "normal";
}

export type BackendJobFull = BackendJobRecord & {
  stockStatus?: string | null;
  productionStatus?: string | null;
  urgency?: string | null;
  owner?: string | null;
  customerEmail?: string | null;
  shopifyOrderId?: string | null;
  shopifyOrderNumber?: string | null;
  shopifyFulfillmentStatus?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const emptyAddress: UnifiedOrderRecord["billingAddress"] = {
  line1: "",
  city: "",
  country: "",
};

export function mapBackendJobToLegacyRecord(job: BackendJobFull): UnifiedOrderRecord {
  const now = new Date().toISOString();
  return {
    internalOrderId: job.internalJobId,
    origin: mapSourceToOrigin(job.source),
    externalReferences: {
      shopifyOrderId: job.shopifyOrderId ?? undefined,
      shopifyOrderNumber: job.shopifyOrderNumber ?? undefined,
      shopifyFulfillmentStatus: (job.shopifyFulfillmentStatus as UnifiedOrderRecord["externalReferences"]["shopifyFulfillmentStatus"]) ?? undefined,
    },
    customer: {
      customerId: job.id,
      name: job.customerName ?? "Unknown",
      company: job.customerCompany ?? job.sourceGroupLabel ?? undefined,
      email: job.customerEmail ?? undefined,
    },
    billingAddress: emptyAddress,
    shippingAddress: emptyAddress,
    lineItems: (job.items ?? []).map((item, i) => ({
      lineId: `line-${i}`,
      sku: "",
      productTitle: "",
      quantity: item.quantity,
      unitPrice: (item.unitPriceMinor ?? item.totalPriceMinor ?? 0) / 100,
      decorationMethod: "other" as const,
    })),
    artworkFiles: [],
    designSetup: {
      status: "not_started",
      studioView: "2d",
      productLabel: job.sourceGroupLabel ?? "",
      placements: [],
    },
    approval: {
      status: mapApprovalStatusToLegacy(job.approvalStatus),
    },
    stock: {
      status: mapStockStatusToLegacy(job.stockStatus),
      shortageDetected: false,
      purchasingRequired: false,
    },
    purchasing: {
      status: "not_started",
      scanEvents: [],
    },
    production: {
      stage: mapLifecycleToProductionStage(job.lifecycle),
      dispatchBlocked: false,
    },
    communicationTimeline: [],
    activityLog: [],
    dueAt: job.dueAt ?? undefined,
    urgency: mapUrgency(job.urgency),
    assignedDepartment: "ops",
    owner: job.owner ?? undefined,
    createdAt: job.createdAt ?? now,
    updatedAt: job.updatedAt ?? now,
  };
}

