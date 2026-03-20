"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DispatchOrder } from "@/lib/types";

type DispatchQueueProps = {
  unfulfilledOrders: DispatchOrder[];
  fulfilledOrders: DispatchOrder[];
};

type DispatchTab = "unfulfilled" | "fulfilled";

export function DispatchQueue({
  unfulfilledOrders,
  fulfilledOrders,
}: DispatchQueueProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DispatchTab>("unfulfilled");
  const [selected, setSelected] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const orders = activeTab === "unfulfilled" ? unfulfilledOrders : fulfilledOrders;

  const readyOrderIds = useMemo(
    () => unfulfilledOrders.filter((order) => order.readyToShip).map((order) => order.id),
    [unfulfilledOrders],
  );

  const selectedReadyCount = selected.filter((id) => readyOrderIds.includes(id)).length;

  function toggleOrder(orderId: string) {
    setSelected((current) =>
      current.includes(orderId)
        ? current.filter((value) => value !== orderId)
        : [...current, orderId],
    );
  }

  function selectAllReady() {
    setSelected(readyOrderIds);
  }

  function clearSelection() {
    setSelected([]);
  }

  async function bulkShip() {
    if (selectedReadyCount === 0) {
      setMessage("Select at least one ready-to-ship order.");
      return;
    }

    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/dispatch/bulk-ship", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          orderIds: selected.filter((id) => readyOrderIds.includes(id)),
          actor: "dispatch.ui",
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        data?: {
          dispatched: number;
          fulfilled: number;
          batchId: string;
          note: string;
          emulatedPrint: boolean;
        };
      };

      if (!response.ok || !data.data) {
        setMessage(data.error ?? "Bulk dispatch failed.");
        setIsSubmitting(false);
        return;
      }

      setMessage(
        `${data.data.dispatched} dispatched, ${data.data.fulfilled} fulfilled in Shopify. Batch ${data.data.batchId}${data.data.emulatedPrint ? " (simulated print)." : "."}`,
      );
      clearSelection();

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setMessage("Network error while dispatching.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="surface space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("unfulfilled");
              setMessage(null);
            }}
            className={`pill transition ${
              activeTab === "unfulfilled"
                ? "border-[#6366f1]/30 bg-[#6366f1]/12 text-[#a5b4fc]"
                : "pill--ghost hover:border-[rgba(255,255,255,0.14)]"
            }`}
          >
            Unfulfilled ({unfulfilledOrders.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("fulfilled");
              setMessage(null);
            }}
            className={`pill transition ${
              activeTab === "fulfilled"
                ? "border-[#6366f1]/30 bg-[#6366f1]/12 text-[#a5b4fc]"
                : "pill--ghost hover:border-[rgba(255,255,255,0.14)]"
            }`}
          >
            Fulfilled ({fulfilledOrders.length})
          </button>
        </div>

        {activeTab === "unfulfilled" ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAllReady}
              className="pill pill--ghost transition hover:border-[rgba(255,255,255,0.14)]"
            >
              Select all ready
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="pill pill--ghost transition hover:border-[rgba(255,255,255,0.14)]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={bulkShip}
              disabled={isSubmitting || selectedReadyCount === 0}
              className="btn btn--primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Dispatching..." : `Bulk print + fulfill (${selectedReadyCount})`}
            </button>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Fulfilled orders are separated for tracking and audit history.
          </p>
        )}

        {message ? <p className="text-xs" style={{ color: "var(--accent-light)" }}>{message}</p> : null}
      </div>

      {orders.length === 0 ? (
        <article className="surface p-5 text-sm" style={{ color: "var(--text-secondary)" }}>
          {activeTab === "unfulfilled"
            ? "No Shopify unfulfilled orders are currently in the queue."
            : "No fulfilled Shopify orders have been synced yet."}
        </article>
      ) : (
        orders.map((order) => {
          const checked = selected.includes(order.id);
          return (
            <article
              key={order.id}
              className="card grid gap-x-5 gap-y-3 px-4 py-3 [grid-template-columns:auto_repeat(auto-fit,minmax(150px,1fr))]"
            >
              <label className="mt-1 inline-flex items-start">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOrder(order.id)}
                  disabled={activeTab !== "unfulfilled" || !order.readyToShip}
                  className="h-4 w-4 accent-[#6366f1] disabled:cursor-not-allowed disabled:opacity-45"
                />
              </label>
              <div className="min-w-0">
                <p className="eyebrow">Order</p>
                <p className="mt-1 truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{order.id}</p>
                <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                  Shopify {order.shopifyOrderNumber ?? order.shopifyOrderId}
                </p>
              </div>
              <div className="min-w-0">
                <p className="eyebrow">Customer</p>
                <p className="mt-1 truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{order.company}</p>
                <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>{order.customer}</p>
              </div>
              <div className="min-w-0">
                <p className="eyebrow">Production</p>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{order.stage}</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>Due {order.dueDate}</p>
              </div>
              <div className="min-w-0">
                <p className="eyebrow">Fulfillment</p>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{order.fulfillmentStatus}</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>{order.quantity} units</p>
              </div>
              <div className="min-w-0">
                <p className="eyebrow">Dispatch gate</p>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {order.readyToShip ? "Ready to ship" : "Not ready"}
                </p>
                <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                  {order.blocked
                    ? order.blockedReason ?? "Blocked by lifecycle rules."
                    : "No active blocker"}
                </p>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
