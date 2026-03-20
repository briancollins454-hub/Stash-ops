import { priorityTone } from "@/lib/presentation";
import type { InboxThread } from "@/lib/types";

export function InboxList({ threads }: { threads: InboxThread[] }) {
  return (
    <div className="space-y-2">
      {threads.map((thread) => (
        <article key={thread.id} className="card px-4 py-3.5">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{thread.subject}</span>
                <span className={`pill pill--dot shrink-0 ${priorityTone(thread.priority)}`}>{thread.priority}</span>
              </div>
              <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                {thread.customer} · {thread.channel} · {thread.linkedOrder}
              </p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{thread.updatedAt}</p>
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {thread.summary}
          </p>
        </article>
      ))}
    </div>
  );
}
