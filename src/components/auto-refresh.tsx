"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Silently refreshes server components on a fixed interval. */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
