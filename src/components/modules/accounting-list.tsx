import { formatCurrency } from "@/lib/format";
import { accountingTone } from "@/lib/presentation";
import type { AccountingRecord } from "@/lib/types";

export function AccountingList({
  records,
}: {
  records: AccountingRecord[];
}) {
  return (
    <div className="space-y-2">
      {records.map((record) => (
        <article
          key={record.id}
          className="card px-4 py-3.5"
        >
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{record.customer}</span>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>•</span>
                <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{record.jobId}</span>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>{record.type} · {record.terms}</p>
            </div>
            <span className={`pill pill--dot shrink-0 ${accountingTone(record.qboStatus)}`}>{record.qboStatus}</span>
            <div className="hidden min-w-[100px] text-right sm:block">
              <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{formatCurrency(record.amount)}</p>
              <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{record.updatedAt}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
