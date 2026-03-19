import type { StockPurchaseTask } from "@/lib/types";

function statusTone(status: StockPurchaseTask["status"]) {
  switch (status) {
    case "Ready":
      return "border-emerald-300/40 bg-emerald-300/18 text-emerald-50";
    case "Partially received":
      return "border-cyan-200/40 bg-cyan-300/18 text-cyan-50";
    case "Ordered":
      return "border-blue-200/40 bg-blue-300/18 text-blue-50";
    case "Awaiting arrival":
      return "border-amber-200/40 bg-amber-300/16 text-amber-50";
    case "Awaiting order":
    default:
      return "border-rose-200/40 bg-rose-300/16 text-rose-50";
  }
}

export function StockPurchasingBoard({ tasks }: { tasks: StockPurchaseTask[] }) {
  if (tasks.length === 0) {
    return <article className="record-card p-5 text-sm text-white/66">No stock tasks in this lane.</article>;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <article
          key={task.id}
          className="record-card grid gap-x-6 gap-y-5 px-4 py-4 sm:px-5 sm:py-5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"
        >
          <div className="min-w-0">
            <p className="eyebrow">Job</p>
            <p className="mt-2 text-lg font-semibold text-white">{task.orderId}</p>
            <p className="mt-1 break-words text-sm text-white/60">{task.account}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Supplier</p>
            <p className="mt-2 text-sm font-medium text-white">{task.supplier}</p>
            <p className="mt-1 text-sm text-white/62">{task.requiredQty} garments required</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Status</p>
            <div className="mt-3">
              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${statusTone(task.status)}`}>
                {task.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-white/62">ETA {task.eta}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Blocker</p>
            <p className="mt-3 break-words text-sm text-white/72">
              {task.blocker ?? "No active blocker"}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

