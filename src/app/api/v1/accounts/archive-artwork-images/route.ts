import { NextResponse } from "next/server";
import { isBackendApiConfigured } from "@/lib/backend-api";

export const maxDuration = 300;

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

export async function POST() {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API is not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/accounts/archive-artwork-images`, {
      method: "POST",
      signal: AbortSignal.timeout(290_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
