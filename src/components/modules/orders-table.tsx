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
  emptyMessage = "No orders in this section yet.",
}: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <article className="record-card p-5 text-sm text-white/66">
        {emptyMessage}
      </article>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <article
          key={order.id}
          className="record-card grid gap-x-6 gap-y-5 px-4 py-4 sm:px-5 sm:py-5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]"
        >
          <div className="min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">Order</p>
                <Link
                  href={`/orders/${order.id}`}
                  className="mt-2 inline-block break-words text-xl font-semibold tracking-tight text-white underline-offset-4 transition hover:text-[#d7f6f2] hover:underline"
                >
                  {order.id}
                </Link>
              </div>
              <span
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${orderTone(order.status)}`}
              >
                {order.status}
              </span>
            </div>
            <div className="min-w-0">
              <p className="break-words font-medium text-white">{order.company}</p>
              <p className="mt-1 break-words text-sm text-white/60">{order.customer}</p>
            </div>
          </div>

          <div className="min-w-0">
            <p className="eyebrow">Current handoff</p>
            <p className="mt-3 break-words text-sm font-medium text-white">
              {order.artStatus}
            </p>
            <p className="mt-2 break-words text-sm text-white/60">{order.channel}</p>
          </div>

          <div className="min-w-0">
            <p className="eyebrow">Delivery</p>
            <p className="mt-3 text-sm font-medium text-white">
              Due {order.dueDate}
            </p>
            <p className="mt-2 break-words text-sm text-white/60">Owner {order.assignee}</p>
          </div>

          <div className="min-w-0">
            <p className="eyebrow">Value</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
              {formatCurrency(order.value)}
            </p>
            <div className="mt-4 flex justify-start">
              <span className="rounded-full border border-white/14 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/68">
                {order.channel}
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
