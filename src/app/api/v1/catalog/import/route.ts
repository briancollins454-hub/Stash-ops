import { NextResponse } from "next/server";
import { isBackendApiConfigured } from "@/lib/backend-api";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

export const maxDuration = 120;

export async function POST(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API is not configured" }, { status: 503 });
  }

  const csvText = await request.text();

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/catalog/import`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: csvText,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
