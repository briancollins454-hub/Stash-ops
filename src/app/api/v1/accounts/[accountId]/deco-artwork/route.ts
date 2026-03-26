import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API is not configured" }, { status: 503 });
  }

  const { accountId } = await params;

  try {
    const result = await fetchBackendJson(
      `/api/v1/accounts/${encodeURIComponent(accountId)}/deco-artwork`,
      { timeoutMs: 60_000 },
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
