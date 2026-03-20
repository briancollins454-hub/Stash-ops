import type {
  AccountingRecord,
  Approval,
  Customer,
  InboxThread,
  IntegrationHealth,
  Metric,
  Order,
  ProductionJob,
} from "@/lib/types";
import type {
  ApprovalWorkflowStatus,
  DecorationMethod,
  ProductionWorkflowStage,
  UnifiedOrderRecord,
} from "@/server/core/order-types";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";
import {
  mapBackendJobToLegacyRecord,
  type BackendJobFull,
} from "@/lib/backend-order-adapter";
import { isDecoConnectorConfigured } from "@/server/integrations/deco-connector";
import { isShopifyConnectorConfigured } from "@/server/integrations/shopify-connector";
import { isQboConnectorConfigured } from "@/server/integrations/qbo-connector";
import { isGmailConnectorConfigured } from "@/server/integrations/gmail-connector";
import { isSlackConnectorConfigured } from "@/server/integrations/slack-connector";
import { isShipstationConnectorConfigured } from "@/server/integrations/shipstation-connector";

const terminalStages: ProductionWorkflowStage[] = ["dispatched", "complete"];

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

function formatTimeAgo(value?: string) {
  if (!value) {
    return "now";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "now";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function titleCase(value?: string) {
  if (!value) {
    return "Unassigned";
  }

  return value
    .split(/[ _-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unassigned";
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

function inferSourceGroup(order: UnifiedOrderRecord) {
  const tags = order.externalReferences.shopifyTags ?? [];
  for (const rawTag of tags) {
    const tag = rawTag.trim();
    if (!tag) {
      continue;
    }

    const prefixed = tag.match(
      /^(school|club|team|house|campus|site|group)\s*[:|-]\s*(.+)$/i,
    );
    if (prefixed?.[2]) {
      const label = prefixed[2].trim();
      if (label) {
        const type =
          prefixed[1].toLowerCase() === "school" || prefixed[1].toLowerCase() === "campus"
            ? "School"
            : prefixed[1].toLowerCase() === "club" || prefixed[1].toLowerCase() === "team"
            ? "Club"
            : "Other";

        return {
          key: slugify(label),
          label,
          type,
        } as const;
      }
    }

    if (/\b(school|academy|college|club|fc|rfc|cc|team)\b/i.test(tag)) {
      const label = tag.trim();
      return {
        key: slugify(label),
        label,
        type: classifyGroupType(label),
      } as const;
    }
  }

  const note = order.externalReferences.shopifyNote;
  const noteMatch = note?.match(/(?:school|club|team|house)\s*[:|-]\s*([^\n,;]+)/i);
  if (noteMatch?.[1]) {
    const label = noteMatch[1].trim();
    if (label) {
      return {
        key: slugify(label),
        label,
        type: classifyGroupType(label),
      } as const;
    }
  }

  const company =
    order.customer.company && order.customer.company !== order.customer.name
      ? order.customer.company
      : undefined;
  if (company) {
    return {
      key: slugify(company),
      label: company,
      type: classifyGroupType(company),
    } as const;
  }

  return {
    key: "unassigned",
    label: "Unassigned",
    type: "Unassigned",
  } as const;
}

function sumOrderValue(order: UnifiedOrderRecord) {
  return order.lineItems.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}

function mapLegacyOrderStatus(order: UnifiedOrderRecord): Order["status"] {
  const stage = order.production.stage;
  const approval = order.approval.status;

  if (stage === "dispatched" || stage === "complete") {
    return "Complete";
  }
  if (stage === "in_production" || stage === "quality_check" || stage === "ready_for_dispatch") {
    return "Printing";
  }
  if (stage === "ready_for_production") {
    return "Queued";
  }
  if (stage === "approved_awaiting_stock") {
    return "Stock";
  }
  if (approval === "awaiting_customer_approval" || approval === "proof_sent") {
    return "Approval";
  }
  if (
    approval === "awaiting_artwork" ||
    approval === "proof_in_progress" ||
    approval === "changes_requested" ||
    approval === "rejected"
  ) {
    return "Artwork";
  }

  return "New";
}

function mapLegacyOrderChannel(order: UnifiedOrderRecord): Order["channel"] {
  if (order.origin === "shopify") {
    return "Shopify";
  }
  if (order.origin === "manual") {
    return "Manual";
  }
  return "Deco";
}

function mapArtStatus(status: ApprovalWorkflowStatus) {
  switch (status) {
    case "not_required":
      return "No proof required";
    case "awaiting_artwork":
      return "Awaiting artwork";
    case "proof_in_progress":
      return "Proof in progress";
    case "proof_sent":
      return "Proof sent";
    case "awaiting_customer_approval":
      return "Awaiting customer approval";
    case "approved":
      return "Approved";
    case "changes_requested":
      return "Changes requested";
    case "rejected":
      return "Rejected";
    default:
      return "Awaiting artwork";
  }
}

function mapLegacyApprovalStatus(status: ApprovalWorkflowStatus): Approval["status"] {
  if (status === "approved") {
    return "Approved";
  }
  if (
    status === "awaiting_customer_approval" ||
    status === "proof_sent" ||
    status === "changes_requested" ||
    status === "rejected"
  ) {
    return "Awaiting client";
  }
  return "Needs proof";
}

function mapLegacyProductionStage(stage: ProductionWorkflowStage): ProductionJob["stage"] {
  switch (stage) {
    case "approved_awaiting_stock":
      return "Waiting on stock";
    case "ready_for_production":
      return "Ready for print";
    case "in_production":
    case "quality_check":
      return "On press";
    case "ready_for_dispatch":
    case "dispatched":
    case "complete":
      return "Packing";
    case "pending_review":
    case "awaiting_artwork":
    case "awaiting_approval":
    default:
      return "Preflight";
  }
}

function mapLegacyProcess(method: DecorationMethod): ProductionJob["process"] {
  switch (method) {
    case "dtf":
      return "DTF";
    case "screen_print":
      return "Screen print";
    case "embroidery":
      return "Embroidery";
    case "dtg":
    case "sublimation":
    case "other":
    default:
      return "DTG";
  }
}

async function buildOrderSnapshot() {
  let orders: UnifiedOrderRecord[] = [];

  if (isBackendApiConfigured()) {
    try {
      const payload = await fetchBackendJson<{
        items: BackendJobFull[];
      }>("/api/v1/orders?lane=all&limit=300");
      orders = payload.items.map(mapBackendJobToLegacyRecord);
    } catch (error) {
      console.error("Failed to load jobs from backend for projections.", error);
    }
  }

  const byUrgency = [...orders].sort((a, b) => {
    const rank = (value: UnifiedOrderRecord["urgency"]) => {
      if (value === "critical") return 0;
      if (value === "rush") return 1;
      return 2;
    };
    const urgencyDiff = rank(a.urgency) - rank(b.urgency);
    if (urgencyDiff !== 0) {
      return urgencyDiff;
    }
    return a.dueAt && b.dueAt ? Number(new Date(a.dueAt)) - Number(new Date(b.dueAt)) : 0;
  });

  return {
    orders,
    byUrgency,
  };
}

export async function projectOrders(): Promise<Order[]> {
  const { byUrgency } = await buildOrderSnapshot();

  return byUrgency.map((order) => ({
    ...(() => {
      const sourceGroup = inferSourceGroup(order);
      return {
        sourceGroupKey: sourceGroup.key,
        sourceGroupLabel: sourceGroup.label,
        sourceGroupType: sourceGroup.type,
      };
    })(),
    id: order.internalOrderId,
    customer: order.customer.name,
    company: order.customer.company ?? order.customer.name,
    source: order.origin === "shopify" ? "SHOPIFY" : order.origin === "manual" ? "MANUAL" : "DECO",
    status: mapLegacyOrderStatus(order),
    fulfillment: "unfulfilled" as const,
    channel: mapLegacyOrderChannel(order),
    dueDate: formatMonthDay(order.dueAt),
    value: sumOrderValue(order),
    assignee: titleCase(order.owner),
    artStatus: mapArtStatus(order.approval.status),
  }));
}

export async function projectApprovals(): Promise<Approval[]> {
  const { byUrgency } = await buildOrderSnapshot();

  return byUrgency
    .filter((order) => order.approval.status !== "not_required")
    .map((order) => ({
      id: `AP-${order.internalOrderId.replace("ST-", "")}`,
      jobId: order.internalOrderId,
      customer: order.customer.company ?? order.customer.name,
      status: mapLegacyApprovalStatus(order.approval.status),
      asset:
        order.lineItems[0]?.decorationPlacement ??
        order.lineItems[0]?.productTitle ??
        "Artwork package",
      sentAt: order.approval.proofSentAt
        ? formatTimeAgo(order.approval.proofSentAt)
        : "Not sent",
      proofOwner: titleCase(order.owner),
    }));
}

export async function projectProductionJobs(): Promise<ProductionJob[]> {
  const { byUrgency } = await buildOrderSnapshot();

  return byUrgency
    .filter((order) => !terminalStages.includes(order.production.stage))
    .map((order) => ({
      id: `PR-${order.internalOrderId.replace("ST-", "")}`,
      jobId: order.internalOrderId,
      customer: order.customer.company ?? order.customer.name,
      stage: mapLegacyProductionStage(order.production.stage),
      process: mapLegacyProcess(order.lineItems[0]?.decorationMethod ?? "other"),
      shipDate: formatMonthDay(order.dueAt),
      quantity: order.lineItems.reduce((sum, line) => sum + line.quantity, 0),
      operator: titleCase(order.owner),
    }));
}

export async function projectAccountingRecords(): Promise<AccountingRecord[]> {
  const { byUrgency } = await buildOrderSnapshot();

  return byUrgency.map((order) => {
    const stockRisk =
      order.stock.status === "stock_risk" ||
      order.stock.status === "awaiting_supplier" ||
      order.stock.status === "purchasing_required" ||
      order.stock.status === "partially_in_stock";

    const qboStatus: AccountingRecord["qboStatus"] = stockRisk
      ? "Mismatch"
      : terminalStages.includes(order.production.stage)
        ? "Posted"
        : "Ready";

    return {
      id: `AR-${order.internalOrderId.replace("ST-", "")}`,
      jobId: order.internalOrderId,
      customer: order.customer.company ?? order.customer.name,
      type: terminalStages.includes(order.production.stage) ? "Payment" : "Invoice",
      amount: sumOrderValue(order),
      qboStatus,
      terms: order.origin === "manual" ? "Card" : "Net 15",
      updatedAt: formatTimeAgo(order.updatedAt),
    };
  });
}

export async function projectInboxThreads(): Promise<InboxThread[]> {
  const { byUrgency } = await buildOrderSnapshot();
  const threads: Array<InboxThread & { timestamp: number }> = [];

  byUrgency.forEach((order) => {
    order.communicationTimeline.forEach((message) => {
      threads.push({
        id: message.communicationId,
        customer: order.customer.company ?? order.customer.name,
        subject: message.subject,
        channel: message.channel === "gmail" ? "Email" : "Internal",
        priority: order.urgency === "critical" || order.urgency === "rush" ? "High" : "Normal",
        summary: message.bodyPreview || order.blockedReason || "No summary available.",
        updatedAt: formatTimeAgo(message.createdAt),
        linkedOrder: order.internalOrderId,
        timestamp: Number(new Date(message.createdAt)),
      });
    });

    if (order.communicationTimeline.length === 0 && order.blockedReason) {
      threads.push({
        id: `TH-${order.internalOrderId}`,
        customer: order.customer.company ?? order.customer.name,
        subject: `Job ${order.internalOrderId} requires attention`,
        channel: "Internal",
        priority: order.urgency === "critical" || order.urgency === "rush" ? "High" : "Normal",
        summary: order.blockedReason,
        updatedAt: formatTimeAgo(order.updatedAt),
        linkedOrder: order.internalOrderId,
        timestamp: Number(new Date(order.updatedAt)),
      });
    }
  });

  return threads
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((thread) => ({
      id: thread.id,
      customer: thread.customer,
      subject: thread.subject,
      channel: thread.channel,
      priority: thread.priority,
      summary: thread.summary,
      updatedAt: thread.updatedAt,
      linkedOrder: thread.linkedOrder,
    }));
}

export async function projectCustomers(): Promise<Customer[]> {
  const { orders } = await buildOrderSnapshot();
  const byCustomer = new Map<
    string,
    {
      name: string;
      company: string;
      region: string;
      totalValue: number;
      openOrders: number;
      lastUpdatedAt: string;
      lastTouch: string;
      originSet: Set<string>;
    }
  >();

  orders.forEach((order) => {
    const key = order.customer.customerId;
    const existing = byCustomer.get(key);
    const orderValue = sumOrderValue(order);
    const region = order.shippingAddress.state ?? order.shippingAddress.country;
    const lastTouch =
      order.communicationTimeline.at(-1)?.subject ??
      order.blockedReason ??
      mapArtStatus(order.approval.status);

    if (!existing) {
      byCustomer.set(key, {
        name: order.customer.name,
        company: order.customer.company ?? order.customer.name,
        region,
        totalValue: orderValue,
        openOrders: terminalStages.includes(order.production.stage) ? 0 : 1,
        lastUpdatedAt: order.updatedAt,
        lastTouch,
        originSet: new Set([order.origin]),
      });
      return;
    }

    existing.totalValue += orderValue;
    existing.openOrders += terminalStages.includes(order.production.stage) ? 0 : 1;
    existing.originSet.add(order.origin);
    if (order.updatedAt > existing.lastUpdatedAt) {
      existing.lastUpdatedAt = order.updatedAt;
      existing.lastTouch = lastTouch;
    }
  });

  return Array.from(byCustomer.entries())
    .map(([id, profile]) => {
      const segment =
        profile.originSet.size > 1
          ? "Omnichannel"
          : profile.originSet.has("manual")
            ? "Manual accounts"
            : "Storefront";

      return {
        id,
        name: profile.name,
        company: profile.company,
        region: profile.region,
        segment,
        lifetimeValue: profile.totalValue,
        lastOrder: formatMonthDay(profile.lastUpdatedAt),
        openOrders: profile.openOrders,
        lastTouch: profile.lastTouch,
      } satisfies Customer;
    })
    .sort((a, b) => b.lifetimeValue - a.lifetimeValue);
}

export async function projectMetrics(): Promise<Metric[]> {
  const [orders, accounting, threads] = await Promise.all([
    projectOrders(),
    projectAccountingRecords(),
    projectInboxThreads(),
  ]);

  const ordersInFlight = orders.filter((order) => order.status !== "Complete" && order.status !== "Cancelled").length;
  const revenueQueued = orders
    .filter((order) => order.status !== "Complete" && order.status !== "Cancelled")
    .reduce((sum, order) => sum + order.value, 0);
  const qboReadyCount = accounting.filter((record) => record.qboStatus === "Ready").length;
  const highPriorityThreads = threads.filter((thread) => thread.priority === "High").length;

  const compactRevenue =
    revenueQueued >= 1000
      ? `£${Math.round((revenueQueued / 1000) * 10) / 10}k`
      : `£${Math.round(revenueQueued)}`;

  return [
    {
      label: "Jobs in flight",
      value: String(ordersInFlight),
      detail: `${highPriorityThreads} urgent threads`,
    },
    {
      label: "Revenue queued",
      value: compactRevenue,
      detail: `${ordersInFlight} active jobs`,
    },
    {
      label: "Inbox",
      value: String(threads.length),
      detail: `${highPriorityThreads} high priority`,
    },
    {
      label: "QBO ready",
      value: String(qboReadyCount),
      detail: `${qboReadyCount} ready to post`,
    },
  ];
}

export async function projectIntegrations(): Promise<IntegrationHealth[]> {
  const { orders } = await buildOrderSnapshot();
  const threads = await projectInboxThreads();
  const accounting = await projectAccountingRecords();

  const stockRiskCount = orders.filter(
    (order) =>
      order.stock.status === "stock_risk" ||
      order.stock.status === "awaiting_supplier" ||
      order.stock.status === "purchasing_required" ||
      order.stock.status === "partially_in_stock",
  ).length;
  const shopifyCount = orders.filter((order) => order.origin === "shopify").length;
  const qboMismatchCount = accounting.filter((record) => record.qboStatus === "Mismatch").length;
  const highPriorityThreadCount = threads.filter((thread) => thread.priority === "High").length;
  const decoConfigured = isDecoConnectorConfigured() || isBackendApiConfigured();
  const shopifyConfigured = isShopifyConnectorConfigured();
  const qboConfigured = isQboConnectorConfigured();
  const gmailConfigured = isGmailConnectorConfigured();
  const slackConfigured = isSlackConnectorConfigured();
  const shipstationConfigured = isShipstationConnectorConfigured();

  return [
    {
      name: "DecoNetwork",
      owner: "Catalog, stock, production metadata",
      health: !decoConfigured ? "Action needed" : stockRiskCount > 0 ? "Lagging" : "Healthy",
      latency:
        !decoConfigured
          ? "Connector not configured"
          : stockRiskCount > 0
          ? `${stockRiskCount} orders waiting stock confirmation`
          : "Syncing customers, products, inventory & orders",
      notes:
        !decoConfigured
          ? "Set DECO_BASE_URL, DECO_USERNAME, DECO_PASSWORD on backend."
          : stockRiskCount > 0
          ? "Stock shortages are reflected and linked to purchasing actions."
          : "Full bidirectional sync via backend API.",
    },
    {
      name: "Shopify",
      owner: "Checkout, order intake, customer source",
      health: shopifyConfigured ? "Healthy" : "Action needed",
      latency: shopifyConfigured ? `${shopifyCount} active linked orders` : "Connector not configured",
      notes: shopifyConfigured
        ? "Shopify-origin orders are normalized into canonical internal order IDs."
        : "Set SHOPIFY_DOMAIN and SHOPIFY_ACCESS_TOKEN.",
    },
    {
      name: "QuickBooks Online",
      owner: "Invoices, payments, accounting truth",
      health: !qboConfigured ? "Action needed" : qboMismatchCount > 0 ? "Action needed" : "Healthy",
      latency:
        !qboConfigured
          ? "Connector not configured"
          : qboMismatchCount > 0
          ? `${qboMismatchCount} records require reconciliation`
          : "Posting queue clear",
      notes:
        !qboConfigured
          ? "Set QBO_REALM_ID and QBO_ACCESS_TOKEN."
          : qboMismatchCount > 0
          ? "Resolve mismatch records before posting to final books."
          : "No accounting blockers detected.",
    },
    {
      name: "Gmail",
      owner: "Gmail-linked customer conversations",
      health: !gmailConfigured ? "Action needed" : highPriorityThreadCount > 0 ? "Action needed" : "Healthy",
      latency: gmailConfigured ? `${threads.length} order-linked conversations` : "Connector not configured",
      notes:
        !gmailConfigured
          ? "Set GMAIL_ACCESS_TOKEN."
          : highPriorityThreadCount > 0
          ? `${highPriorityThreadCount} urgent threads need operator response.`
          : "Communication timeline is up to date.",
    },
    {
      name: "Slack",
      owner: "Internal alerts and order-linked notifications",
      health: slackConfigured ? "Healthy" : "Action needed",
      latency: slackConfigured ? "Realtime channel polling + webhooks" : "Connector not configured",
      notes: slackConfigured
        ? "Slack alerts are associated to unified order timelines."
        : "Set SLACK_BOT_TOKEN and SLACK_CHANNEL_IDS.",
    },
    {
      name: "ShipStation",
      owner: "Label print and dispatch handoff",
      health: shipstationConfigured ? "Healthy" : "Lagging",
      latency: shipstationConfigured ? "Batch print bridge online" : "Running in simulated print mode",
      notes: shipstationConfigured
        ? "Bulk label batches can print directly from dispatch queue."
        : "Set SHIPSTATION_PRINT_URL to enable live label printing.",
    },
  ];
}

export async function projectCommandCenterData() {
  const [
    dashboardOrders,
    dashboardCustomers,
    dashboardThreads,
    dashboardApprovals,
    dashboardProduction,
    dashboardAccounting,
    dashboardIntegrations,
    dashboardMetrics,
  ] = await Promise.all([
    projectOrders(),
    projectCustomers(),
    projectInboxThreads(),
    projectApprovals(),
    projectProductionJobs(),
    projectAccountingRecords(),
    projectIntegrations(),
    projectMetrics(),
  ]);

  return {
    orders: dashboardOrders,
    customers: dashboardCustomers,
    inboxThreads: dashboardThreads,
    approvals: dashboardApprovals,
    productionJobs: dashboardProduction,
    accountingRecords: dashboardAccounting,
    integrations: dashboardIntegrations,
    metrics: dashboardMetrics,
  };
}
