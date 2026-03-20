import { healthTone } from "@/lib/presentation";
import type { IntegrationHealth } from "@/lib/types";

export function IntegrationsGrid({
  integrations,
}: {
  integrations: IntegrationHealth[];
}) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
      {integrations.map((integration) => (
        <article key={integration.name} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{integration.name}</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>{integration.owner}</p>
            </div>
            <span className={`pill pill--dot shrink-0 ${healthTone(integration.health)}`}>{integration.health}</span>
          </div>
          <p className="mt-3 text-xs font-medium" style={{ color: "var(--text-primary)" }}>{integration.latency}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{integration.notes}</p>
        </article>
      ))}
    </div>
  );
}
