import { AppShell } from "@/components/app-shell";
import { CollapsibleSection } from "@/components/collapsible-section";
import { CustomerList } from "@/components/modules/customer-list";
import { formatCount, shellCopy } from "@/lib/content";
import { listCustomers, listOrders } from "@/lib/data-repository";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Tab = "all" | "deco" | "shopify";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = ((params.tab as string) || "all") as Tab;

  const [accounts, orders] = await Promise.all([listCustomers(), listOrders()]);

  const decoAccounts = accounts.filter((a) => a.source === "deco" || a.source === "both");
  const shopifyAccounts = accounts.filter((a) => a.source === "shopify" || a.source === "both");

  const filteredAccounts =
    tab === "deco" ? decoAccounts : tab === "shopify" ? shopifyAccounts : accounts;

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

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All Accounts", count: accounts.length },
    { key: "deco", label: "Deco", count: decoAccounts.length },
    { key: "shopify", label: "Shopify", count: shopifyAccounts.length },
  ];

  return (
    <AppShell title={shellCopy.accounts.title}>
      {/* Tab bar */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/accounts?tab=${t.key}`}
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: active ? "var(--accent)" : "var(--card-bg)",
                color: active ? "#fff" : "var(--text-secondary)",
                border: active ? "none" : "1px solid var(--card-border)",
              }}
            >
              {t.label}
              <span
                className="inline-flex items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                style={{
                  background: active ? "rgba(255,255,255,0.2)" : "var(--hover-bg)",
                  color: active ? "#fff" : "var(--text-tertiary)",
                  minWidth: "1.4rem",
                }}
              >
                {t.count}
              </span>
            </Link>
          );
        })}
      </div>

      <CollapsibleSection
        kicker="Accounts"
        title="Client directory"
        detail={formatCount(filteredAccounts.length, "account")}
        defaultOpen
      >
        {filteredAccounts.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
            No accounts found for this filter.
          </p>
        ) : (
          <CustomerList customers={filteredAccounts} />
        )}
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
