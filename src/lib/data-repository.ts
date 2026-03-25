import type {
  AccountingRecord,
  Approval,
  CommunicationSignal,
  Customer,
  DispatchOrder,
  DecoratorProduct,
  DecoratorTemplate,
  EnrichedQuoteDetail,
  InboxThread,
  IntegrationHealth,
  JobDetail,
  Metric,
  Order,
  ProductionJob,
  StockPurchaseTask,
  WarehouseReceiptTask,
} from "@/lib/types";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";
import {
  mapBackendJobToUiOrder,
  mapBackendStockToUi,
  mapBackendWarehouseToUi,
  mapBackendCommToUi,
  mapBackendProductionToUi,
  mapBackendApprovalToUi,
  type BackendJobRecord,
  type BackendStockRequirement,
  type BackendWarehouseReceipt,
  type BackendCommunication,
  type BackendProductionItem,
  type BackendApprovalItem,
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
        items: BackendJobRecord[];
      }>("/api/v1/orders?lane=all&limit=300");

      return payload.items.map(mapBackendJobToUiOrder);
    } catch (error) {
      console.error("Failed to load jobs from backend API. Falling back to local repository.", error);
    }
  }

  return projectOrders();
}

export async function getJob(jobId: string): Promise<JobDetail | null> {
  if (!isBackendApiConfigured()) return null;

  try {
    const job = await fetchBackendJson<JobDetail>(
      `/api/v1/jobs/${encodeURIComponent(jobId)}`,
    );
    return job;
  } catch {
    return null;
  }
}

export async function getEnrichedQuoteDetail(jobId: string): Promise<EnrichedQuoteDetail | null> {
  if (!isBackendApiConfigured()) return null;

  try {
    return await fetchBackendJson<EnrichedQuoteDetail>(
      `/api/v1/quotes/${encodeURIComponent(jobId)}/detail`,
      { timeoutMs: 30_000 },
    );
  } catch {
    return null;
  }
}

export async function listCustomers(): Promise<Customer[]> {
  if (isBackendApiConfigured()) {
    try {
      const payload = await fetchBackendJson<{
        total: number;
        items: Array<{
          id: string;
          key: string;
          name: string;
          type: string;
          active: boolean;
          decoCustomerId: string | null;
          shopifyCustomerIds: string[];
          counts: { aliases: number; assets: number; placementConfigs: number; productRules: number };
          createdAt: string;
          updatedAt: string;
        }>;
      }>("/api/v1/accounts");

      return payload.items
        .filter((a) => a.active)
        .map((a) => {
          const hasDeco = !!a.decoCustomerId;
          const isDecoKey = a.key.startsWith("deco-");
          const source: "shopify" | "deco" | "both" = hasDeco && !isDecoKey ? "both" : hasDeco || isDecoKey ? "deco" : "shopify";

          return {
            id: a.id,
            name: a.name,
            company: a.name,
            region: "",
            segment: a.type ?? "CLIENT",
            lifetimeValue: 0,
            lastOrder: "",
            openOrders: 0,
            lastTouch: a.updatedAt ?? "",
            source,
            type: a.type,
            decoCustomerId: a.decoCustomerId,
          };
        });
    } catch (error) {
      console.error("Failed to load accounts from backend API. Falling back to local projections.", error);
    }
  }

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
  if (isBackendApiConfigured()) {
    try {
      const payload = await fetchBackendJson<{
        total: number;
        items: BackendApprovalItem[];
      }>("/api/v1/approvals?limit=200");

      return payload.items.map(mapBackendApprovalToUi);
    } catch (error) {
      console.error("Failed to load approvals from backend API. Falling back to projections.", error);
    }
  }

  return projectApprovals();
}

export async function listProductionJobs(): Promise<ProductionJob[]> {
  if (isBackendApiConfigured()) {
    try {
      const payload = await fetchBackendJson<{
        total: number;
        items: BackendProductionItem[];
      }>("/api/v1/production-queue?limit=200");

      return payload.items.map(mapBackendProductionToUi);
    } catch (error) {
      console.error("Failed to load production queue from backend API. Falling back to projections.", error);
    }
  }

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
  if (isBackendApiConfigured()) {
    try {
      const payload = await fetchBackendJson<{
        total: number;
        items: BackendStockRequirement[];
      }>("/api/v1/stock-requirements?limit=200");

      return payload.items.map(mapBackendStockToUi);
    } catch (error) {
      console.error("Failed to load stock requirements from backend API.", error);
    }
  }

  return [];
}

export async function listWarehouseReceiptTasks(): Promise<WarehouseReceiptTask[]> {
  if (isBackendApiConfigured()) {
    try {
      const payload = await fetchBackendJson<{
        total: number;
        items: BackendWarehouseReceipt[];
      }>("/api/v1/warehouse-receipts?limit=200");

      return payload.items.map(mapBackendWarehouseToUi);
    } catch (error) {
      console.error("Failed to load warehouse receipts from backend API.", error);
    }
  }

  return [];
}

export async function listCommunicationSignals(): Promise<CommunicationSignal[]> {
  if (isBackendApiConfigured()) {
    try {
      const payload = await fetchBackendJson<{
        total: number;
        items: BackendCommunication[];
      }>("/api/v1/communications?limit=200");

      return payload.items.map(mapBackendCommToUi);
    } catch (error) {
      console.error("Failed to load communications from backend API.", error);
    }
  }

  return [];
}
