import type {
  AccountingRecord,
  Approval,
  CommunicationSignal,
  Customer,
  DispatchOrder,
  DecoratorProduct,
  DecoratorTemplate,
  InboxThread,
  IntegrationHealth,
  Metric,
  Order,
  ProductionJob,
  StockPurchaseTask,
  WarehouseReceiptTask,
} from "@/lib/types";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";
import {
  mapBackendOrderToUiOrder,
  type BackendOrderRecord,
} from "@/lib/backend-order-adapter";
import {
  projectAccountingRecords,
  projectApprovals,
  projectCommandCenterData,
  projectCustomers,
  projectInboxThreads,
  projectIntegrations,
  projectMetrics,
  projectOrders,
  projectProductionJobs,
} from "@/server/queries/unified-projections";
import {
  projectDispatchBoard,
  projectDispatchQueue,
} from "@/server/queries/dispatch-queue";
import {
  projectDecoratorProducts,
  projectDecoratorTemplates,
} from "@/server/queries/decorator-projections";

export async function listOrders(): Promise<Order[]> {
  if (isBackendApiConfigured()) {
    try {
      const payload = await fetchBackendJson<{
        lane: "active" | "fulfilled" | "all";
        total: number;
        items: BackendOrderRecord[];
      }>("/api/v1/orders?lane=all&limit=500");

      return payload.items.map(mapBackendOrderToUiOrder);
    } catch (error) {
      console.error("Failed to load orders from backend API. Falling back to local repository.", error);
    }
  }

  return projectOrders();
}

export async function listCustomers(): Promise<Customer[]> {
  return projectCustomers();
}

export async function listDispatchQueue(): Promise<DispatchOrder[]> {
  return projectDispatchQueue();
}

export async function listDispatchBoard() {
  return projectDispatchBoard();
}

export async function listInboxThreads(): Promise<InboxThread[]> {
  return projectInboxThreads();
}

export async function listApprovals(): Promise<Approval[]> {
  return projectApprovals();
}

export async function listProductionJobs(): Promise<ProductionJob[]> {
  return projectProductionJobs();
}

export async function listAccountingRecords(): Promise<AccountingRecord[]> {
  return projectAccountingRecords();
}

export async function listIntegrations(): Promise<IntegrationHealth[]> {
  return projectIntegrations();
}

export async function listMetrics(): Promise<Metric[]> {
  return projectMetrics();
}

export async function listDecoratorProducts(): Promise<DecoratorProduct[]> {
  return projectDecoratorProducts();
}

export async function listDecoratorTemplates(): Promise<DecoratorTemplate[]> {
  return projectDecoratorTemplates();
}

export async function getCommandCenterData() {
  return projectCommandCenterData();
}

export async function listStockPurchaseTasks(): Promise<StockPurchaseTask[]> {
  const orders = await listOrders();

  return orders.slice(0, 20).map((order, index) => {
    const status: StockPurchaseTask["status"] =
      order.status === "Printing" || order.status === "Shipping"
        ? "Ready"
        : order.status === "Queued"
          ? "Partially received"
          : index % 3 === 0
            ? "Awaiting arrival"
            : index % 2 === 0
              ? "Ordered"
              : "Awaiting order";

    const blocker =
      status === "Awaiting order"
        ? "Supplier order reference not logged"
        : status === "Awaiting arrival"
          ? "ETA window approaching"
          : undefined;

    return {
      id: `STOCK-${order.id}`,
      orderId: order.id,
      account: order.company,
      supplier: index % 2 === 0 ? "Ralawise" : "PenCarrie",
      requiredQty: 12 + (index % 7) * 8,
      status,
      eta:
        status === "Ready"
          ? "In stock"
          : status === "Partially received"
            ? "Partial in branch"
            : `Mar ${19 + (index % 9)}`,
      blocker,
    };
  });
}

export async function listWarehouseReceiptTasks(): Promise<WarehouseReceiptTask[]> {
  const tasks = await listStockPurchaseTasks();

  return tasks.slice(0, 20).map((task, index) => {
    const receivedQty =
      task.status === "Ready"
        ? task.requiredQty
        : task.status === "Partially received"
          ? Math.max(1, Math.floor(task.requiredQty * 0.6))
          : 0;

    const status: WarehouseReceiptTask["status"] =
      receivedQty === 0
        ? "Pending receipt"
        : receivedQty < task.requiredQty
          ? "Partial receipt"
          : "Complete";

    return {
      id: `WH-${task.id}`,
      orderId: task.orderId,
      account: task.account,
      expectedQty: task.requiredQty,
      receivedQty,
      branch: index % 2 === 0 ? "HQ Warehouse" : "North Branch",
      status,
      lastScan: status === "Pending receipt" ? "No scan yet" : `${index + 1}h ago`,
    };
  });
}

export async function listCommunicationSignals(): Promise<CommunicationSignal[]> {
  const [inbox, orders] = await Promise.all([listInboxThreads(), listOrders()]);
  const orderById = new Map(orders.map((order) => [order.id, order]));

  return inbox.slice(0, 30).map((thread, index) => {
    const linkedOrder = orderById.get(thread.linkedOrder);
    return {
      id: `COMM-${thread.id}`,
      orderId: thread.linkedOrder,
      account: linkedOrder?.company ?? thread.customer,
      channel: thread.channel === "Email" ? "Gmail" : thread.channel === "SMS" ? "Internal" : "Slack",
      direction: thread.channel === "Internal" ? "Alert" : index % 2 === 0 ? "Inbound" : "Outbound",
      subject: thread.subject,
      state:
        thread.priority === "High"
          ? "Unread"
          : index % 2 === 0
            ? "Awaiting reply"
            : "Resolved",
      updatedAt: thread.updatedAt,
    };
  });
}
