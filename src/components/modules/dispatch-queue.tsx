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
      <div className="record-card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("unfulfilled");
              setMessage(null);
            }}
            className={`ui-control rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.17em] transition ${
              activeTab === "unfulfilled"
                ? "border-cyan-200/35 bg-cyan-300/18 text-cyan-50"
                : "border-white/14 bg-white/6 text-white/74 hover:bg-white/12"
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
            className={`ui-control rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.17em] transition ${
              activeTab === "fulfilled"
                ? "border-cyan-200/35 bg-cyan-300/18 text-cyan-50"
                : "border-white/14 bg-white/6 text-white/74 hover:bg-white/12"
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
              className="ui-control rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.17em] text-white/86 transition hover:bg-white/16"
            >
              Select all ready
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="ui-control rounded-full border border-white/14 bg-white/6 px-3 py-1.5 text-[11px] uppercase tracking-[0.17em] text-white/70 transition hover:bg-white/12"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={bulkShip}
              disabled={isSubmitting || selectedReadyCount === 0}
              className="ui-control rounded-full border border-cyan-200/35 bg-cyan-300/18 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-50 transition hover:bg-cyan-300/26 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Dispatching..." : `Bulk print + fulfill (${selectedReadyCount})`}
            </button>
          </div>
        ) : (
          <p className="text-xs text-white/60">
            Fulfilled orders are separated for tracking and audit history.
          </p>
        )}

        {message ? <p className="text-xs text-cyan-100">{message}</p> : null}
      </div>

      {orders.length === 0 ? (
        <article className="record-card p-5 text-sm text-white/68">
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
              className="record-card grid gap-x-6 gap-y-5 px-4 py-4 sm:px-5 sm:py-5 [grid-template-columns:auto_repeat(auto-fit,minmax(165px,1fr))]"
            >
              <label className="mt-1 inline-flex items-start">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOrder(order.id)}
                  disabled={activeTab !== "unfulfilled" || !order.readyToShip}
                  className="h-4 w-4 accent-cyan-300 disabled:cursor-not-allowed disabled:opacity-45"
                />
              </label>
              <div className="min-w-0">
                <p className="eyebrow">Order</p>
                <p className="mt-2 break-words text-base font-semibold text-white">{order.id}</p>
                <p className="mt-1 break-words text-xs text-white/62">
                  Shopify {order.shopifyOrderNumber ?? order.shopifyOrderId}
                </p>
              </div>
              <div className="min-w-0">
                <p className="eyebrow">Customer</p>
                <p className="mt-2 break-words text-sm font-medium text-white">{order.company}</p>
                <p className="mt-1 break-words text-xs text-white/62">{order.customer}</p>
              </div>
              <div className="min-w-0">
                <p className="eyebrow">Production</p>
                <p className="mt-2 text-sm font-medium text-white">{order.stage}</p>
                <p className="mt-1 text-xs text-white/62">Due {order.dueDate}</p>
              </div>
              <div className="min-w-0">
                <p className="eyebrow">Fulfillment</p>
                <p className="mt-2 text-sm font-medium text-white">{order.fulfillmentStatus}</p>
                <p className="mt-1 text-xs text-white/62">{order.quantity} units</p>
              </div>
              <div className="min-w-0">
                <p className="eyebrow">Dispatch gate</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {order.readyToShip ? "Ready to ship" : "Not ready"}
                </p>
                <p className="mt-1 break-words text-xs text-white/62">
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
