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
    const job = await fetchBackendJson<Record<string, unknown>>(
      `/api/v1/jobs/${encodeURIComponent(orderId)}`,
    );
    return NextResponse.json({ data: job });
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

export async function PATCH(request: Request, context: RouteParams) {
  const { orderId } = await context.params;

  if (!isBackendApiConfigured()) {
    return NextResponse.json(
      { error: "Backend API is not configured. Set BACKEND_API_URL." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    actor?: string;
    notes?: string;
    target?: string;
    force?: boolean;
    classificationStatus?: string;
    configurationStatus?: string;
    stockStatusBackend?: string;
    productionStatus?: string;
    approvalStatusBackend?: string;
    assignedDepartmentBackend?: string;
    productionStage?: string;
  };

  const actor = body.actor ?? "ops.user";

  try {
    // Lifecycle transition
    if (body.target || body.productionStage) {
      const target = body.target ?? body.productionStage;
      const result = await fetchBackendJson<{ ok: boolean; reasons?: string[] }>(
        `/api/v1/jobs/${encodeURIComponent(orderId)}/transition`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ target, actor, force: body.force }),
        },
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.reasons?.join(", ") ?? "Transition failed." }, { status: 422 });
      }
    }

    // Sub-status updates
    const subUpdates: Record<string, string> = {};
    if (body.approvalStatusBackend) subUpdates.approvalStatus = body.approvalStatusBackend;
    if (body.stockStatusBackend) subUpdates.stockStatus = body.stockStatusBackend;
    if (body.productionStatus) subUpdates.productionStatus = body.productionStatus;
    if (body.classificationStatus) subUpdates.classificationStatus = body.classificationStatus;
    if (body.configurationStatus) subUpdates.configurationStatus = body.configurationStatus;
    if (body.assignedDepartmentBackend) subUpdates.assignedDepartment = body.assignedDepartmentBackend;

    if (Object.keys(subUpdates).length > 0) {
      await fetchBackendJson(
        `/api/v1/jobs/${encodeURIComponent(orderId)}/substatus`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...subUpdates, actor }),
        },
      );
    }

    // Fetch updated job
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
