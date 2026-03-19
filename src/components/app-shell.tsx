"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { navigationItems } from "@/lib/navigation";

type AppShellProps = {
  title: string;
  children: ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="shell-stage min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1780px] gap-5 px-4 py-4 xl:grid-cols-[280px_minmax(0,1fr)] xl:px-6 xl:py-6 2xl:grid-cols-[308px_minmax(0,1fr)]">
        <aside className="rail-panel relative flex flex-col overflow-hidden p-5 xl:min-h-[calc(100vh-2rem)] xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)]">
          <div className="pointer-events-none absolute -left-16 -top-16 h-60 w-60 rounded-full bg-[#c9a84c]/18 blur-[72px]" />
          <div className="pointer-events-none absolute -bottom-20 right-[-28px] h-64 w-64 rounded-full bg-[#0ea5a0]/15 blur-[78px]" />

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="mb-7 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] border border-white/18 bg-[linear-gradient(140deg,#f2dab0,#caa74f)] text-lg font-semibold text-[#1a1f2c] shadow-[0_22px_44px_rgba(201,168,76,0.34)]">
                ST
              </div>
              <div className="max-w-[13rem]">
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  Stash
                </h1>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {navigationItems.map((item, index) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rail-link ${
                      active
                        ? "rail-link--active"
                        : "text-white/86 hover:border-white/18 hover:bg-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 font-mono text-[11px] tracking-[0.2em] text-white/46">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <span className="block text-[15px] font-medium text-white/95">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-white/60">
                          {item.caption}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

        </aside>

        <main className="min-w-0 space-y-6 pb-10">
          <header className="hero-command panel">
            <div className="min-w-0 max-w-4xl">
              <h1 className="display-title">{title}</h1>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
