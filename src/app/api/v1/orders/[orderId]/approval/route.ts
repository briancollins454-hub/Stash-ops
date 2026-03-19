import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

type RouteParams = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteParams) {
  const { orderId } = await context.params;

  if (!isBackendApiConfigured()) {
    return NextResponse.json(
      { error: "Backend API is not configured. Set BACKEND_API_URL." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    status?: string;
    actor?: string;
    notes?: string;
  };

  if (!body.status) {
    return NextResponse.json({ error: "status is required." }, { status: 400 });
  }

  try {
    const accepted = body.status === "approved";
    await fetchBackendJson(
      `/api/v1/jobs/${encodeURIComponent(orderId)}/review`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accepted,
          actor: body.actor ?? "ops.user",
          note: body.notes,
        }),
      },
    );

    const job = await fetchBackendJson<Record<string, unknown>>(
      `/api/v1/jobs/${encodeURIComponent(orderId)}`,
    );

    return NextResponse.json({ data: job, updated: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backend request failed." },
      { status: 502 },
    );
  }
}
