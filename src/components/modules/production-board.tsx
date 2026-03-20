import { productionTone } from "@/lib/presentation";
import type { ProductionJob } from "@/lib/types";

export function ProductionBoard({ jobs }: { jobs: ProductionJob[] }) {
  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <article
          key={job.id}
          className="card px-4 py-3.5"
        >
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium" style={{ color: "var(--accent-light)" }}>{job.jobId}</span>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>•</span>
                <span className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{job.customer}</span>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>{job.process} · {job.quantity} units · {job.operator}</p>
            </div>
            <span className={`pill pill--dot shrink-0 ${productionTone(job.stage)}`}>{job.stage}</span>
            <div className="hidden min-w-[80px] text-right sm:block">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Ship {job.shipDate}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
