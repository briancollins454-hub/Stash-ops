"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { navigationItems } from "@/lib/navigation";

type AppShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AppShell({ title, description, children }: AppShellProps) {
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
                <p className="eyebrow text-white/55">Operating Layer</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  Stash
                </h1>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Premium interface over Deco, Shopify, and QuickBooks.
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {navigationItems.map((item, index) => {
                const active = pathname === item.href;

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

          <div className="mt-5 shrink-0 space-y-4">
            <div className="rail-metric-card p-4">
              <p className="eyebrow text-white/56">Live Ops</p>
              <div className="mt-4 space-y-4 text-sm text-white/82">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Approvals due</span>
                    <span className="rail-badge">04</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/12">
                    <div className="h-full w-3/4 rounded-full bg-[linear-gradient(90deg,#e3c96e,#f97366)]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>QBO mismatches</span>
                    <span className="rail-badge">01</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/12">
                    <div className="h-full w-1/4 rounded-full bg-[linear-gradient(90deg,#22d3c6,#76a7ff)]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Designer saves</span>
                    <span className="rail-badge">18</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/12">
                    <div className="h-full w-4/5 rounded-full bg-[linear-gradient(90deg,#22d3c6,#3b82f6)]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rail-glass-note p-4 text-sm leading-6 text-white/68">
              Customer and team experience stay in Stash. Deco remains an orchestration service.
            </div>
          </div>
        </aside>

        <main className="min-w-0 space-y-6 pb-10">
          <div className="panel flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2.5">
              <span className="glass-pill">
                <span className="soft-tag__dot" />
                Deco server-only
              </span>
              <span className="glass-pill">
                <span className="soft-tag__dot" />
                Shopify live sync
              </span>
              <span className="glass-pill">
                <span className="soft-tag__dot" />
                QBO source of truth
              </span>
            </div>
            <div className="flex flex-wrap gap-2.5 lg:justify-end">
              <span className="glass-pill">Realtime operations</span>
              <span className="glass-pill">Premium workspace</span>
            </div>
          </div>

          <header className="hero-command panel">
            <div className="grid gap-6 2xl:grid-cols-[1.16fr_0.84fr] 2xl:items-end">
              <div className="min-w-0 max-w-4xl">
                <p className="eyebrow">Internal Operating System</p>
                <h1 className="display-title mt-4">{title}</h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-white/72">
                  {description}
                </p>
              </div>
              <div className="hero-pulse-panel min-w-0 p-5">
                <p className="eyebrow text-white/58">Shop Pulse</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                  <div className="hero-pulse-row">
                    <p className="hero-pulse-label">Ops state</p>
                    <p className="hero-pulse-title">Deco server-only</p>
                    <p className="hero-pulse-detail">Experience stays inside Stash UI.</p>
                  </div>
                  <div className="hero-pulse-row">
                    <p className="hero-pulse-label">Accounting</p>
                    <p className="hero-pulse-title">QBO posting lane</p>
                    <p className="hero-pulse-detail">Controls and approvals stay upstream.</p>
                  </div>
                  <div className="hero-pulse-row">
                    <p className="hero-pulse-label">Commerce</p>
                    <p className="hero-pulse-title">Shopify stream</p>
                    <p className="hero-pulse-detail">Orders and fulfillment sync continuously.</p>
                  </div>
                </div>
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
