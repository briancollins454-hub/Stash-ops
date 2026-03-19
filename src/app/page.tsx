import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { MetricGrid } from "@/components/modules/metric-grid";
import { OrdersTable } from "@/components/modules/orders-table";
import { StockPurchasingBoard } from "@/components/modules/stock-purchasing-board";
import { WarehouseReceiptsBoard } from "@/components/modules/warehouse-receipts-board";
import { ProductionBoard } from "@/components/modules/production-board";
import { CommunicationsWorkbench } from "@/components/modules/communications-workbench";
import { formatCount, shellCopy } from "@/lib/content";
import {
  getCommandCenterData,
  listCommunicationSignals,
  listStockPurchaseTasks,
  listWarehouseReceiptTasks,
} from "@/lib/data-repository";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [commandData, stockTasks, warehouseTasks, communications] = await Promise.all([
    getCommandCenterData(),
    listStockPurchaseTasks(),
    listWarehouseReceiptTasks(),
    listCommunicationSignals(),
  ]);

  const { metrics, orders, productionJobs } = commandData;
  const blockedStock = stockTasks.filter((task) => task.status === "Awaiting order" || task.status === "Awaiting arrival");
  const partialWarehouse = warehouseTasks.filter((task) => task.status !== "Complete");

  return (
    <AppShell
      title={shellCopy.dashboard.title}
      description={shellCopy.dashboard.description}
    >
      <MetricGrid metrics={metrics} />

      <div className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          kicker="Intake"
          title="Jobs requiring attention now"
          detail={formatCount(orders.length, "active job")}
        >
          <OrdersTable orders={orders.slice(0, 6)} />
        </SectionCard>
        <SectionCard
          kicker="Stock blockers"
          title="Ordering and ETA risks"
          detail={formatCount(blockedStock.length, "blocked job")}
        >
          <StockPurchasingBoard tasks={blockedStock.slice(0, 6)} />
        </SectionCard>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[0.96fr_1.04fr]">
        <SectionCard
          kicker="Warehouse gate"
          title="Receipts pending scan-in"
          detail={formatCount(partialWarehouse.length, "receipt task")}
        >
          <WarehouseReceiptsBoard tasks={partialWarehouse.slice(0, 6)} />
        </SectionCard>
        <SectionCard
          kicker="Production flow"
          title="Department-ready lanes"
          detail={formatCount(productionJobs.length, "production job")}
        >
          <ProductionBoard jobs={productionJobs.slice(0, 6)} />
        </SectionCard>
      </div>

      <SectionCard
        kicker="Comms and approvals"
        title="Customer + team communication load"
        detail={formatCount(communications.length, "active communication")}
      >
        <CommunicationsWorkbench items={communications.slice(0, 8)} />
      </SectionCard>
    </AppShell>
  );
}

