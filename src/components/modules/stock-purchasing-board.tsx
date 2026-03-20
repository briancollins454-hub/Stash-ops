import type { StockPurchaseTask } from "@/lib/types";

function statusTone(status: StockPurchaseTask["status"]) {
  switch (status) {
    case "Ready":
      return "border-[#10b981]/25 bg-[#10b981]/10 text-[#6ee7b7]";
    case "Partially received":
      return "border-[#06b6d4]/25 bg-[#06b6d4]/10 text-[#67e8f9]";
    case "Ordered":
      return "border-[#6366f1]/25 bg-[#6366f1]/10 text-[#a5b4fc]";
    case "Awaiting arrival":
      return "border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#fcd34d]";
    case "Awaiting order":
    default:
      return "border-[#ef4444]/25 bg-[#ef4444]/10 text-[#fca5a5]";
  }
}

export function StockPurchasingBoard({ tasks }: { tasks: StockPurchaseTask[] }) {
  if (tasks.length === 0) {
    return <div className="surface p-5 text-sm" style={{ color: "var(--text-tertiary)" }}>No stock tasks in this lane.</div>;
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <article
          key={task.id}
          className="card px-4 py-3.5"
        >
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium" style={{ color: "var(--accent-light)" }}>{task.jobId}</span>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>•</span>
                <span className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{task.account}</span>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>{task.supplier} · {task.requiredQty} garments</p>
            </div>
            <span className={`pill pill--dot shrink-0 ${statusTone(task.status)}`}>{task.status}</span>
            <div className="hidden min-w-[80px] text-right sm:block">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>ETA {task.eta}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

