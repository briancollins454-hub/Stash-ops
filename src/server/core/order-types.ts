export type IntegrationSource =
  | "shopify"
  | "deco"
  | "gmail"
  | "slack"
  | "manual"
  | "system";

export type OrderOrigin = "shopify" | "manual" | "deco";

export type Department =
  | "sales"
  | "design"
  | "purchasing"
  | "production"
  | "dispatch"
  | "finance"
  | "ops";

export type UrgencyLevel = "normal" | "rush" | "critical";

export type DecorationMethod =
  | "dtf"
  | "dtg"
  | "embroidery"
  | "screen_print"
  | "sublimation"
  | "other";

export type ApprovalWorkflowStatus =
  | "not_required"
  | "awaiting_artwork"
  | "proof_in_progress"
  | "proof_sent"
  | "awaiting_customer_approval"
  | "approved"
  | "changes_requested"
  | "rejected";

export type StockWorkflowStatus =
  | "in_stock"
  | "partially_in_stock"
  | "awaiting_supplier"
  | "purchasing_required"
  | "stock_risk"
  | "stock_confirmed";

export type ProductionWorkflowStage =
  | "pending_review"
  | "awaiting_artwork"
  | "awaiting_approval"
  | "approved_awaiting_stock"
  | "ready_for_production"
  | "in_production"
  | "quality_check"
  | "ready_for_dispatch"
  | "dispatched"
  | "complete";

export type CommunicationChannel = "gmail" | "internal_note";

export type ShopifyFulfillmentStatus =
  | "unfulfilled"
  | "partial"
  | "fulfilled"
  | "restocked"
  | "unknown";

export type DesignWorkflowStatus =
  | "not_started"
  | "in_progress"
  | "proof_ready"
  | "customer_approved"
  | "production_locked";

export type StudioViewMode = "3d" | "2d";

export type PurchasingWorkflowStatus =
  | "not_started"
  | "ordered_from_supplier"
  | "in_transit"
  | "scanned_partial"
  | "scanned_complete";

export type ActivityType =
  | "order_created"
  | "order_updated"
  | "approval_status_changed"
  | "stock_status_changed"
  | "production_stage_changed"
  | "communication_logged"
  | "integration_sync"
  | "alert_emitted"
  | "lifecycle_automation";

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postcode?: string;
  country: string;
}

export interface CustomerProfile {
  customerId: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
}

export interface OrderLineItem {
  lineId: string;
  sku: string;
  productTitle: string;
  variantTitle?: string;
  garmentReference?: string;
  quantity: number;
  unitPrice: number;
  decorationMethod: DecorationMethod;
  decorationPlacement?: string;
}

export interface ArtworkFile {
  artworkId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  revision: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ApprovalState {
  status: ApprovalWorkflowStatus;
  proofVersion?: string;
  proofSentAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  notes?: string;
}

export interface StockState {
  status: StockWorkflowStatus;
  shortageDetected: boolean;
  purchasingRequired: boolean;
  supplierEta?: string;
  notes?: string;
}

export interface ProductionState {
  stage: ProductionWorkflowStage;
  startedAt?: string;
  completedAt?: string;
  dispatchBlocked: boolean;
  notes?: string;
}

export interface EmbellishmentPlacement {
  placementId: string;
  method: DecorationMethod;
  location: string;
  widthMm: number;
  heightMm: number;
  offsetXMm: number;
  offsetYMm: number;
  artworkAssetId?: string;
  stitchOrFilm?: string;
}

export interface DesignSetupState {
  status: DesignWorkflowStatus;
  studioView: StudioViewMode;
  productLabel: string;
  garmentSku?: string;
  model3dUrl?: string;
  previewImageUrl?: string;
  placements: EmbellishmentPlacement[];
  notes?: string;
  lastEditedAt?: string;
  lastEditedBy?: string;
}

export interface ReceivingScanEvent {
  scanId: string;
  sku: string;
  quantity: number;
  location?: string;
  scannedAt: string;
  scannedBy: string;
}

export interface PurchasingState {
  status: PurchasingWorkflowStatus;
  supplierName?: string;
  supplierPoNumber?: string;
  orderedAt?: string;
  expectedAt?: string;
  receivedAt?: string;
  scanEvents: ReceivingScanEvent[];
  notes?: string;
}

export interface CommunicationEvent {
  communicationId: string;
  channel: CommunicationChannel;
  direction: "inbound" | "outbound" | "internal";
  subject: string;
  bodyPreview: string;
  providerMessageId?: string;
  attachments?: string[];
  createdAt: string;
  createdBy: string;
}

export interface ActivityLogEntry {
  activityId: string;
  type: ActivityType;
  message: string;
  actor: string;
  source: IntegrationSource;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface IntegrationLinks {
  shopifyOrderId?: string;
  shopifyOrderNumber?: string;
  shopifyFulfillmentStatus?: ShopifyFulfillmentStatus;
  shopifyTags?: string[];
  shopifyNote?: string;
  decoOrderId?: string;
  shipstationShipmentId?: string;
  shipstationLabelBatchId?: string;
  gmailThreadId?: string;
  slackThreadTs?: string;
}

export interface UnifiedOrderRecord {
  internalOrderId: string;
  origin: OrderOrigin;
  externalReferences: IntegrationLinks;
  customer: CustomerProfile;
  billingAddress: Address;
  shippingAddress: Address;
  lineItems: OrderLineItem[];
  artworkFiles: ArtworkFile[];
  designSetup: DesignSetupState;
  approval: ApprovalState;
  stock: StockState;
  purchasing: PurchasingState;
  production: ProductionState;
  communicationTimeline: CommunicationEvent[];
  activityLog: ActivityLogEntry[];
  dueAt?: string;
  urgency: UrgencyLevel;
  assignedDepartment: Department;
  owner?: string;
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManualOrderCreateInput {
  customer: CustomerProfile;
  billingAddress: Address;
  shippingAddress: Address;
  lineItems: OrderLineItem[];
  dueAt?: string;
  urgency?: UrgencyLevel;
  owner?: string;
  assignedDepartment?: Department;
}
