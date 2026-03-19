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
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="dark-panel relative overflow-hidden p-5 sm:p-6 xl:p-7">
        <div className="pointer-events-none absolute -left-16 -top-14 h-56 w-56 rounded-full bg-[#22d3c6]/20 blur-[62px]" />
        <div className="pointer-events-none absolute -bottom-20 right-8 h-52 w-52 rounded-full bg-[#c9a84c]/20 blur-[58px]" />

        <p className="eyebrow text-white/58">Mission Pulse</p>
        <h2
          className="mt-4 max-w-3xl break-words pb-[0.16em] text-[clamp(2.3rem,4.8vw,4.6rem)] leading-[1.12] tracking-[-0.02em] text-white"
          style={{ fontFamily: "var(--font-fraunces)" }}
        >
          Give every team a single live operating layer.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
          Move from customer message to artwork to production to accounting without
          bouncing between disconnected tools.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {priorityOrders.map((order) => (
            <article
              key={order.id}
              className="rounded-[1.2rem] border border-white/14 bg-white/[0.07] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur"
            >
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/56">
                {order.status}
              </p>
              <p className="mt-2 break-words text-base font-medium text-[#f4f9ff]">
                {order.company}
              </p>
              <p className="mt-3 text-2xl font-semibold text-[#f4f9ff]">
                {formatCurrency(order.value)}
              </p>
              <p className="mt-2 text-xs leading-5 text-white/68">{order.artStatus}</p>
              <span className="mt-3 inline-flex whitespace-nowrap rounded-full border border-white/14 bg-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-white/76">
                {order.dueDate}
              </span>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6">
        <section className="panel studio-glass-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">What matters next</p>
              <h3 className="mt-3 break-words text-2xl font-semibold leading-[1.2] tracking-tight text-white">
                Human moments tied to revenue
              </h3>
            </div>
            <span className="glass-pill">Shared inbox</span>
          </div>
          <div className="mt-6 space-y-4">
            {hotThreads.map((thread) => (
              <article key={thread.id} className="record-card px-4 py-4 sm:px-5">
                <div className="flex flex-wrap gap-3 lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-white">{thread.subject}</p>
                    <p className="mt-1 break-words text-sm text-white/60">
                      {thread.customer} · {thread.linkedOrder}
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/72">
                    {thread.priority}
                  </span>
                </div>
                <p className="mt-4 break-words text-sm leading-6 text-white/62">
                  {thread.summary}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel studio-glass-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">System tempo</p>
              <h3 className="mt-3 break-words text-2xl font-semibold leading-[1.2] tracking-tight text-white">
                Silent integrations, visible exceptions
              </h3>
            </div>
            <span className="glass-pill">Backplane</span>
          </div>
          <div className="mt-6 space-y-4">
            {systemsNeedingAttention.map((integration) => (
              <article key={integration.name} className="record-card px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-white">{integration.name}</p>
                    <p className="mt-1 text-sm text-white/60">
                      {integration.latency}
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded-full border border-[#f97366]/35 bg-[#f97366]/14 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#ffd2c9]">
                    {integration.health}
                  </span>
                </div>
                <p className="mt-4 break-words text-sm leading-6 text-white/62">
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
