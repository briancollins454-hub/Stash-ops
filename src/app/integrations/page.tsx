import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { IntegrationsGrid } from "@/components/modules/integrations-grid";
import { SyncControlPanel } from "@/components/integrations/sync-control-panel";
import { formatCount, shellCopy } from "@/lib/content";
import { listIntegrations } from "@/lib/data-repository";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const integrations = await listIntegrations();

  return (
    <AppShell
      title={shellCopy.integrations.title}
      description={shellCopy.integrations.description}
    >
      <SectionCard
        kicker="Auto sync"
        title="Sync control room"
        detail="Stale-aware auto-sync plus one-click manual sync for each provider."
      >
        <SyncControlPanel />
      </SectionCard>
      <SectionCard
        kicker="Backplane"
        title="Integration health"
        detail={formatCount(integrations.length, "connected platform")}
      >
        <IntegrationsGrid integrations={integrations} />
      </SectionCard>
    </AppShell>
  );
}
