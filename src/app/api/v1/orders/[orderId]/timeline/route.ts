import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

type RouteParams = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function GET(_request: Request, context: RouteParams) {
  const { orderId } = await context.params;

  if (!isBackendApiConfigured()) {
    return NextResponse.json(
      { error: "Backend API is not configured. Set BACKEND_API_URL." },
      { status: 503 },
    );
  }

  try {
    const payload = await fetchBackendJson<{
      total: number;
      entries: { id: string; eventType: string; message: string; payload?: unknown; createdAt: string }[];
    }>(`/api/v1/jobs/${encodeURIComponent(orderId)}/activity?limit=100`);

    return NextResponse.json({
      data: {
        activity: payload.entries.map((e) => ({
          activityId: e.id,
          message: e.message,
          actor: (e.payload as Record<string, unknown>)?.actor ?? "system",
          createdAt: e.createdAt,
        })),
        communication: [],
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backend request failed." },
      { status: 502 },
    );
  }
}
