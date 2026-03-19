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
    <AppShell
      title={shellCopy.accounts.title}
      description={shellCopy.accounts.description}
    >
      <SectionCard
        kicker="Account intelligence"
        title="Schools, clubs, and repeat clients"
        detail={formatCount(accounts.length, "active account")}
      >
        <CustomerList customers={accounts} />
      </SectionCard>

      <SectionCard
        kicker="Matching and rules"
        title="Alias and template readiness"
        detail={`${formatCount(groupedJobs.size, "source group")} · ${formatCount(reviewNeeded, "job awaiting review signal")}`}
      >
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {Array.from(groupedJobs.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([label, count]) => (
              <article key={label} className="record-card p-4 sm:p-5">
                <p className="eyebrow">Source profile</p>
                <p className="mt-2 text-base font-semibold text-white">{label}</p>
                <p className="mt-3 text-sm text-white/68">{formatCount(count, "job")} currently linked</p>
                <p className="mt-2 text-xs text-white/56">
                  Assign aliases + Deco customer + default assets for auto-preconfiguration.
                </p>
              </article>
            ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}

