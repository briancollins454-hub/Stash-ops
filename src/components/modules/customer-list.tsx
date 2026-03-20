import { formatCurrency } from "@/lib/format";
import type { Customer } from "@/lib/types";

const sourceBadgeStyle: Record<string, { bg: string; fg: string; label: string }> = {
  shopify: { bg: "rgba(150,191,72,0.15)", fg: "#96bf48", label: "Shopify" },
  deco: { bg: "rgba(59,130,246,0.15)", fg: "#3b82f6", label: "Deco" },
  both: { bg: "rgba(168,85,247,0.15)", fg: "#a855f7", label: "Both" },
};

export function CustomerList({ customers }: { customers: Customer[] }) {
  return (
    <div className="space-y-2">
      {customers.map((customer) => {
        const badge = customer.source ? sourceBadgeStyle[customer.source] : undefined;

        return (
          <article key={customer.id} className="card px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                style={{ background: "var(--accent-soft)", color: "var(--accent-light)" }}
              >
                {(customer.company || customer.name || "?")
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {customer.company || customer.name}
                  </p>
                  {badge && (
                    <span
                      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: badge.bg, color: badge.fg }}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                  {customer.type ?? customer.segment}
                </p>
              </div>

              {/* Value */}
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {formatCurrency(customer.lifetimeValue)}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {customer.openOrders} open
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
