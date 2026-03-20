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
          ? "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]"
          : "grid gap-3 md:grid-cols-2 2xl:grid-cols-3"
      }
    >
      {approvals.map((approval) => (
        <article key={approval.id} className="card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-xs font-medium" style={{ color: "var(--accent-light)" }}>{approval.jobId}</p>
              <p className="mt-0.5 truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{approval.customer}</p>
            </div>
            <span className={`pill pill--dot shrink-0 ${approvalTone(approval.status)}`}>{approval.status}</span>
          </div>
          <p className="mt-3 truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>{approval.asset}</p>
          <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}>
            <span>{approval.sentAt}</span>
            <span>{approval.proofOwner}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
