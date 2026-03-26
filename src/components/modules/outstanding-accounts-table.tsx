"use client";

import { useState } from "react";
import Link from "next/link";
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
  const colors: Record<string, string> = {
    UNFULFILLED: "bg-amber-100 text-amber-800",
    PARTIALLY_FULFILLED: "bg-blue-100 text-blue-800",
    FULFILLED: "bg-green-100 text-green-800",
  };
  const labels: Record<string, string> = {
    UNFULFILLED: "Unfulfilled",
    PARTIALLY_FULFILLED: "Partial",
    FULFILLED: "Fulfilled",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function OutstandingAccountsTable({ accounts }: { accounts: OutstandingAccount[] }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"date" | "value" | "customer">("date");
  const [sortAsc, setSortAsc] = useState(false);

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

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const totalValue = filtered.reduce((sum, a) => sum + a.totalMinor, 0);

  if (accounts.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
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
          className="flex-1 min-w-[200px] max-w-md rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
        <select
          value={`${sortField}-${sortAsc ? "asc" : "desc"}`}
          onChange={(e) => {
            const [f, d] = e.target.value.split("-") as [typeof sortField, string];
            setSortField(f);
            setSortAsc(d === "asc");
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white"
        >
          <option value="value-desc">Balance: High → Low</option>
          <option value="value-asc">Balance: Low → High</option>
          <option value="date-desc">Date: Newest first</option>
          <option value="date-asc">Date: Oldest first</option>
          <option value="customer-asc">Customer: A → Z</option>
          <option value="customer-desc">Customer: Z → A</option>
        </select>
        <div className="ml-auto shrink-0 text-sm font-medium text-gray-700">
          Total: <span className="text-indigo-600">{formatCurrency(totalValue / 100)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Job ID</th>
              <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("customer")}>
                Customer {sortField === "customer" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Fulfillment</th>
              <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("date")}>
                Order Date {sortField === "date" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 cursor-pointer select-none text-right" onClick={() => toggleSort("value")}>
                Value {sortField === "value" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/jobs/${a.id}`} className="text-indigo-600 hover:underline">
                    {a.internalJobId}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{a.customer}</div>
                  {a.company && <div className="text-xs text-gray-500">{a.company}</div>}
                </td>
                <td className="px-4 py-3 text-gray-600">{a.account}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${a.source === "DECO" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                    {a.source === "DECO" ? "Deco" : "Manual"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">{lifecycleLabel(a.lifecycle)}</td>
                <td className="px-4 py-3">{fulfillmentBadge(a.fulfillmentStatus)}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(a.orderPlacedAt)}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(a.dueAt)}</td>
                <td className="px-4 py-3 text-center text-gray-600">{a.itemCount}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {formatCurrency(a.totalMinor / 100)}
                </td>
              </tr>
            ))}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50 font-medium">
                <td colSpan={9} className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-500">
                  Total Outstanding
                </td>
                <td className="px-4 py-3 text-right text-indigo-600">
                  {formatCurrency(totalValue / 100)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {sorted.length === 0 && filtered.length === 0 && accounts.length > 0 && (
        <div className="py-8 text-center text-sm text-gray-500">
          No results match your search.
        </div>
      )}
    </div>
  );
}
