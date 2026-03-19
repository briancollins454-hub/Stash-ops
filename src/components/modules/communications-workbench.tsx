import type { CommunicationSignal } from "@/lib/types";

function signalTone(state: CommunicationSignal["state"]) {
  switch (state) {
    case "Resolved":
      return "border-emerald-300/40 bg-emerald-300/18 text-emerald-50";
    case "Unread":
      return "border-rose-200/40 bg-rose-300/16 text-rose-50";
    case "Awaiting reply":
    default:
      return "border-cyan-200/40 bg-cyan-300/18 text-cyan-50";
  }
}

export function CommunicationsWorkbench({ items }: { items: CommunicationSignal[] }) {
  if (items.length === 0) {
    return <article className="record-card p-5 text-sm text-white/66">No communications in this queue.</article>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.id}
          className="record-card grid gap-x-6 gap-y-5 px-4 py-4 sm:px-5 sm:py-5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"
        >
          <div className="min-w-0">
            <p className="eyebrow">Job</p>
            <p className="mt-2 text-lg font-semibold text-white">{item.jobId}</p>
            <p className="mt-1 break-words text-sm text-white/62">{item.account}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Channel</p>
            <p className="mt-2 text-sm font-medium text-white">
              {item.channel} · {item.direction}
            </p>
            <p className="mt-1 text-sm text-white/62">{item.updatedAt}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Subject</p>
            <p className="mt-2 break-words text-sm text-white/80">{item.subject}</p>
          </div>
          <div className="min-w-0">
            <p className="eyebrow">State</p>
            <div className="mt-3">
              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${signalTone(item.state)}`}>
                {item.state}
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

