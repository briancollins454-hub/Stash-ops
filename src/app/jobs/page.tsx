import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { CollapsibleSection } from "@/components/collapsible-section";
import { OrdersTable } from "@/components/modules/orders-table";
import { CreateOrderForm } from "@/components/orders/create-order-form";
import { formatCount, shellCopy } from "@/lib/content";
import type { Order } from "@/lib/types";
import { listOrders } from "@/lib/data-repository";

export const dynamic = "force-dynamic";

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
      // Artwork, Approval, Stock, Queued, Printing
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
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={`${laneKey}-${group.key}`} className="space-y-3">
          <div className="record-card flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="eyebrow">Account/source group</p>
              <p className="mt-1 text-base font-semibold text-white">{group.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="data-pill">{group.type}</span>
              <span className="data-pill">{formatCount(group.orders.length, "job")}</span>
            </div>
          </div>
          <OrdersTable orders={group.orders} />
        </section>
      ))}
    </div>
  );
}

export default async function JobsPage() {
  const orders = await listOrders();
  const { newReview, inProgress, readyToShip, shipped, onHold, cancelled } = sortIntoLanes(orders);

  return (
    <AppShell title={shellCopy.jobs.title}>
      <SectionCard
        kicker="Manual intake"
        title="Create job"
      >
        <CreateOrderForm />
      </SectionCard>

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
    </AppShell>
  );
}

