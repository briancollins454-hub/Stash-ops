import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function POST(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API is not configured" }, { status: 503 });
  }

  const body = await request.json();
  const { jobIds, actor } = body as { jobIds?: string[]; actor?: string };

  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return NextResponse.json({ error: "jobIds array is required" }, { status: 400 });
  }

  try {
    const result = await fetchBackendJson("/api/v1/jobs/bulk-cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobIds, actor: actor || "stash-ui" }),
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
