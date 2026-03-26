"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import type { Customer } from "@/lib/types";

const sourceBadgeStyle: Record<string, { bg: string; fg: string; label: string }> = {
  shopify: { bg: "rgba(150,191,72,0.15)", fg: "#96bf48", label: "Shopify" },
  deco: { bg: "rgba(59,130,246,0.15)", fg: "#3b82f6", label: "Deco" },
  both: { bg: "rgba(168,85,247,0.15)", fg: "#a855f7", label: "Both" },
};

export function CustomerList({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const q = query.toLowerCase().trim();
  const filtered = q
    ? customers.filter(
        (c) =>
          (c.company || "").toLowerCase().includes(q) ||
          (c.name || "").toLowerCase().includes(q) ||
          (c.type || c.segment || "").toLowerCase().includes(q),
      )
    : customers;

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--text-tertiary)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search accounts…"
          className="w-full rounded-lg border py-2 pl-10 pr-4 text-sm outline-none"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--card-border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
          No accounts match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="space-y-2">
          {q && (
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </p>
          )}
          {filtered.map((customer) => {
            const badge = customer.source ? sourceBadgeStyle[customer.source] : undefined;

            return (
              <article
                key={customer.id}
                className="card cursor-pointer px-4 py-3.5 sm:px-5 transition-all hover:brightness-110"
                onClick={() => router.push(`/accounts/${customer.id}`)}
              >
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
      )}
    </div>
  );
}
