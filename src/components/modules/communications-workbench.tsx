import type { CommunicationSignal } from "@/lib/types";

function signalTone(state: CommunicationSignal["state"]) {
  switch (state) {
    case "Resolved":
      return "border-[#10b981]/25 bg-[#10b981]/10 text-[#6ee7b7]";
    case "Unread":
      return "border-[#ef4444]/25 bg-[#ef4444]/10 text-[#fca5a5]";
    case "Awaiting reply":
    default:
      return "border-[#06b6d4]/25 bg-[#06b6d4]/10 text-[#67e8f9]";
  }
}

export function CommunicationsWorkbench({ items }: { items: CommunicationSignal[] }) {
  if (items.length === 0) {
    return <div className="surface p-5 text-sm" style={{ color: "var(--text-tertiary)" }}>No communications in this queue.</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <article
          key={item.id}
          className="card px-4 py-3.5"
        >
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium" style={{ color: "var(--accent-light)" }}>{item.jobId}</span>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>•</span>
                <span className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.account}</span>
              </div>
              <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>{item.channel} · {item.direction} · {item.subject}</p>
            </div>
            <span className={`pill pill--dot shrink-0 ${signalTone(item.state)}`}>{item.state}</span>
            <div className="hidden min-w-[80px] text-right sm:block">
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{item.updatedAt}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

