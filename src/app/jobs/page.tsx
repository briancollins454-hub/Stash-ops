import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
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

export default async function JobsPage() {
  const orders = await listOrders();
  const activeOrders = orders.filter((order) => order.status !== "Shipping");
  const completedOrders = orders.filter((order) => order.status === "Shipping");
  const activeGroups = groupOrdersBySource(activeOrders);
  const completedGroups = groupOrdersBySource(completedOrders);

  return (
    <AppShell
      title={shellCopy.jobs.title}
      description={shellCopy.jobs.description}
    >
      <SectionCard
        kicker="Manual intake"
        title="Create manual internal job"
        detail="Manual jobs follow the same lifecycle and rule engine as Shopify-ingested jobs."
      >
        <CreateOrderForm />
      </SectionCard>

      <SectionCard
        kicker="Active pipeline"
        title="All active jobs"
        detail={formatCount(activeOrders.length, "active job")}
      >
        {activeGroups.length === 0 ? (
          <OrdersTable orders={[]} emptyMessage="No active jobs right now." />
        ) : (
          <div className="space-y-5">
            {activeGroups.map((group) => (
              <section key={`active-${group.key}`} className="space-y-3">
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
        )}
      </SectionCard>

      <SectionCard
        kicker="Completed lane"
        title="Completed / fulfilled jobs"
        detail={formatCount(completedOrders.length, "completed job")}
      >
        {completedGroups.length === 0 ? (
          <OrdersTable
            orders={[]}
            emptyMessage="No completed jobs yet."
          />
        ) : (
          <div className="space-y-5">
            {completedGroups.map((group) => (
              <section key={`completed-${group.key}`} className="space-y-3">
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
        )}
      </SectionCard>
    </AppShell>
  );
}

