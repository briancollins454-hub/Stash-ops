import type {
  AccountingRecord,
  Approval,
  Customer,
  DispatchOrder,
  DecoratorProduct,
  DecoratorTemplate,
  InboxThread,
  IntegrationHealth,
  Metric,
  Order,
  ProductionJob,
} from "@/lib/types";
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
