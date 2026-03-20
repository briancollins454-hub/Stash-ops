import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const decoCustomerId = searchParams.get("decoCustomerId") ?? "";

  try {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (decoCustomerId) params.set("decoCustomerId", decoCustomerId);
    params.set("limit", "30");

    const payload = await fetchBackendJson<{ total: number; items: unknown[] }>(
      `/api/v1/quotes/customers?${params.toString()}`,
    );
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch customers." },
      { status: 502 },
    );
  }
}
