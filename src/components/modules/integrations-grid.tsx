import { healthTone } from "@/lib/presentation";
import type { IntegrationHealth } from "@/lib/types";

export function IntegrationsGrid({
  integrations,
}: {
  integrations: IntegrationHealth[];
}) {
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
      {integrations.map((integration) => (
        <article key={integration.name} className="record-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words font-medium text-white">{integration.name}</p>
              <p className="mt-2 text-sm text-white/60">{integration.owner}</p>
            </div>
            <span
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${healthTone(integration.health)}`}
            >
              {integration.health}
            </span>
          </div>
          <p className="mt-5 text-sm font-medium text-white">
            {integration.latency}
          </p>
          <p className="mt-3 break-words text-sm leading-6 text-white/62">
            {integration.notes}
          </p>
        </article>
      ))}
    </div>
  );
}
