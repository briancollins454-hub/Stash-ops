export type OrderStatus =
  | "New"
  | "Artwork"
  | "Approval"
  | "Stock"
  | "Queued"
  | "Printing"
  | "Complete"
  | "On hold"
  | "Cancelled";

export type ApprovalStatus = "Needs proof" | "Awaiting client" | "Approved";

export type ProductionStage =
  | "Preflight"
  | "Waiting on stock"
  | "Ready for print"
  | "On press"
  | "Packing";

export type SyncHealth = "Healthy" | "Lagging" | "Action needed";

export interface Metric {
  label: string;
  value: string;
  detail: string;
}

export type FulfillmentLabel = "unfulfilled" | "partial" | "fulfilled" | "restocked";

export type JobSource = "SHOPIFY" | "DECO" | "MANUAL";

export interface Order {
  id: string;
  customer: string;
  company: string;
  source: JobSource;
  sourceGroupKey?: string;
  sourceGroupLabel?: string;
  sourceGroupType?: "School" | "Club" | "Other" | "Unassigned";
  status: OrderStatus;
  fulfillment: FulfillmentLabel;
  channel: "Shopify" | "Manual" | "Deco";
  dueDate: string;
  value: number;
  assignee: string;
  artStatus: string;
}

// ── Job detail types (single-job view) ──

export interface JobLineItem {
  id: string;
  sku: string | null;
  productTitle: string;
  variantTitle: string | null;
  quantity: number;
  unitPriceMinor: number | null;
  totalPriceMinor: number | null;
  garmentReference: string | null;
  decorationMethod: string | null;
  decorationPlacement: string | null;
  stockRequirement: JobStockRequirement | null;
}

export interface JobStockRequirement {
  id: string;
  requiredQuantity: number;
  receivedQuantity: number;
  status: string;
  supplierName: string | null;
  supplierReference: string | null;
  eta: string | null;
  isBlocking: boolean;
}

export interface JobActivityEntry {
  id: string;
  eventType: string;
  message: string;
  createdAt: string;
}

export interface JobExternalLink {
  provider: string;
  externalId: string;
}

export interface JobAccountInfo {
  id: string;
  name: string;
  type: string;
  defaultDecorationMethod: string | null;
  defaultProductionNotes: string | null;
}

export interface JobDetail {
  id: string;
  internalJobId: string;
  source: string;
  lifecycle: string;
  classificationStatus: string;
  configurationStatus: string;
  stockStatus: string;
  productionStatus: string;
  approvalStatus: string;
  fulfillmentStatus: string;
  assignedDepartment: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerCompany: string | null;
  schoolName: string | null;
  clubName: string | null;
  leaversYear: string | null;
  currencyCode: string;
  subtotalMinor: number;
  totalMinor: number;
  orderPlacedAt: string | null;
  dueAt: string | null;
  owner: string | null;
  orderNotes: string | null;
  tags: string[];
  sourceGroupKey: string | null;
  sourceGroupLabel: string | null;
  sourceGroupType: string | null;
  shopifyOrderName: string | null;
  decoOrderId: string | null;
  requiresReview: boolean;
  reviewReason: string | null;
  blockedReason: string | null;
  proofVersion: number;
  proofSentAt: string | null;
  approvedAt: string | null;
  productionStartedAt: string | null;
  productionCompletedAt: string | null;
  productionNotes: string | null;
  items: JobLineItem[];
  account: JobAccountInfo | null;
  externalLinks: JobExternalLink[];
  activityLogs: JobActivityEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  region: string;
  segment: string;
  lifetimeValue: number;
  lastOrder: string;
  openOrders: number;
  lastTouch: string;
}

export interface InboxThread {
  id: string;
  customer: string;
  subject: string;
  channel: "Email" | "SMS" | "Internal";
  priority: "High" | "Normal";
  summary: string;
  updatedAt: string;
  linkedOrder: string;
}

export interface Approval {
  id: string;
  jobId: string;
  customer: string;
  status: ApprovalStatus;
  asset: string;
  sentAt: string;
  proofOwner: string;
}

export interface ProductionJob {
  id: string;
  jobId: string;
  customer: string;
  stage: ProductionStage;
  process: "DTF" | "Screen print" | "Embroidery" | "DTG";
  shipDate: string;
  quantity: number;
  operator: string;
}

export interface AccountingRecord {
  id: string;
  jobId: string;
  customer: string;
  type: "Invoice" | "Payment" | "Refund";
  amount: number;
  qboStatus: "Ready" | "Posted" | "Mismatch";
  terms: string;
  updatedAt: string;
}

export interface IntegrationHealth {
  name: string;
  owner: string;
  health: SyncHealth;
  latency: string;
  notes: string;
}

export interface DispatchOrder {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber?: string;
  customer: string;
  company: string;
  quantity: number;
  dueDate: string;
  stage: string;
  fulfillmentStatus: "Unfulfilled" | "Partial" | "Fulfilled" | "Unknown";
  blocked: boolean;
  blockedReason?: string;
  readyToShip: boolean;
}

export interface DecoratorProduct {
  id: string;
  name: string;
  brand: string;
  sku: string;
  garmentColor: string;
  decorationArea: {
    width: number;
    height: number;
  };
}

export interface DecoratorLayer {
  id: string;
  name: string;
  type: "logo" | "text";
  color: string;
  x: number;
  y: number;
  width: number;
  rotation: number;
  opacity: number;
  content: string;
}

export interface DecoratorTemplate {
  id: string;
  name: string;
  description: string;
  layers: DecoratorLayer[];
}

export interface StockPurchaseTask {
  id: string;
  jobId: string;
  account: string;
  supplier: string;
  requiredQty: number;
  status: "Awaiting order" | "Ordered" | "Awaiting arrival" | "Partially received" | "Ready";
  eta: string;
  blocker?: string;
}

export interface WarehouseReceiptTask {
  id: string;
  jobId: string;
  account: string;
  expectedQty: number;
  receivedQty: number;
  branch: string;
  status: "Pending receipt" | "Partial receipt" | "Complete";
  lastScan: string;
}

export interface CommunicationSignal {
  id: string;
  jobId: string;
  account: string;
  channel: "Gmail" | "Slack" | "Internal";
  direction: "Inbound" | "Outbound" | "Alert";
  subject: string;
  state: "Unread" | "Awaiting reply" | "Resolved";
  updatedAt: string;
}
