"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { orderTone } from "@/lib/presentation";
import { formatCount } from "@/lib/content";
import type { Order } from "@/lib/types";
import { useBulkCancel } from "@/components/jobs/bulk-cancel-provider";

type OrdersTableProps = {
  orders: Order[];
  emptyMessage?: string;
};

export function OrdersTable({
  orders,
  emptyMessage = "No jobs in this section yet.",
}: OrdersTableProps) {
  const { enabled, selected, toggle, selectAll } = useBulkCancel();
  const allIds = orders.map((o) => o.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  if (orders.length === 0) {
    return (
      <div className="surface p-6 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {enabled && orders.length > 1 && (
        <button
          onClick={() => selectAll(allIds)}
          className="ml-1 text-[11px] font-medium transition-colors hover:brightness-125"
          style={{ color: "var(--text-tertiary)" }}
        >
          {allSelected ? "Deselect all" : `Select all ${orders.length}`}
        </button>
      )}
      {orders.map((order) => {
        const isSelected = selected.has(order.id);
        const isCancelled = order.status === "Cancelled";

        return (
          <div key={order.id} className="relative">
            {enabled && !isCancelled && (
              <button
                onClick={() => toggle(order.id)}
                className="absolute left-0 top-0 z-10 flex h-full w-10 items-center justify-center"
                aria-label={isSelected ? "Deselect" : "Select"}
              >
                <div
                  className="flex h-4 w-4 items-center justify-center rounded border transition-colors"
                  style={{
                    borderColor: isSelected ? "#ef4444" : "var(--border)",
                    background: isSelected ? "rgba(239,68,68,0.25)" : "transparent",
                  }}
                >
                  {isSelected && (
                    <svg className="h-3 w-3 text-[#fca5a5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            )}
            <Link
              href={`/jobs/${order.id}`}
              className="card card--accent-left group block px-4 py-3.5 sm:px-5"
              style={{
                ...(enabled && !isCancelled ? { paddingLeft: "2.5rem" } : {}),
                ...(isSelected ? { borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.04)" } : {}),
              }}
              onClick={enabled && !isCancelled ? (e) => { e.preventDefault(); toggle(order.id); } : undefined}
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
          </div>
        );
      })}
    </div>
  );
}

/* ── Lane section (client component to avoid hydration mismatch) ── */

type SourceGroup = {
  key: string;
  label: string;
  type: string;
  orders: Order[];
};

export function LaneSection({
  laneKey,
  groups,
  emptyMessage,
}: {
  laneKey: string;
  groups: SourceGroup[];
  emptyMessage: string;
}) {
  if (groups.length === 0) {
    return <OrdersTable orders={[]} emptyMessage={emptyMessage} />;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={`${laneKey}-${group.key}`} className="space-y-2">
          <div className="surface flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="eyebrow">Account/source group</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{group.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="pill pill--ghost">{group.type}</span>
              <span className="pill pill--ghost">{formatCount(group.orders.length, "job")}</span>
            </div>
          </div>
          <OrdersTable orders={group.orders} />
        </div>
      ))}
    </div>
  );
}
