import type { WarehouseReceiptTask } from "@/lib/types";

function receiptTone(status: WarehouseReceiptTask["status"]) {
  switch (status) {
    case "Complete":
      return "border-emerald-300/40 bg-emerald-300/18 text-emerald-50";
    case "Partial receipt":
      return "border-cyan-200/40 bg-cyan-300/18 text-cyan-50";
    case "Pending receipt":
    default:
      return "border-amber-200/40 bg-amber-300/16 text-amber-50";
  }
}

export function WarehouseReceiptsBoard({ tasks }: { tasks: WarehouseReceiptTask[] }) {
  if (tasks.length === 0) {
    return <article className="record-card p-5 text-sm text-white/66">No warehouse receipts pending.</article>;
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <article
          key={task.id}
          className="record-card grid gap-x-6 gap-y-5 px-4 py-4 sm:px-5 sm:py-5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]"
        >
          <div className="min-w-0">
            <p className="eyebrow">Job</p>
            <p className="mt-2 text-lg font-semibold text-white">{task.jobId}</p>
            <p className="mt-1 break-words text-sm text-white/62">{task.account}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Receipt</p>
            <p className="mt-2 text-sm font-medium text-white">
              {task.receivedQty}/{task.expectedQty} scanned
            </p>
            <p className="mt-1 text-sm text-white/62">{task.branch}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Warehouse state</p>
            <div className="mt-3">
              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${receiptTone(task.status)}`}>
                {task.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-white/62">{task.lastScan}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

