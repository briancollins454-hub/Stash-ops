import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ styleCode: string }> },
) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API not configured" }, { status: 503 });
  }

  const { styleCode } = await params;

  try {
    const payload = await fetchBackendJson(
      `/api/v1/catalog/products/${encodeURIComponent(styleCode)}`,
    );
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(null, { status: 404 });
  }
}
