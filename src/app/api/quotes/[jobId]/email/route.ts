import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_API_URL ?? process.env.INTERNAL_BACKEND_API_URL ?? "";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  if (!BACKEND) {
    return NextResponse.json({ ok: false, error: "Backend not configured" }, { status: 500 });
  }

  const res = await fetch(`${BACKEND}/api/v1/quotes/${encodeURIComponent(jobId)}/email`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.ok ? 200 : 500 });
}
