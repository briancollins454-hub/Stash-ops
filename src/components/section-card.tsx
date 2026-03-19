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
    <section className="panel section-panel p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 sm:pr-12">
          {kicker ? <p className="eyebrow">{kicker}</p> : null}
          <h2 className="mt-2 break-words pb-[0.08em] text-2xl font-semibold leading-[1.16] tracking-tight text-white">
            {title}
          </h2>
        </div>
        {detail ? (
          <span className="soft-tag max-w-full self-start whitespace-normal text-[0.66rem] leading-5">
            {detail}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}
