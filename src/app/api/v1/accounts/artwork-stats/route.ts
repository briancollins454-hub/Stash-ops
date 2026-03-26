import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://localhost:4000";

export async function GET() {
  const res = await fetch(`${BACKEND_URL}/api/v1/accounts/artwork-stats`, {
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
