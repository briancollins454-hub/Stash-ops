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
    <section className="panel section-panel p-5 sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between sm:gap-4"
      >
        <div className="flex min-w-0 items-center gap-3 sm:pr-12">
          <svg
            className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <div className="min-w-0">
            {kicker ? <p className="eyebrow">{kicker}</p> : null}
            <h2 className="mt-1 break-words pb-[0.08em] text-2xl font-semibold leading-[1.16] tracking-tight text-white">
              {title}
            </h2>
          </div>
        </div>
        {detail ? (
          <span className="soft-tag max-w-full self-start whitespace-normal text-[0.66rem] leading-5">
            {detail}
          </span>
        ) : null}
      </button>
      {open && <div className="mt-5">{children}</div>}
    </section>
  );
}
