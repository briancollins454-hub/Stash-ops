import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_API_URL ?? process.env.INTERNAL_BACKEND_API_URL ?? "";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  if (!BACKEND) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
  }

  const res = await fetch(`${BACKEND}/api/v1/quote-detail/${encodeURIComponent(jobId)}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
