"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OutstandingAccount } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function lifecycleLabel(lc: string): string {
  const map: Record<string, string> = {
    INGESTED: "Ingested",
    CLASSIFIED: "Classified",
    CONFIGURED: "Configured",
    PUSHED_TO_DECO: "Pushed to Deco",
    AWAITING_STOCK: "Awaiting Stock",
    STOCK_RECEIVED: "Stock Received",
    PRODUCTION_QUEUED: "Production Queued",
    IN_PRODUCTION: "In Production",
    COMPLETED: "Completed",
    ON_HOLD: "On Hold",
  };
  return map[lc] ?? lc;
}

function fulfillmentBadge(status: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    UNFULFILLED: { bg: "rgba(245,158,11,0.15)", text: "#fbbf24" },
    PARTIALLY_FULFILLED: { bg: "rgba(96,165,250,0.15)", text: "#60a5fa" },
    FULFILLED: { bg: "rgba(34,197,94,0.15)", text: "#4ade80" },
  };
  const labels: Record<string, string> = {
    UNFULFILLED: "Unfulfilled",
    PARTIALLY_FULFILLED: "Partial",
    FULFILLED: "Fulfilled",
  };
  const c = colors[status] ?? { bg: "rgba(255,255,255,0.06)", text: "var(--text-secondary)" };
  return (
    <span style={{ background: c.bg, color: c.text }} className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium">
      {labels[status] ?? status}
    </span>
  );
}

export function OutstandingAccountsTable({ accounts }: { accounts: OutstandingAccount[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("value-desc");

  const [sortField, sortDir] = sortKey.split("-") as ["date" | "value" | "customer", string];
  const sortAsc = sortDir === "asc";

  const filtered = accounts.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.customer.toLowerCase().includes(q) ||
      a.company.toLowerCase().includes(q) ||
      a.account.toLowerCase().includes(q) ||
      a.internalJobId.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "date") {
      const da = a.orderPlacedAt ? new Date(a.orderPlacedAt).getTime() : 0;
      const db = b.orderPlacedAt ? new Date(b.orderPlacedAt).getTime() : 0;
      cmp = da - db;
    } else if (sortField === "value") {
      cmp = a.totalMinor - b.totalMinor;
    } else {
      cmp = a.customer.localeCompare(b.customer);
    }
    return sortAsc ? cmp : -cmp;
  });

  const totalValue = filtered.reduce((sum, a) => sum + a.totalMinor, 0);

  if (accounts.length === 0) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
        No outstanding accounts found. All caught up!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + sort + summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by customer, company, or job ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          <option value="value-desc">Balance: High → Low</option>
          <option value="value-asc">Balance: Low → High</option>
          <option value="date-desc">Date: Newest first</option>
          <option value="date-asc">Date: Oldest first</option>
          <option value="customer-asc">Customer: A → Z</option>
          <option value="customer-desc">Customer: Z → A</option>
        </select>
        <div className="ml-auto shrink-0 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Total: <span style={{ color: "#a5b4fc" }}>{formatCurrency(totalValue / 100)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", color: "var(--text-tertiary)" }}
                className="text-left text-[11px] font-medium uppercase tracking-wider">
              <th className="px-4 py-3">Job ID</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Fulfillment</th>
              <th className="px-4 py-3">Order Date</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr
                key={a.id}
                onClick={() => router.push(`/jobs/${a.id}`)}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td className="px-4 py-3 font-mono text-xs" style={{ color: "#a5b4fc" }}>
                  {a.internalJobId}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium" style={{ color: "var(--text-primary)" }}>{a.customer}</div>
                  {a.company && <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{a.company}</div>}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{a.account}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={a.source === "DECO"
                      ? { background: "rgba(168,85,247,0.15)", color: "#c084fc" }
                      : { background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}
                  >
                    {a.source === "DECO" ? "Deco" : "Manual"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{lifecycleLabel(a.lifecycle)}</td>
                <td className="px-4 py-3">{fulfillmentBadge(a.fulfillmentStatus)}</td>
                <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{formatDate(a.orderPlacedAt)}</td>
                <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{formatDate(a.dueAt)}</td>
                <td className="px-4 py-3 text-center" style={{ color: "var(--text-secondary)" }}>{a.itemCount}</td>
                <td className="px-4 py-3 text-right font-medium" style={{ color: "var(--text-primary)" }}>
                  {formatCurrency(a.totalMinor / 100)}
                </td>
              </tr>
            ))}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }} className="font-medium">
                <td colSpan={9} className="px-4 py-3 text-right text-[11px] uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Total Outstanding
                </td>
                <td className="px-4 py-3 text-right" style={{ color: "#a5b4fc" }}>
                  {formatCurrency(totalValue / 100)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {sorted.length === 0 && accounts.length > 0 && (
        <div className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
          No results match your search.
        </div>
      )}
    </div>
  );
}
