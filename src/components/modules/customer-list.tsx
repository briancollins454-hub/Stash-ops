import { formatCurrency } from "@/lib/format";
import type { Customer } from "@/lib/types";

export function CustomerList({ customers }: { customers: Customer[] }) {
  return (
    <div className="space-y-2">
      {customers.map((customer) => (
        <article key={customer.id} className="card px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
              style={{ background: "var(--accent-soft)", color: "var(--accent-light)" }}
            >
              {customer.company
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {customer.company}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                {customer.name} · {customer.segment}
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
      ))}
    </div>
  );
}
