import { formatCurrency } from "@/lib/format";
import type { InboxThread, IntegrationHealth, Order } from "@/lib/types";

type CommandSpotlightProps = {
  orders: Order[];
  threads: InboxThread[];
  integrations: IntegrationHealth[];
};

export function CommandSpotlight({
  orders,
  threads,
  integrations,
}: CommandSpotlightProps) {
  const priorityOrders = orders.slice(0, 3);
  const hotThreads = threads.slice(0, 2);
  const systemsNeedingAttention = integrations.filter(
    (integration) => integration.health !== "Healthy",
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="surface-raised p-5 sm:p-6">
        <p className="eyebrow">Priority jobs</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {priorityOrders.map((order) => (
            <article
              key={order.id}
              className="card p-4"
            >
              <p className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>
                {order.status}
              </p>
              <p className="mt-1.5 truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {order.company}
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {formatCurrency(order.value)}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{order.artStatus}</p>
              <span className="mt-2 inline-flex pill pill--ghost">
                {order.dueDate}
              </span>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4">
        <section className="surface p-5">
          <div className="min-w-0">
            <p className="eyebrow">Inbox</p>
            <h3 className="mt-1.5 text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Recent threads
            </h3>
          </div>
          <div className="mt-4 space-y-2">
            {hotThreads.map((thread) => (
              <article key={thread.id} className="card px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{thread.subject}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {thread.customer} · {thread.linkedOrder}
                    </p>
                  </div>
                  <span className="pill pill--ghost shrink-0">{thread.priority}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {thread.summary}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="surface p-5">
          <div className="min-w-0">
            <p className="eyebrow">Integrations</p>
            <h3 className="mt-1.5 text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Attention needed
            </h3>
          </div>
          <div className="mt-4 space-y-2">
            {systemsNeedingAttention.map((integration) => (
              <article key={integration.name} className="card px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{integration.name}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>{integration.latency}</p>
                  </div>
                  <span className="pill pill--dot shrink-0 border-[#ef4444]/25 bg-[#ef4444]/10 text-[#fca5a5]">
                    {integration.health}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {integration.notes}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
