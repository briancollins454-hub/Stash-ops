import { cx } from "@/lib/presentation";
import type { Metric } from "@/lib/types";

const metricWidths = ["84%", "72%", "58%", "66%"];
const metricAccents = [
  "bg-[linear-gradient(90deg,var(--accent),#a78bfa)]",
  "bg-[linear-gradient(90deg,#64748b,var(--accent))]",
  "bg-[linear-gradient(90deg,#10b981,#34d399)]",
  "bg-[linear-gradient(90deg,#06b6d4,#3b82f6)]",
];

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {metrics.map((metric, index) => {
        const featured = index === 0;

        return (
          <article
            key={metric.label}
            className={cx(
              "metric-card",
              featured && "metric-card--feature md:col-span-2 2xl:col-span-2",
            )}
          >
            <div className="relative">
              <p className="eyebrow">{metric.label}</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <h3 className="text-3xl font-semibold tabular-nums tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {metric.value}
                </h3>
                <span className="pill pill--dot pill--ghost">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--success)" }} />
                  live
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {metric.detail}
              </p>
              <div className="mt-4 h-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className={cx("h-full rounded-full transition-all duration-700", metricAccents[index])}
                  style={{ width: metricWidths[index] }}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
