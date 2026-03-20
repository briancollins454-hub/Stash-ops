"use client";

import { useState, type ReactNode } from "react";

type CollapsibleSectionProps = {
  title: string;
  kicker?: string;
  detail?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  kicker,
  detail,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="surface p-5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center gap-3 text-left"
      >
        <svg
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          style={{ color: "var(--text-tertiary)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="min-w-0">
            {kicker ? <p className="eyebrow mb-1">{kicker}</p> : null}
            <h2 className="break-words text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {title}
            </h2>
          </div>
          {detail ? (
            <span className="pill pill--ghost shrink-0">{detail}</span>
          ) : null}
        </div>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}
