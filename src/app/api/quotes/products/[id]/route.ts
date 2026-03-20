import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API is not configured." }, { status: 503 });
  }

  const { id } = await params;

  try {
    const payload = await fetchBackendJson(
      `/api/v1/quotes/products/${encodeURIComponent(id)}/detail`,
    );
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch product detail." },
      { status: 502 },
    );
  }
}
