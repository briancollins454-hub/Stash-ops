import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { AccountingList } from "@/components/modules/accounting-list";
import { formatCount, shellCopy } from "@/lib/content";
import { listAccountingRecords } from "@/lib/data-repository";

export default async function AccountingPage() {
  const accountingRecords = await listAccountingRecords();

  return (
    <AppShell
      title={shellCopy.accounting.title}
      description={shellCopy.accounting.description}
    >
      <SectionCard
        kicker="QBO"
        title="Posting queue"
        detail={formatCount(accountingRecords.length, "ready record")}
      >
        <AccountingList records={accountingRecords} />
      </SectionCard>
    </AppShell>
  );
}
