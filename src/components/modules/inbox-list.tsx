import { priorityTone } from "@/lib/presentation";
import type { InboxThread } from "@/lib/types";

export function InboxList({ threads }: { threads: InboxThread[] }) {
  return (
    <div className="space-y-3">
      {threads.map((thread) => (
        <article key={thread.id} className="record-card px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="break-words font-medium text-white">{thread.subject}</p>
                <span
                  className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${priorityTone(thread.priority)}`}
                >
                  {thread.priority}
                </span>
              </div>
              <p className="mt-3 break-words text-sm text-white/60">
                {thread.customer} · {thread.channel} · {thread.linkedOrder}
              </p>
              <p className="mt-4 max-w-2xl break-words text-sm leading-6 text-white/62">
                {thread.summary}
              </p>
            </div>
            <div className="min-w-0 xl:text-right">
              <p className="eyebrow">Updated</p>
              <p className="mt-3 break-words text-sm font-medium text-white">
                {thread.updatedAt}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
