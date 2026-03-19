import { formatCurrency } from "@/lib/format";
import { accountingTone } from "@/lib/presentation";
import type { AccountingRecord } from "@/lib/types";

export function AccountingList({
  records,
}: {
  records: AccountingRecord[];
}) {
  return (
    <div className="space-y-3">
      {records.map((record) => (
        <article
          key={record.id}
          className="record-card grid gap-x-6 gap-y-5 px-4 py-4 sm:px-5 sm:py-5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"
        >
          <div className="min-w-0">
            <p className="eyebrow">Account</p>
            <p className="mt-2 break-words text-lg font-semibold tracking-tight text-white">
              {record.customer}
            </p>
            <p className="mt-1 break-words text-sm text-white/60">
              {record.jobId} · {record.type}
            </p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Amount</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
              {formatCurrency(record.amount)}
            </p>
            <p className="mt-2 text-sm text-white/60">{record.terms}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Sync status</p>
            <div className="mt-3">
              <span
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${accountingTone(record.qboStatus)}`}
              >
                {record.qboStatus}
              </span>
            </div>
            <p className="mt-3 break-words text-sm text-white/60">{record.updatedAt}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Posting lane</p>
            <p className="mt-3 break-words text-sm font-medium text-white">
              QuickBooks Online
            </p>
            <p className="mt-2 text-sm text-white/60">Ready to reconcile</p>
          </div>
        </article>
      ))}
    </div>
  );
}
