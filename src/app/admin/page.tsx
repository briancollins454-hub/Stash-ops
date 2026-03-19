import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { AccountingList } from "@/components/modules/accounting-list";
import { IntegrationsGrid } from "@/components/modules/integrations-grid";
import { SyncControlPanel } from "@/components/integrations/sync-control-panel";
import { formatCount, shellCopy } from "@/lib/content";
import { listAccountingRecords, listIntegrations } from "@/lib/data-repository";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [integrations, accountingRecords] = await Promise.all([
    listIntegrations(),
    listAccountingRecords(),
  ]);

  return (
    <AppShell title={shellCopy.admin.title}>
      <SectionCard
        kicker="Control room"
        title="Integrations & sync"
        detail={formatCount(integrations.length, "connected platform")}
      >
        <SyncControlPanel />
      </SectionCard>

      <SectionCard
        kicker="Health"
        title="Integration status"
        detail={formatCount(integrations.length, "integration")}
      >
        <IntegrationsGrid integrations={integrations} />
      </SectionCard>

      <SectionCard
        kicker="Finance"
        title="Accounting exceptions"
        detail={formatCount(accountingRecords.length, "record")}
      >
        <AccountingList records={accountingRecords} />
      </SectionCard>
    </AppShell>
  );
}

