import { productionTone } from "@/lib/presentation";
import type { ProductionJob } from "@/lib/types";

export function ProductionBoard({ jobs }: { jobs: ProductionJob[] }) {
  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <article
          key={job.id}
          className="record-card grid gap-x-6 gap-y-5 px-4 py-4 sm:px-5 sm:py-5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]"
        >
          <div className="min-w-0">
            <p className="eyebrow">Job</p>
            <p className="mt-2 break-words text-lg font-semibold tracking-tight text-white">
              {job.orderId}
            </p>
            <p className="mt-1 break-words text-sm text-white/60">{job.customer}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Stage</p>
            <div className="mt-3">
              <span
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${productionTone(job.stage)}`}
              >
                {job.stage}
              </span>
            </div>
            <p className="mt-3 break-words text-sm text-white/60">{job.process}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Output</p>
            <p className="mt-3 text-sm font-medium text-white">
              {job.quantity} units
            </p>
            <p className="mt-2 text-sm text-white/60">Ship {job.shipDate}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Operator</p>
            <p className="mt-3 break-words text-sm font-medium text-white">
              {job.operator}
            </p>
            <p className="mt-2 text-sm text-white/60">{job.id}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
