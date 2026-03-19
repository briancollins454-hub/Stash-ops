import { cx } from "@/lib/presentation";
import type { Metric } from "@/lib/types";

const metricWidths = ["84%", "72%", "58%", "66%"];
const metricAccents = [
  "bg-[linear-gradient(90deg,#e3c96e,#f97366)]",
  "bg-[linear-gradient(90deg,#7f8fb0,#e3c96e)]",
  "bg-[linear-gradient(90deg,#0ea5a0,#22d3c6)]",
  "bg-[linear-gradient(90deg,#22d3c6,#3b82f6)]",
];

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
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
            <div
              className={cx(
                "absolute right-0 top-0 h-32 w-32 rounded-full blur-3xl",
                featured ? "bg-[#e3c96e]/24" : "bg-[#22d3c6]/18",
              )}
            />
            <div className="relative">
              <p className={cx("eyebrow", featured && "text-white/52")}>
                {metric.label}
              </p>
              <div className="mt-5 flex items-end justify-between gap-4">
                <h3
                  className={cx(
                    "text-4xl font-semibold tracking-tight",
                    featured ? "text-[#fff7ec]" : "text-white",
                  )}
                >
                  {metric.value}
                </h3>
                <span
                  className={cx(
                    "status-dot",
                    featured &&
                      "border-white/16 bg-white/[0.12] text-[#fff7ec]/80",
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-[#4ed2ce]" />
                  live
                </span>
              </div>
              <p
                className={cx(
                  "mt-4 text-sm leading-6",
                  featured ? "text-white/68" : "text-white/62",
                )}
              >
                {metric.detail}
              </p>
              <div
                className={cx(
                  "mt-6 h-1.5 overflow-hidden rounded-full",
                  featured ? "bg-white/14" : "bg-white/10",
                )}
              >
                <div
                  className={cx("h-full rounded-full", metricAccents[index])}
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
