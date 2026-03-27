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
    <AppShell title={shellCopy.dashboard.title}>
      <MetricGrid metrics={metrics} />

      {/* Priority row — jobs + production side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          kicker="Intake"
          title="Needs attention"
          detail={formatCount(orders.length, "active job")}
        >
          <OrdersTable orders={orders.slice(0, 8)} />
        </SectionCard>
        <SectionCard
          kicker="Production"
          title="Floor lanes"
          detail={formatCount(productionJobs.length, "job")}
        >
          <ProductionBoard jobs={productionJobs.slice(0, 8)} />
        </SectionCard>
      </div>

      {/* Secondary row — stock + warehouse */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          kicker="Stock"
          title="Ordering risks"
          detail={formatCount(blockedStock.length, "blocked")}
        >
          <StockPurchasingBoard tasks={blockedStock.slice(0, 6)} />
        </SectionCard>
        <SectionCard
          kicker="Warehouse"
          title="Pending scan-in"
          detail={formatCount(partialWarehouse.length, "receipt")}
        >
          <WarehouseReceiptsBoard tasks={partialWarehouse.slice(0, 6)} />
        </SectionCard>
      </div>

      <SectionCard
        kicker="Comms"
        title="Messages & approvals"
        detail={formatCount(communications.length, "signal")}
      >
        <CommunicationsWorkbench items={communications.slice(0, 8)} />
      </SectionCard>
    </AppShell>
  );
}

