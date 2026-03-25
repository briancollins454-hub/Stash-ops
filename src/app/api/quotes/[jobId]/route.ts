import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API is not configured." }, { status: 503 });
  }

  const { jobId } = await params;

  try {
    const body = await request.json();
    const result = await fetchBackendJson<{ ok: boolean; jobId: string; internalJobId: string }>(
      `/api/v1/quotes/${encodeURIComponent(jobId)}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update quote." },
      { status: 502 },
    );
  }
}
