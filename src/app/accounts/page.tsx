import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { CustomerList } from "@/components/modules/customer-list";
import { formatCount, shellCopy } from "@/lib/content";
import { listCustomers, listOrders } from "@/lib/data-repository";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [accounts, orders] = await Promise.all([listCustomers(), listOrders()]);

  const groupedJobs = new Map<string, number>();
  orders.forEach((order) => {
    const label = order.sourceGroupLabel ?? "Unassigned";
    groupedJobs.set(label, (groupedJobs.get(label) ?? 0) + 1);
  });

  const reviewNeeded = orders.filter((order) => order.artStatus.toLowerCase().includes("awaiting")).length;

  return (
    <AppShell title={shellCopy.accounts.title}>
      <SectionCard
        kicker="Accounts"
        title="Client directory"
        detail={formatCount(accounts.length, "account")}
      >
        <CustomerList customers={accounts} />
      </SectionCard>

      <SectionCard
        kicker="Rules"
        title="Source group mapping"
        detail={`${formatCount(groupedJobs.size, "source group")} · ${formatCount(reviewNeeded, "awaiting review")}`}
      >
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {Array.from(groupedJobs.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([label, count]) => (
              <article key={label} className="record-card p-4 sm:p-5">
                <p className="eyebrow">Source profile</p>
                <p className="mt-2 text-base font-semibold text-white">{label}</p>
                <p className="mt-3 text-sm text-white/68">{formatCount(count, "job")} linked</p>
              </article>
            ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}

