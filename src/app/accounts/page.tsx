import { AppShell } from "@/components/app-shell";
import { CollapsibleSection } from "@/components/collapsible-section";
import { CustomerList } from "@/components/modules/customer-list";
import { formatCount, shellCopy } from "@/lib/content";
import { listCustomers, listOrders } from "@/lib/data-repository";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [accounts, orders] = await Promise.all([listCustomers(), listOrders()]);

  const sourceGroups = new Map<string, { label: string; count: number }>();
  orders.forEach((order) => {
    const key = order.sourceGroupKey ?? "unassigned";
    const label = order.sourceGroupLabel ?? "Unassigned";
    const existing = sourceGroups.get(key);
    if (existing) {
      existing.count++;
    } else {
      sourceGroups.set(key, { label, count: 1 });
    }
  });

  const reviewNeeded = orders.filter((order) => order.artStatus.toLowerCase().includes("awaiting")).length;

  const sortedGroups = Array.from(sourceGroups.entries())
    .sort((a, b) => b[1].count - a[1].count);

  return (
    <AppShell title={shellCopy.accounts.title}>
      <CollapsibleSection
        kicker="Accounts"
        title="Client directory"
        detail={formatCount(accounts.length, "account")}
        defaultOpen
      >
        <CustomerList customers={accounts} />
      </CollapsibleSection>

      <CollapsibleSection
        kicker="Rules"
        title="Source group mapping"
        detail={`${formatCount(sourceGroups.size, "source group")} · ${formatCount(reviewNeeded, "awaiting review")}`}
        defaultOpen
      >
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {sortedGroups.map(([key, { label, count }]) => (
            <Link
              key={key}
              href={`/jobs?source=${encodeURIComponent(key)}`}
              className="card block p-4"
            >
              <p className="eyebrow">Source profile</p>
              <p className="mt-1.5 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</p>
              <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>{formatCount(count, "job")} linked</p>
            </Link>
          ))}
        </div>
      </CollapsibleSection>
    </AppShell>
  );
}

