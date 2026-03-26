import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { CollapsibleSection } from "@/components/collapsible-section";
import { OrdersTable } from "@/components/modules/orders-table";
import { CreateOrderForm } from "@/components/orders/create-order-form";
import { BulkCancelProvider } from "@/components/jobs/bulk-cancel-provider";
import { formatCount, shellCopy } from "@/lib/content";
import type { Order, JobSource } from "@/lib/types";
import { listOrders } from "@/lib/data-repository";

import Link from "next/link";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ source?: string; tab?: string }>;
};

const TABS: { key: string; label: string; filter: JobSource | null }[] = [
  { key: "all", label: "All Jobs", filter: null },
  { key: "deco", label: "Deco Jobs", filter: "DECO" },
  { key: "shopify", label: "Shopify Orders", filter: "SHOPIFY" },
];

function groupOrdersBySource(orders: Order[]) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      type: NonNullable<Order["sourceGroupType"]>;
      orders: Order[];
    }
  >();

  orders.forEach((order) => {
    const key = order.sourceGroupKey ?? "unassigned";
    const label = order.sourceGroupLabel ?? "Unassigned";
    const type = order.sourceGroupType ?? "Unassigned";
    const existing = groups.get(key);

    if (existing) {
      existing.orders.push(order);
      return;
    }

    groups.set(key, {
      key,
      label,
      type,
      orders: [order],
    });
  });

  return Array.from(groups.values()).sort((a, b) => {
    if (a.label === "Unassigned" && b.label !== "Unassigned") return 1;
    if (a.label !== "Unassigned" && b.label === "Unassigned") return -1;
    return a.label.localeCompare(b.label);
  });
}

/** Assign each order to a pipeline lane. */
function sortIntoLanes(orders: Order[]) {
  const newReview: Order[] = [];
  const inProgress: Order[] = [];
  const readyToShip: Order[] = [];
  const shipped: Order[] = [];
  const onHold: Order[] = [];
  const cancelled: Order[] = [];

  for (const order of orders) {
    if (order.status === "Cancelled") {
      cancelled.push(order);
    } else if (order.status === "On hold") {
      onHold.push(order);
    } else if (order.status === "Complete" && order.fulfillment === "fulfilled") {
      shipped.push(order);
    } else if (order.status === "Complete") {
      readyToShip.push(order);
    } else if (order.status === "New") {
      newReview.push(order);
    } else {
      inProgress.push(order);
    }
  }

  return { newReview, inProgress, readyToShip, shipped, onHold, cancelled };
}

function LaneSection({
  laneKey,
  groups,
  emptyMessage,
}: {
  laneKey: string;
  groups: ReturnType<typeof groupOrdersBySource>;
  emptyMessage: string;
}) {
  if (groups.length === 0) {
    return <OrdersTable orders={[]} emptyMessage={emptyMessage} />;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={`${laneKey}-${group.key}`} className="space-y-2">
          <div className="surface flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="eyebrow">Account/source group</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{group.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="pill pill--ghost">{group.type}</span>
              <span className="pill pill--ghost">{formatCount(group.orders.length, "job")}</span>
            </div>
          </div>
          <OrdersTable orders={group.orders} />
        </div>
      ))}
    </div>
  );
}

function SourceTabs({
  activeTab,
  counts,
}: {
  activeTab: string;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--bg-surface)" }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = counts[tab.key] ?? 0;
        return (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/jobs" : `/jobs?tab=${tab.key}`}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              background: isActive ? "var(--bg-raised)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
            }}
          >
            {tab.label}
            <span
              className="rounded-md px-1.5 py-0.5 text-xs tabular-nums"
              style={{
                background: isActive ? "var(--accent)" : "var(--bg-raised)",
                color: isActive ? "var(--bg-base)" : "var(--text-tertiary)",
              }}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default async function JobsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sourceFilter = params.source;
  const activeTab = params.tab ?? "all";

  const allOrders = await listOrders();

  // Source filter (from ?source=xxx link)
  const sourceFiltered = sourceFilter
    ? allOrders.filter((o) => o.sourceGroupKey === sourceFilter)
    : allOrders;
  const sourceLabel = sourceFilter
    ? (sourceFiltered[0]?.sourceGroupLabel ?? sourceFilter)
    : null;

  // Tab filter
  const tabDef = TABS.find((t) => t.key === activeTab) ?? TABS[0];
  const filtered = tabDef.filter
    ? sourceFiltered.filter((o) => o.source === tabDef.filter)
    : sourceFiltered;

  // Counts for tab badges
  const counts: Record<string, number> = {
    all: sourceFiltered.length,
    deco: sourceFiltered.filter((o) => o.source === "DECO").length,
    shopify: sourceFiltered.filter((o) => o.source === "SHOPIFY").length,
  };

  const { newReview, inProgress, readyToShip, shipped, onHold, cancelled } = sortIntoLanes(filtered);

  const title = sourceLabel
    ? `Jobs — ${sourceLabel}`
    : tabDef.key !== "all"
      ? `Jobs — ${tabDef.label}`
      : shellCopy.jobs.title;

  return (
    <AppShell title={title}>
      <BulkCancelProvider>
      {sourceLabel && (
        <div className="flex items-center gap-3 px-1">
          <Link href="/jobs" className="text-sm transition-colors hover:text-white" style={{ color: "var(--text-tertiary)" }}>
            ← All jobs
          </Link>
          <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Filtered by <span style={{ color: "var(--text-primary)" }}>{sourceLabel}</span> · {formatCount(filtered.length, "job")}
          </span>
        </div>
      )}

      <SourceTabs activeTab={activeTab} counts={counts} />

      {!sourceFilter && activeTab === "all" && (
        <SectionCard
          kicker="Manual intake"
          title="Create job"
        >
          <CreateOrderForm />
        </SectionCard>
      )}

      {/* ── Lane 1 — New / Needs Review ── */}
      <CollapsibleSection
        kicker="Lane 1"
        title="New / Needs Review"
        detail={formatCount(newReview.length, "job")}
        defaultOpen
      >
        <LaneSection
          laneKey="new"
          groups={groupOrdersBySource(newReview)}
          emptyMessage="No new orders awaiting review."
        />
      </CollapsibleSection>

      {/* ── Lane 2 — In Progress ── */}
      <CollapsibleSection
        kicker="Lane 2"
        title="In Progress"
        detail={formatCount(inProgress.length, "job")}
        defaultOpen
      >
        <LaneSection
          laneKey="progress"
          groups={groupOrdersBySource(inProgress)}
          emptyMessage="No jobs currently in progress."
        />
      </CollapsibleSection>

      {/* ── Lane 3 — Ready to Ship ── */}
      <CollapsibleSection
        kicker="Lane 3"
        title="Ready to Ship"
        detail={formatCount(readyToShip.length, "job")}
      >
        <LaneSection
          laneKey="ship"
          groups={groupOrdersBySource(readyToShip)}
          emptyMessage="No jobs waiting for shipment."
        />
      </CollapsibleSection>

      {/* ── Lane 4 — Shipped / Fulfilled ── */}
      <CollapsibleSection
        kicker="Lane 4"
        title="Shipped / Fulfilled"
        detail={formatCount(shipped.length, "job")}
      >
        <LaneSection
          laneKey="shipped"
          groups={groupOrdersBySource(shipped)}
          emptyMessage="No shipped jobs yet."
        />
      </CollapsibleSection>

      {/* ── On Hold ── */}
      {onHold.length > 0 && (
        <CollapsibleSection
          kicker="Parked"
          title="On Hold"
          detail={formatCount(onHold.length, "job")}
        >
          <LaneSection
            laneKey="hold"
            groups={groupOrdersBySource(onHold)}
            emptyMessage=""
          />
        </CollapsibleSection>
      )}

      {/* ── Cancelled ── */}
      {cancelled.length > 0 && (
        <CollapsibleSection
          kicker="Closed"
          title="Cancelled"
          detail={formatCount(cancelled.length, "job")}
        >
          <LaneSection
            laneKey="cancelled"
            groups={groupOrdersBySource(cancelled)}
            emptyMessage=""
          />
        </CollapsibleSection>
      )}
      </BulkCancelProvider>
    </AppShell>
  );
}

