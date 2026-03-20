import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { orderTone } from "@/lib/presentation";
import type { Order } from "@/lib/types";

type OrdersTableProps = {
  orders: Order[];
  emptyMessage?: string;
};

export function OrdersTable({
  orders,
  emptyMessage = "No jobs in this section yet.",
}: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="surface p-6 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/jobs/${order.id}`}
          className="card card--accent-left group block px-4 py-3.5 sm:px-5"
        >
          <div className="flex items-center gap-4">
            {/* Job ID + Company */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-medium" style={{ color: "var(--accent-light)" }}>
                  {order.id}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>•</span>
                <span className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {order.company}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                {order.customer}
              </p>
            </div>

            {/* Status */}
            <span className={`pill pill--dot shrink-0 ${orderTone(order.status)}`}>
              {order.status}
            </span>

            {/* Handoff */}
            <div className="hidden min-w-[120px] sm:block">
              <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                {order.artStatus}
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {order.channel}
              </p>
            </div>

            {/* Due date */}
            <div className="hidden min-w-[100px] lg:block">
              <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                {order.dueDate}
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {order.assignee}
              </p>
            </div>

            {/* Value */}
            <div className="hidden min-w-[80px] text-right xl:block">
              <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {formatCurrency(order.value)}
              </p>
            </div>

            {/* Arrow */}
            <svg
              className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: "var(--text-tertiary)" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  );
}
