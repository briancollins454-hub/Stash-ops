import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { WarehouseReceiptsBoard } from "@/components/modules/warehouse-receipts-board";
import { formatCount, shellCopy } from "@/lib/content";
import { listWarehouseReceiptTasks } from "@/lib/data-repository";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const tasks = await listWarehouseReceiptTasks();
  const pending = tasks.filter((task) => task.status !== "Complete");

  return (
    <AppShell title={shellCopy.warehouse.title}>
      <SectionCard
        kicker="Goods in"
        title="Receipt & scan"
        detail={`${formatCount(tasks.length, "receipt")} · ${formatCount(pending.length, "open")}`}
      >
        <WarehouseReceiptsBoard tasks={tasks} />
      </SectionCard>
    </AppShell>
  );
}

