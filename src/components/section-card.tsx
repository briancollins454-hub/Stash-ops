import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  kicker?: string;
  detail?: string;
  children: ReactNode;
};

export function SectionCard({
  title,
  kicker,
  detail,
  children,
}: SectionCardProps) {
  return (
    <section className="surface p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          {kicker ? <p className="eyebrow mb-1.5">{kicker}</p> : null}
          <h2 className="break-words text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
        </div>
        {detail ? (
          <span className="pill pill--ghost shrink-0">
            {detail}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}
