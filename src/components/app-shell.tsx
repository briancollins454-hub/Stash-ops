"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { navigationGroups, navigationItems } from "@/lib/navigation";

type AppShellProps = {
  title: string;
  children: ReactNode;
};

/* Inline SVG icons — tiny, no dependency */
const icons: Record<string, ReactNode> = {
  grid: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  layers: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" />
    </svg>
  ),
  "file-text": (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 13H8" /><path d="M16 17H8" /><path d="M16 13h-2" />
    </svg>
  ),
  users: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  palette: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z" />
    </svg>
  ),
  pen: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
  ),
  package: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16.5 9.4-9-5.19" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  warehouse: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" /><path d="M6 18h12" /><path d="M6 14h12" /><path d="M6 10h12" />
    </svg>
  ),
  zap: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  stack: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" />
    </svg>
  ),
  mail: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  "credit-card": (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" />
    </svg>
  ),
  settings: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  menu: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  ),
  close: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  ),
};

export function AppShell({ title, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isRoot = pathname === "/";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isActive = (href: string) => {
    const exactOrChild = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    const claimedByChild = exactOrChild && navigationItems.some(
      (other) => other.href !== href && other.href.startsWith(`${href}/`) && (pathname === other.href || pathname.startsWith(`${other.href}/`))
    );
    return exactOrChild && !claimedByChild;
  };

  const navContent = (
    <>
      {/* Brand */}
      <div className="mb-5 flex items-center gap-3 px-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-bold text-white shadow-[0_4px_16px_rgba(99,102,241,0.25)]">
          S
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Stash
          </h1>
          <span className="text-[9px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--text-tertiary)" }}>
            Operations
          </span>
        </div>
      </div>

      {/* Grouped Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-5">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-tertiary)", opacity: 0.7 }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`nav-item ${active ? "nav-item--active" : ""}`}
                  >
                    {icons[item.icon]}
                    <div className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-tight">{item.label}</span>
                      <span className="block text-[10px] leading-tight mt-0.5" style={{ color: active ? "var(--accent-light)" : "var(--text-tertiary)", opacity: active ? 0.8 : 0.6 }}>
                        {item.caption}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-3">
        <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            Marx Corporate
          </p>
          <p className="mt-0.5 text-[9px]" style={{ color: "var(--text-tertiary)", opacity: 0.5 }}>
            Stash Ops v1.0
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div className="shell-stage min-h-screen">
      {/* Mobile nav toggle */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 xl:hidden" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white">S</div>
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Stash Ops</span>
        </div>
        <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="rounded-lg p-2 transition-colors" style={{ color: "var(--text-secondary)" }}>
          {mobileNavOpen ? icons.close : icons.menu}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-30 xl:hidden" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)" }} />
          <aside
            className="absolute top-0 left-0 bottom-0 w-72 flex flex-col p-4 pt-16 overflow-y-auto"
            style={{ background: "var(--bg-raised)", borderRight: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {navContent}
          </aside>
        </div>
      )}

      <div className="mx-auto grid min-h-screen max-w-[1780px] gap-5 px-4 pt-16 pb-6 xl:grid-cols-[240px_minmax(0,1fr)] xl:px-6 xl:py-5 xl:pt-5">
        {/* Desktop Sidebar */}
        <aside className="nav-rail relative hidden flex-col overflow-hidden p-4 xl:flex xl:min-h-[calc(100vh-2.5rem)] xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)]">
          <div className="relative flex min-h-0 flex-1 flex-col">
            {navContent}
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 pb-10">
          {/* Page header */}
          <header className="mb-6 flex items-center gap-4 px-1 pt-1">
            {!isRoot && (
              <button
                onClick={() => router.back()}
                className="group flex h-8 w-8 items-center justify-center rounded-xl transition-all hover:bg-[var(--bg-surface)]"
              >
                <svg
                  className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="page-title">{title}</h1>
          </header>

          <div className="space-y-5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
