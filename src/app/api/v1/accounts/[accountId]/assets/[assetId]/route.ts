import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ accountId: string; assetId: string }> },
) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API is not configured" }, { status: 503 });
  }

  const { accountId, assetId } = await params;

  try {
    const result = await fetchBackendJson(
      `/api/v1/accounts/${encodeURIComponent(accountId)}/assets/${encodeURIComponent(assetId)}`,
      { method: "DELETE" },
    );
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
