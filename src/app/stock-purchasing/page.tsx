import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StockPurchasingBoard } from "@/components/modules/stock-purchasing-board";
import { formatCount, shellCopy } from "@/lib/content";
import { listStockPurchaseTasks } from "@/lib/data-repository";

export const dynamic = "force-dynamic";

export default async function StockPurchasingPage() {
  const tasks = await listStockPurchaseTasks();
  const blocked = tasks.filter((task) => task.status === "Awaiting order" || task.status === "Awaiting arrival");

  return (
    <AppShell title={shellCopy.stockPurchasing.title}>
      <SectionCard
        kicker="Procurement"
        title="Supplier orders"
        detail={`${formatCount(tasks.length, "task")} · ${formatCount(blocked.length, "blocked")}`}
      >
        <StockPurchasingBoard tasks={tasks} />
      </SectionCard>
    </AppShell>
  );
}

