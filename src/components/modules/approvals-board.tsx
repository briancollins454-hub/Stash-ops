import { approvalTone } from "@/lib/presentation";
import type { Approval } from "@/lib/types";

type ApprovalsBoardProps = {
  approvals: Approval[];
  compact?: boolean;
};

export function ApprovalsBoard({
  approvals,
  compact = false,
}: ApprovalsBoardProps) {
  return (
    <div
      className={
        compact
          ? "grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]"
          : "grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
      }
    >
      {approvals.map((approval) => (
        <article key={approval.id} className="record-card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div className="min-w-0">
              <p className="eyebrow">Approval</p>
              <p className="mt-2 break-words text-lg font-semibold tracking-tight text-white">
                {approval.orderId}
              </p>
              <p className="mt-1 break-words text-sm text-white/60">
                {approval.customer}
              </p>
            </div>
            <span
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${approvalTone(approval.status)}`}
            >
              {approval.status}
            </span>
          </div>
          <p className="mt-6 break-words text-sm font-medium text-white">
            {approval.asset}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-sm text-white/58">
            <span className="break-words">{approval.sentAt}</span>
            <span className="break-words">{approval.proofOwner}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
