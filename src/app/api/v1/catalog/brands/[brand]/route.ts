import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ brand: string }> },
) {
  const { brand } = await params;
  const res = await fetch(`${BACKEND_URL}/api/v1/catalog/brands/${encodeURIComponent(brand)}`, {
    method: "DELETE",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
