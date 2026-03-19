import { formatCurrency } from "@/lib/format";
import type { Customer } from "@/lib/types";

export function CustomerList({ customers }: { customers: Customer[] }) {
  return (
    <div className="space-y-3">
      {customers.map((customer) => (
        <article key={customer.id} className="record-card px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] border border-white/20 bg-[linear-gradient(140deg,#e3c96e,#b89236)] text-sm font-semibold text-[#161c2a] shadow-[0_14px_24px_rgba(201,168,76,0.25)]">
                {customer.company
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </div>
              <div className="min-w-0">
                <p className="break-words font-medium text-white">{customer.company}</p>
                <p className="mt-1 break-words text-sm text-white/60">
                  {customer.name} · {customer.segment} · {customer.region}
                </p>
                <p className="mt-4 break-words text-sm leading-6 text-white/62">
                  {customer.lastTouch}
                </p>
              </div>
            </div>
            <div className="min-w-0 xl:text-right">
              <p className="eyebrow">Lifetime value</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {formatCurrency(customer.lifetimeValue)}
              </p>
              <p className="mt-2 break-words text-sm text-white/60">
                {customer.openOrders} open orders · last order {customer.lastOrder}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
