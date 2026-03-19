import {
  autoStageAfterApproval,
  autoStageAfterStock,
  canTransitionProductionStage,
  deriveBlockedReason,
} from "@/server/core/order-state-machine";
import type {
  DecoStockPayload,
  GmailMessagePayload,
  InboundIntegrationEvent,
  ShopifyOrderCreatedPayload,
} from "@/server/core/order-events";
import type {
  ActivityType,
  ApprovalWorkflowStatus,
  DesignSetupState,
  EmbellishmentPlacement,
  IntegrationSource,
  ManualOrderCreateInput,
  PurchasingState,
  ProductionWorkflowStage,
  ShopifyFulfillmentStatus,
  StockWorkflowStatus,
  StudioViewMode,
  UnifiedOrderRecord,
} from "@/server/core/order-types";
import {
  appendCommunication,
  createManualSeedOrder,
  findUnifiedOrderByRefs,
  generateInternalOrderId,
  getUnifiedOrder,
  markIdempotencyKeyProcessed,
  saveUnifiedOrder,
} from "@/server/repositories/unified-order-repository";
import { extractDecoJobNumberCandidate } from "@/server/integrations/bridge-compat";

type TransitionProductionResult =
  | {
      ok: false;
      reason: string;
    }
  | {
      ok: true;
      order: UnifiedOrderRecord;
    };

type InboundProcessingResult =
  | {
      accepted: true;
      duplicate: true;
    }
  | {
      accepted: true;
      orderId?: string;
    };

type DesignSetupPatch = Partial<
  Pick<
    DesignSetupState,
    | "status"
    | "studioView"
    | "productLabel"
    | "garmentSku"
    | "model3dUrl"
    | "previewImageUrl"
    | "notes"
  >
> & {
  placements?: EmbellishmentPlacement[];
};

type PurchasingPatch = Partial<
  Pick<
    PurchasingState,
    "status" | "supplierName" | "supplierPoNumber" | "orderedAt" | "expectedAt" | "receivedAt" | "notes"
  >
>;

type ReceivingScanInput = {
  sku: string;
  quantity: number;
  location?: string;
  scannedBy?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function mapApprovalToDesignStatus(status: ApprovalWorkflowStatus): DesignSetupState["status"] {
  switch (status) {
    case "approved":
      return "customer_approved";
    case "proof_sent":
    case "awaiting_customer_approval":
      return "proof_ready";
    case "changes_requested":
    case "rejected":
    case "proof_in_progress":
      return "in_progress";
    case "awaiting_artwork":
      return "not_started";
    case "not_required":
      return "customer_approved";
    default:
      return "not_started";
  }
}

function mapPurchasingToStockStatus(
  status: NonNullable<PurchasingPatch["status"]>,
): StockWorkflowStatus {
  switch (status) {
    case "not_started":
      return "stock_risk";
    case "ordered_from_supplier":
    case "in_transit":
      return "awaiting_supplier";
    case "scanned_partial":
      return "partially_in_stock";
    case "scanned_complete":
      return "stock_confirmed";
    default:
      return "stock_risk";
  }
}

function activityEntry(
  type: ActivityType,
  message: string,
  actor: string,
  source: IntegrationSource,
  metadata?: Record<string, unknown>,
) {
  return {
    activityId: `act-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    message,
    actor,
    source,
    metadata,
    createdAt: nowIso(),
  };
}

function withActivity(
  order: UnifiedOrderRecord,
  type: ActivityType,
  message: string,
  actor: string,
  source: IntegrationSource,
  metadata?: Record<string, unknown>,
) {
  order.activityLog.push(activityEntry(type, message, actor, source, metadata));
  order.updatedAt = nowIso();
  return order;
}

function normalizeAddress(address?: {
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
}) {
  return {
    line1: address?.address1 ?? "Unknown",
    line2: address?.address2,
    city: address?.city ?? "Unknown",
    state: address?.province,
    postcode: address?.zip,
    country: address?.country ?? "US",
  };
}

function normalizeShopifyFulfillmentStatus(
  status?: string | ShopifyFulfillmentStatus,
): ShopifyFulfillmentStatus {
  if (!status) {
    return "unknown";
  }

  const normalized = String(status).toUpperCase();
  if (normalized === "FULFILLED") {
    return "fulfilled";
  }
  if (normalized === "PARTIAL" || normalized === "PARTIALLY_FULFILLED") {
    return "partial";
  }
  if (normalized === "RESTOCKED") {
    return "restocked";
  }
  if (
    normalized === "UNFULFILLED" ||
    normalized === "OPEN" ||
    normalized === "IN_PROGRESS" ||
    normalized === "ON_HOLD" ||
    normalized === "PENDING_FULFILLMENT" ||
    normalized === "SCHEDULED"
  ) {
    return "unfulfilled";
  }

  if (
    status === "unfulfilled" ||
    status === "partial" ||
    status === "fulfilled" ||
    status === "restocked" ||
    status === "unknown"
  ) {
    return status;
  }

  return "unknown";
}

function parseShopifyTags(raw?: string) {
  if (!raw) {
    return [];
  }

  const seen = new Set<string>();
  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return parsed;
}

export async function createManualOrder(input: ManualOrderCreateInput, actor = "ops.user") {
  const order = await createManualSeedOrder(input);

  withActivity(
    order,
    "order_created",
    `Manual order ${order.internalOrderId} was created.`,
    actor,
    "manual",
  );

  return saveUnifiedOrder(order);
}

export async function updateOrderMetadata(
  orderId: string,
  patch: Partial<
    Pick<UnifiedOrderRecord, "owner" | "assignedDepartment" | "dueAt" | "urgency">
  >,
  actor = "ops.user",
) {
  const existing = await getUnifiedOrder(orderId);
  if (!existing) {
    return undefined;
  }

  const next: UnifiedOrderRecord = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };

  withActivity(
    next,
    "order_updated",
    `Order metadata updated for ${orderId}.`,
    actor,
    "manual",
    patch,
  );

  return saveUnifiedOrder(next);
}

export async function applyApprovalStatus(
  orderId: string,
  status: ApprovalWorkflowStatus,
  actor = "ops.user",
  notes?: string,
) {
  const existing = await getUnifiedOrder(orderId);
  if (!existing) {
    return undefined;
  }

  const next: UnifiedOrderRecord = {
    ...existing,
    designSetup: {
      ...existing.designSetup,
      status: mapApprovalToDesignStatus(status),
      lastEditedAt: nowIso(),
      lastEditedBy: actor,
    },
    approval: {
      ...existing.approval,
      status,
      notes,
      approvedAt: status === "approved" ? nowIso() : existing.approval.approvedAt,
      rejectedAt: status === "rejected" ? nowIso() : existing.approval.rejectedAt,
    },
    updatedAt: nowIso(),
  };

  next.production.stage = autoStageAfterApproval(next);
  next.blockedReason = deriveBlockedReason(next);
  next.production.dispatchBlocked = Boolean(next.blockedReason);

  withActivity(
    next,
    "approval_status_changed",
    `Approval moved to ${status}.`,
    actor,
    "manual",
    { notes },
  );

  if (next.production.stage === "ready_for_production") {
    withActivity(
      next,
      "lifecycle_automation",
      "Production auto-unlocked after approval and stock checks passed.",
      "system",
      "system",
    );
  }

  return saveUnifiedOrder(next);
}

export async function applyStockStatus(
  orderId: string,
  status: StockWorkflowStatus,
  actor = "ops.user",
  notes?: string,
) {
  const existing = await getUnifiedOrder(orderId);
  if (!existing) {
    return undefined;
  }

  const next: UnifiedOrderRecord = {
    ...existing,
    stock: {
      ...existing.stock,
      status,
      shortageDetected: ["partially_in_stock", "awaiting_supplier", "stock_risk"].includes(
        status,
      ),
      purchasingRequired: ["awaiting_supplier", "purchasing_required", "stock_risk"].includes(
        status,
      ),
      notes,
    },
    updatedAt: nowIso(),
  };

  next.production.stage = autoStageAfterStock(next);
  next.blockedReason = deriveBlockedReason(next);
  next.production.dispatchBlocked = Boolean(next.blockedReason);

  withActivity(
    next,
    "stock_status_changed",
    `Stock moved to ${status}.`,
    actor,
    "manual",
    { notes },
  );

  if (next.production.stage === "ready_for_production") {
    withActivity(
      next,
      "lifecycle_automation",
      "Production auto-unlocked after stock confirmation.",
      "system",
      "system",
    );
  }

  return saveUnifiedOrder(next);
}

export async function updateDesignSetup(
  orderId: string,
  patch: DesignSetupPatch,
  actor = "design.user",
) {
  const existing = await getUnifiedOrder(orderId);
  if (!existing) {
    return undefined;
  }

  const next: UnifiedOrderRecord = {
    ...existing,
    designSetup: {
      ...existing.designSetup,
      ...patch,
      studioView: (patch.studioView ?? existing.designSetup.studioView) as StudioViewMode,
      placements: patch.placements ?? existing.designSetup.placements,
      lastEditedAt: nowIso(),
      lastEditedBy: actor,
    },
    updatedAt: nowIso(),
  };

  if (
    next.designSetup.status === "proof_ready" &&
    (next.approval.status === "awaiting_artwork" || next.approval.status === "proof_in_progress")
  ) {
    next.approval.status = "proof_sent";
    next.approval.proofSentAt = nowIso();
  }

  next.blockedReason = deriveBlockedReason(next);
  next.production.dispatchBlocked = Boolean(next.blockedReason);

  withActivity(
    next,
    "order_updated",
    "Design setup updated (placements/view/proof configuration).",
    actor,
    "manual",
  );

  return saveUnifiedOrder(next);
}

export async function updatePurchasingStatus(
  orderId: string,
  patch: PurchasingPatch,
  actor = "purchasing.user",
) {
  const existing = await getUnifiedOrder(orderId);
  if (!existing) {
    return undefined;
  }

  const nextStatus = patch.status ?? existing.purchasing.status;

  const next: UnifiedOrderRecord = {
    ...existing,
    purchasing: {
      ...existing.purchasing,
      ...patch,
      status: nextStatus,
      scanEvents: existing.purchasing.scanEvents,
      orderedAt:
        patch.orderedAt ??
        existing.purchasing.orderedAt ??
        (nextStatus === "ordered_from_supplier" ? nowIso() : undefined),
      receivedAt:
        patch.receivedAt ??
        existing.purchasing.receivedAt ??
        (nextStatus === "scanned_complete" ? nowIso() : undefined),
    },
    updatedAt: nowIso(),
  };

  if (patch.status) {
    const nextStockStatus = mapPurchasingToStockStatus(patch.status);
    next.stock = {
      ...next.stock,
      status: nextStockStatus,
      shortageDetected: ["partially_in_stock", "awaiting_supplier", "stock_risk"].includes(
        nextStockStatus,
      ),
      purchasingRequired: ["awaiting_supplier", "purchasing_required", "stock_risk"].includes(
        nextStockStatus,
      ),
      notes: patch.notes ?? next.stock.notes,
    };

    next.production.stage = autoStageAfterStock(next);
  }

  next.blockedReason = deriveBlockedReason(next);
  next.production.dispatchBlocked = Boolean(next.blockedReason);

  withActivity(
    next,
    "stock_status_changed",
    `Purchasing workflow moved to ${next.purchasing.status}.`,
    actor,
    "manual",
    {
      supplierName: next.purchasing.supplierName,
      supplierPoNumber: next.purchasing.supplierPoNumber,
    },
  );

  return saveUnifiedOrder(next);
}

export async function recordReceivingScan(
  orderId: string,
  input: ReceivingScanInput,
  actor = "warehouse.user",
) {
  const existing = await getUnifiedOrder(orderId);
  if (!existing) {
    return undefined;
  }

  const scanEvent = {
    scanId: `scan-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    sku: input.sku,
    quantity: Math.max(1, input.quantity),
    location: input.location,
    scannedAt: nowIso(),
    scannedBy: input.scannedBy ?? actor,
  };

  const scanEvents = [...existing.purchasing.scanEvents, scanEvent];
  const scannedTotal = scanEvents.reduce((sum, scan) => sum + scan.quantity, 0);
  const requiredTotal = existing.lineItems.reduce((sum, item) => sum + item.quantity, 0);
  const purchasingStatus =
    scannedTotal >= requiredTotal ? "scanned_complete" : ("scanned_partial" as const);
  const stockStatus = scannedTotal >= requiredTotal ? "stock_confirmed" : "partially_in_stock";

  const next: UnifiedOrderRecord = {
    ...existing,
    purchasing: {
      ...existing.purchasing,
      status: purchasingStatus,
      scanEvents,
      receivedAt: scannedTotal >= requiredTotal ? nowIso() : existing.purchasing.receivedAt,
    },
    stock: {
      ...existing.stock,
      status: stockStatus,
      shortageDetected: stockStatus !== "stock_confirmed",
      purchasingRequired: stockStatus !== "stock_confirmed",
    },
    updatedAt: nowIso(),
  };

  next.production.stage = autoStageAfterStock(next);
  next.blockedReason = deriveBlockedReason(next);
  next.production.dispatchBlocked = Boolean(next.blockedReason);

  withActivity(
    next,
    "stock_status_changed",
    `Receiving scan logged (${scanEvent.quantity} units of ${scanEvent.sku}).`,
    actor,
    "manual",
    {
      location: scanEvent.location,
      scannedBy: scanEvent.scannedBy,
      scannedTotal,
      requiredTotal,
    },
  );

  return saveUnifiedOrder(next);
}

export async function transitionProductionStage(
  orderId: string,
  nextStage: ProductionWorkflowStage,
  actor = "ops.user",
  notes?: string,
): Promise<TransitionProductionResult> {
  const existing = await getUnifiedOrder(orderId);
  if (!existing) {
    return {
      ok: false,
      reason: "Order not found.",
    };
  }

  const check = canTransitionProductionStage(existing, nextStage);
  if (!check.allowed) {
    return {
      ok: false,
      reason: check.reason ?? "Transition not allowed.",
    };
  }

  const next: UnifiedOrderRecord = {
    ...existing,
    designSetup: {
      ...existing.designSetup,
      status:
        nextStage === "in_production" ||
        nextStage === "quality_check" ||
        nextStage === "ready_for_dispatch" ||
        nextStage === "dispatched" ||
        nextStage === "complete"
          ? "production_locked"
          : existing.designSetup.status,
      lastEditedAt:
        nextStage === "in_production" ||
        nextStage === "quality_check" ||
        nextStage === "ready_for_dispatch" ||
        nextStage === "dispatched" ||
        nextStage === "complete"
          ? nowIso()
          : existing.designSetup.lastEditedAt,
      lastEditedBy:
        nextStage === "in_production" ||
        nextStage === "quality_check" ||
        nextStage === "ready_for_dispatch" ||
        nextStage === "dispatched" ||
        nextStage === "complete"
          ? actor
          : existing.designSetup.lastEditedBy,
    },
    production: {
      ...existing.production,
      stage: nextStage,
      startedAt:
        nextStage === "in_production"
          ? existing.production.startedAt ?? nowIso()
          : existing.production.startedAt,
      completedAt: nextStage === "complete" ? nowIso() : existing.production.completedAt,
    },
    updatedAt: nowIso(),
  };

  next.blockedReason = deriveBlockedReason(next);
  next.production.dispatchBlocked = Boolean(next.blockedReason);

  withActivity(
    next,
    "production_stage_changed",
    `Production moved to ${nextStage}.`,
    actor,
    "manual",
    { notes },
  );

  if (nextStage === "complete") {
    withActivity(
      next,
      "integration_sync",
      next.externalReferences.decoOrderId
        ? `Order completed and queued for Deco update (${next.externalReferences.decoOrderId}).`
        : "Order completed and queued for Deco import.",
      actor,
      "deco",
    );
  }

  return {
    ok: true,
    order: await saveUnifiedOrder(next),
  };
}

export async function ingestShopifyOrder(
  payload: ShopifyOrderCreatedPayload,
  actor = "shopify.webhook",
) {
  const decoJobCandidate = extractDecoJobNumberCandidate(payload.note);
  const existing = await findUnifiedOrderByRefs({
    shopifyOrderId: payload.id,
  });

  if (existing) {
    existing.externalReferences.shopifyOrderNumber =
      payload.orderNumber ?? existing.externalReferences.shopifyOrderNumber;
    existing.externalReferences.shopifyFulfillmentStatus = normalizeShopifyFulfillmentStatus(
      payload.fulfillmentStatus ?? existing.externalReferences.shopifyFulfillmentStatus,
    );
    existing.externalReferences.shopifyTags = parseShopifyTags(payload.tags);
    existing.externalReferences.shopifyNote = payload.note ?? existing.externalReferences.shopifyNote;

    withActivity(
      existing,
      "integration_sync",
      `Shopify order ${payload.id} received again; idempotent update.`,
      actor,
      "shopify",
    );
    return saveUnifiedOrder(existing);
  }

  const now = nowIso();
  const internalOrderId = await generateInternalOrderId();
  const fullName =
    `${payload.customer.firstName ?? ""} ${payload.customer.lastName ?? ""}`.trim() ||
    payload.customer.company ||
    "Unknown customer";

  const order: UnifiedOrderRecord = {
    internalOrderId,
    origin: "shopify",
    externalReferences: {
      shopifyOrderId: payload.id,
      shopifyOrderNumber: payload.orderNumber,
      shopifyFulfillmentStatus: normalizeShopifyFulfillmentStatus(payload.fulfillmentStatus),
      shopifyTags: parseShopifyTags(payload.tags),
      shopifyNote: payload.note,
      decoOrderId: decoJobCandidate,
    },
    customer: {
      customerId: String(payload.customer.id ?? payload.id),
      name: fullName,
      company: payload.customer.company,
      email: payload.customer.email,
      phone: payload.customer.phone,
    },
    billingAddress: normalizeAddress(payload.billingAddress),
    shippingAddress: normalizeAddress(payload.shippingAddress),
    lineItems: payload.lineItems.map((line) => ({
      lineId: String(line.id),
      sku: line.sku ?? "UNKNOWN-SKU",
      productTitle: line.title ?? "Custom item",
      variantTitle: line.variantTitle,
      quantity: Number(line.quantity ?? 1),
      unitPrice: Number(line.price ?? 0),
      decorationMethod: "other",
    })),
    artworkFiles: [],
    designSetup: {
      status: "not_started",
      studioView: "2d",
      productLabel: payload.lineItems[0]?.title ?? "Custom item",
      garmentSku: payload.lineItems[0]?.sku,
      placements: [],
    },
    approval: {
      status: "awaiting_artwork",
    },
    stock: {
      status: "stock_risk",
      shortageDetected: false,
      purchasingRequired: false,
    },
    purchasing: {
      status: "not_started",
      scanEvents: [],
    },
    production: {
      stage: "pending_review",
      dispatchBlocked: true,
    },
    communicationTimeline: [],
    activityLog: [
      activityEntry(
        "order_created",
        `Order ingested from Shopify ${payload.id}.`,
        actor,
        "shopify",
      ),
    ],
    dueAt: undefined,
    urgency: "normal",
    assignedDepartment: "ops",
    owner: undefined,
    blockedReason: "Waiting for artwork and stock review.",
    createdAt: now,
    updatedAt: now,
  };

  return saveUnifiedOrder(order);
}

export async function ingestDecoStockUpdate(
  refs: { internalOrderId?: string; decoOrderId?: string },
  payload: DecoStockPayload,
) {
  const existing = await findUnifiedOrderByRefs({
    internalOrderId: refs.internalOrderId,
    decoOrderId: refs.decoOrderId ?? payload.decoOrderId,
  });

  if (!existing) {
    return undefined;
  }

  return applyStockStatus(
    existing.internalOrderId,
    (payload.stockStatus as StockWorkflowStatus) ?? "stock_risk",
    "deco.webhook",
    payload.notes,
  );
}

export async function recordGmailMessage(
  orderId: string,
  payload: GmailMessagePayload,
  direction: "inbound" | "outbound",
) {
  const order = await getUnifiedOrder(orderId);
  if (!order) {
    return undefined;
  }

  const communication = {
    communicationId: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    channel: "gmail" as const,
    direction,
    subject: payload.subject ?? "(no subject)",
    bodyPreview: payload.snippet ?? "",
    providerMessageId: payload.messageId,
    attachments: payload.attachments,
    createdAt: nowIso(),
    createdBy: "gmail.integration",
  };

  await appendCommunication(orderId, communication);

  const refreshed = await getUnifiedOrder(orderId);
  if (!refreshed) {
    return undefined;
  }

  withActivity(
    refreshed,
    "communication_logged",
    `Gmail ${direction} message attached to order.`,
    "gmail.integration",
    "gmail",
    { subject: payload.subject, threadId: payload.threadId },
  );

  if (payload.threadId && !refreshed.externalReferences.gmailThreadId) {
    refreshed.externalReferences.gmailThreadId = payload.threadId;
  }

  return saveUnifiedOrder(refreshed);
}

export async function processInboundEvent(
  event: InboundIntegrationEvent,
): Promise<InboundProcessingResult> {
  const accepted = await markIdempotencyKeyProcessed(event.idempotencyKey);
  if (!accepted) {
    return {
      accepted: true,
      duplicate: true,
    };
  }

  switch (event.eventType) {
    case "shopify.order.created": {
      const order = await ingestShopifyOrder(
        event.payload as ShopifyOrderCreatedPayload,
        "shopify.webhook",
      );
      return { accepted: true, orderId: order.internalOrderId };
    }

    case "shopify.order.updated": {
      const payload = event.payload as ShopifyOrderCreatedPayload;
      const found = await findUnifiedOrderByRefs({ shopifyOrderId: payload.id });
      if (!found) {
        const created = await ingestShopifyOrder(payload, "shopify.webhook");
        return { accepted: true, orderId: created.internalOrderId };
      }

      const decoJobCandidate = extractDecoJobNumberCandidate(payload.note);
      if (decoJobCandidate) {
        found.externalReferences.decoOrderId = decoJobCandidate;
      }
      found.externalReferences.shopifyOrderNumber =
        payload.orderNumber ?? found.externalReferences.shopifyOrderNumber;
      found.externalReferences.shopifyFulfillmentStatus = normalizeShopifyFulfillmentStatus(
        payload.fulfillmentStatus ?? found.externalReferences.shopifyFulfillmentStatus,
      );
      found.externalReferences.shopifyTags = parseShopifyTags(payload.tags);
      found.externalReferences.shopifyNote = payload.note ?? found.externalReferences.shopifyNote;

      withActivity(
        found,
        "integration_sync",
        `Shopify order ${payload.id} updated.`,
        "shopify.webhook",
        "shopify",
      );
      const saved = await saveUnifiedOrder(found);
      return { accepted: true, orderId: saved.internalOrderId };
    }

    case "deco.order.synced": {
      const payload = event.payload as { decoOrderId?: string };
      const found = await findUnifiedOrderByRefs({
        internalOrderId: event.refs.internalOrderId,
        shopifyOrderId: event.refs.shopifyOrderId,
      });
      if (!found) {
        return { accepted: true };
      }
      found.externalReferences.decoOrderId =
        payload.decoOrderId ?? event.refs.decoOrderId ?? found.externalReferences.decoOrderId;
      withActivity(
        found,
        "integration_sync",
        "Deco linkage synchronized.",
        "deco.webhook",
        "deco",
      );
      const saved = await saveUnifiedOrder(found);
      return { accepted: true, orderId: saved.internalOrderId };
    }

    case "deco.stock.updated": {
      const order = await ingestDecoStockUpdate(event.refs, event.payload as DecoStockPayload);
      return { accepted: true, orderId: order?.internalOrderId };
    }

    case "gmail.message.received": {
      const found = await findUnifiedOrderByRefs(event.refs);
      if (!found) {
        return { accepted: true, orderId: undefined };
      }
      const order = await recordGmailMessage(
        found.internalOrderId,
        event.payload as GmailMessagePayload,
        "inbound",
      );
      return { accepted: true, orderId: order?.internalOrderId };
    }

    case "gmail.message.sent": {
      const found = await findUnifiedOrderByRefs(event.refs);
      if (!found) {
        return { accepted: true, orderId: undefined };
      }
      const order = await recordGmailMessage(
        found.internalOrderId,
        event.payload as GmailMessagePayload,
        "outbound",
      );
      return { accepted: true, orderId: order?.internalOrderId };
    }

    case "slack.alert.received": {
      const found = await findUnifiedOrderByRefs(event.refs);
      if (!found) {
        return { accepted: true };
      }
      withActivity(
        found,
        "alert_emitted",
        "Slack alert associated with order.",
        "slack.integration",
        "slack",
      );
      const saved = await saveUnifiedOrder(found);
      return { accepted: true, orderId: saved.internalOrderId };
    }

    default:
      return { accepted: true };
  }
}
