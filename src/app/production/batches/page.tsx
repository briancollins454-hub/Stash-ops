import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { formatCount } from "@/lib/content";
import {
  listProductionBatches,
  getProductionBatchStats,
} from "@/lib/data-repository";
import { BatchBoard } from "@/components/production/batch-board";

export const dynamic = "force-dynamic";

export default async function ProductionBatchesPage() {
  const [{ batches, total }, stats] = await Promise.all([
    listProductionBatches({ limit: 200 }),
    getProductionBatchStats(),
  ]);

  return (
    <AppShell title="Production Batches">
      <SectionCard
        kicker="Batching"
        title="Production Batches"
        detail={formatCount(total, "batch", "batches")}
      >
        <BatchBoard batches={batches} stats={stats} />
      </SectionCard>
    </AppShell>
  );
}
