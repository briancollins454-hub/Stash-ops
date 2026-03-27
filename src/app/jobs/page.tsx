import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { CollapsibleSection } from "@/components/collapsible-section";
import { LaneSection } from "@/components/modules/orders-table";
import { CreateOrderForm } from "@/components/orders/create-order-form";
import { BulkCancelProvider } from "@/components/jobs/bulk-cancel-provider";
import { AutoRefresh } from "@/components/auto-refresh";
import { JobsToolbar } from "@/components/jobs/jobs-toolbar";
import { formatCount, shellCopy } from "@/lib/content";
import type { Order, JobSource } from "@/lib/types";
import { listOrders } from "@/lib/data-repository";

import Link from "next/link";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ source?: string; tab?: string; q?: string; status?: string }>;
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

export default async function JobsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sourceFilter = params.source;
  const activeTab = params.tab ?? "all";
  const searchQuery = params.q?.toLowerCase().trim() ?? "";
  const statusFilter = params.status ?? "";

  const { orders: allOrders, counts: dbCounts } = await listOrders();

  // Source filter (from ?source=xxx link)
  let filtered = sourceFilter
    ? allOrders.filter((o) => o.sourceGroupKey === sourceFilter)
    : allOrders;
  const sourceLabel = sourceFilter
    ? (filtered[0]?.sourceGroupLabel ?? sourceFilter)
    : null;

  // Tab filter
  const tabDef = TABS.find((t) => t.key === activeTab) ?? TABS[0];
  if (tabDef.filter) {
    filtered = filtered.filter((o) => o.source === tabDef.filter);
  }

  // Search filter
  if (searchQuery) {
    filtered = filtered.filter((o) =>
      o.id.toLowerCase().includes(searchQuery) ||
      o.company.toLowerCase().includes(searchQuery) ||
      o.customer.toLowerCase().includes(searchQuery) ||
      (o.sourceGroupLabel?.toLowerCase().includes(searchQuery) ?? false)
    );
  }

  // Status filter
  if (statusFilter) {
    filtered = filtered.filter((o) => o.status === statusFilter);
  }

  // Counts for tab badges
  const counts: Record<string, number> = sourceFilter
    ? {
        all: allOrders.filter((o) => o.sourceGroupKey === sourceFilter).length,
        deco: allOrders.filter((o) => o.sourceGroupKey === sourceFilter && o.source === "DECO").length,
        shopify: allOrders.filter((o) => o.sourceGroupKey === sourceFilter && o.source === "SHOPIFY").length,
      }
    : {
        all: dbCounts.all,
        deco: dbCounts.deco,
        shopify: dbCounts.shopify,
      };

  const { newReview, inProgress, readyToShip, shipped, onHold, cancelled } = sortIntoLanes(filtered);

  // Summary stats for the toolbar
  const laneCounts = {
    new: newReview.length,
    inProgress: inProgress.length,
    readyToShip: readyToShip.length,
    shipped: shipped.length,
    onHold: onHold.length,
    cancelled: cancelled.length,
  };

  const title = sourceLabel
    ? `Jobs — ${sourceLabel}`
    : tabDef.key !== "all"
      ? `Jobs — ${tabDef.label}`
      : shellCopy.jobs.title;

  return (
    <AppShell title={title}>
      <AutoRefresh intervalMs={60_000} />
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

      {/* Toolbar: tabs + search + status filter + summary strip */}
      <JobsToolbar
        activeTab={activeTab}
        counts={counts}
        laneCounts={laneCounts}
        totalFiltered={filtered.length}
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        sourceFilter={sourceFilter}
      />

      {!sourceFilter && activeTab === "all" && !searchQuery && !statusFilter && (
        <CollapsibleSection
          kicker="Quick action"
          title="Create new job"
          defaultOpen={false}
        >
          <CreateOrderForm />
        </CollapsibleSection>
      )}

      {/* Pipeline lanes */}
      {newReview.length > 0 && (
        <CollapsibleSection
          kicker={`${newReview.length} job${newReview.length === 1 ? "" : "s"}`}
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
      )}

      {inProgress.length > 0 && (
        <CollapsibleSection
          kicker={`${inProgress.length} job${inProgress.length === 1 ? "" : "s"}`}
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
      )}

      {readyToShip.length > 0 && (
        <CollapsibleSection
          kicker={`${readyToShip.length} job${readyToShip.length === 1 ? "" : "s"}`}
          title="Ready to Ship"
          detail={formatCount(readyToShip.length, "job")}
        >
          <LaneSection
            laneKey="ready"
            groups={groupOrdersBySource(readyToShip)}
            emptyMessage="Nothing ready to ship."
          />
        </CollapsibleSection>
      )}

      {shipped.length > 0 && (
        <CollapsibleSection
          kicker={`${shipped.length} job${shipped.length === 1 ? "" : "s"}`}
          title="Shipped"
          detail={formatCount(shipped.length, "job")}
        >
          <LaneSection
            laneKey="shipped"
            groups={groupOrdersBySource(shipped)}
            emptyMessage="No shipped jobs."
          />
        </CollapsibleSection>
      )}

      {onHold.length > 0 && (
        <CollapsibleSection
          kicker={`${onHold.length} job${onHold.length === 1 ? "" : "s"}`}
          title="On Hold"
          detail={formatCount(onHold.length, "job")}
        >
          <LaneSection
            laneKey="hold"
            groups={groupOrdersBySource(onHold)}
            emptyMessage="Nothing on hold."
          />
        </CollapsibleSection>
      )}

      {cancelled.length > 0 && (
        <CollapsibleSection
          kicker={`${cancelled.length} job${cancelled.length === 1 ? "" : "s"}`}
          title="Cancelled"
          detail={formatCount(cancelled.length, "job")}
        >
          <LaneSection
            laneKey="cancelled"
            groups={groupOrdersBySource(cancelled)}
            emptyMessage="No cancelled jobs."
          />
        </CollapsibleSection>
      )}

      {filtered.length === 0 && (
        <div className="surface flex flex-col items-center justify-center py-16 text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            No jobs found
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
            {searchQuery ? `No results for "${searchQuery}"` : "Try adjusting your filters"}
          </p>
        </div>
      )}

      </BulkCancelProvider>
    </AppShell>
  );
}

