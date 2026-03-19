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
    <AppShell
      title={shellCopy.admin.title}
      description={shellCopy.admin.description}
    >
      <SectionCard
        kicker="Control room"
        title="Integration and sync orchestration"
        detail={formatCount(integrations.length, "connected platform")}
      >
        <SyncControlPanel />
      </SectionCard>

      <SectionCard
        kicker="Backplane health"
        title="Integration status board"
        detail={formatCount(integrations.length, "integration adapter")}
      >
        <IntegrationsGrid integrations={integrations} />
      </SectionCard>

      <SectionCard
        kicker="Finance integrity"
        title="Accounting and exception lane"
        detail={formatCount(accountingRecords.length, "record")}
      >
        <AccountingList records={accountingRecords} />
      </SectionCard>
    </AppShell>
  );
}

