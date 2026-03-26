import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { OutstandingAccountsTable } from "@/components/modules/outstanding-accounts-table";
import { formatCount, shellCopy } from "@/lib/content";
import { formatCurrency } from "@/lib/format";
import { listOutstandingAccounts } from "@/lib/data-repository";

export const dynamic = "force-dynamic";

export default async function AccountsReceivablePage() {
  const accounts = await listOutstandingAccounts();
  const totalOutstanding = accounts.reduce((sum, a) => sum + a.totalMinor, 0);

  return (
    <AppShell title={shellCopy.accountsReceivable.title}>
      <SectionCard
        kicker="Outstanding"
        title="Accounts receivable"
        detail={`${formatCount(accounts.length, "order")} · ${formatCurrency(totalOutstanding / 100)} outstanding`}
      >
        <OutstandingAccountsTable accounts={accounts} />
      </SectionCard>
    </AppShell>
  );
}
