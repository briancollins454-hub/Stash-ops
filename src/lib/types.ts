export type OrderStatus =
  | "New"
  | "Artwork"
  | "Approval"
  | "Queued"
  | "Printing"
  | "Shipping";

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

export interface Order {
  id: string;
  customer: string;
  company: string;
  sourceGroupKey?: string;
  sourceGroupLabel?: string;
  sourceGroupType?: "School" | "Club" | "Other" | "Unassigned";
  status: OrderStatus;
  channel: "Shopify" | "Manual" | "Sales rep";
  dueDate: string;
  value: number;
  assignee: string;
  artStatus: string;
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
  orderId: string;
  customer: string;
  status: ApprovalStatus;
  asset: string;
  sentAt: string;
  proofOwner: string;
}

export interface ProductionJob {
  id: string;
  orderId: string;
  customer: string;
  stage: ProductionStage;
  process: "DTF" | "Screen print" | "Embroidery" | "DTG";
  shipDate: string;
  quantity: number;
  operator: string;
}

export interface AccountingRecord {
  id: string;
  orderId: string;
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
  orderId: string;
  account: string;
  supplier: string;
  requiredQty: number;
  status: "Awaiting order" | "Ordered" | "Awaiting arrival" | "Partially received" | "Ready";
  eta: string;
  blocker?: string;
}

export interface WarehouseReceiptTask {
  id: string;
  orderId: string;
  account: string;
  expectedQty: number;
  receivedQty: number;
  branch: string;
  status: "Pending receipt" | "Partial receipt" | "Complete";
  lastScan: string;
}

export interface CommunicationSignal {
  id: string;
  orderId: string;
  account: string;
  channel: "Gmail" | "Slack" | "Internal";
  direction: "Inbound" | "Outbound" | "Alert";
  subject: string;
  state: "Unread" | "Awaiting reply" | "Resolved";
  updatedAt: string;
}
