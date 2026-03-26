import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ styleCode: string }> },
) {
  const { styleCode } = await params;
  const res = await fetch(`${BACKEND_URL}/api/v1/catalog/products/${encodeURIComponent(styleCode)}`, {
    method: "DELETE",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
