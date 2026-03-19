import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { ProductionBoard } from "@/components/modules/production-board";
import { formatCount, shellCopy } from "@/lib/content";
import { listProductionJobs } from "@/lib/data-repository";

export default async function ProductionPage() {
  const productionJobs = await listProductionJobs();

  return (
    <AppShell
      title={shellCopy.production.title}
      description={shellCopy.production.description}
    >
      <SectionCard
        kicker="Floor"
        title="Live job routing"
        detail={formatCount(productionJobs.length, "active lane")}
      >
        <ProductionBoard jobs={productionJobs} />
      </SectionCard>
    </AppShell>
  );
}
