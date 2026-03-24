import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

type RouteParams = { params: Promise<{ jobId: string }> };

/** POST /api/v1/jobs/[jobId]/action — proxy to various backend endpoints */
export async function POST(request: Request, context: RouteParams) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json({ error: "Backend API is not configured" }, { status: 503 });
  }

  const { jobId } = await context.params;
  const body = await request.json();
  const { action, ...payload } = body as { action: string; [key: string]: unknown };

  if (!action) {
    return NextResponse.json({ error: "Missing 'action' field" }, { status: 400 });
  }

  const id = encodeURIComponent(jobId);

  try {
    let result: unknown;

    switch (action) {
      case "transition":
        result = await fetchBackendJson(`/api/v1/jobs/${id}/transition`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            target: payload.target,
            actor: payload.actor || "stash-ui",
            force: payload.force ?? false,
          }),
        });
        break;

      case "substatus":
        result = await fetchBackendJson(`/api/v1/jobs/${id}/substatus`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...payload,
            actor: payload.actor || "stash-ui",
          }),
        });
        break;

      case "warehouse_receipt":
        result = await fetchBackendJson(`/api/v1/jobs/${id}/warehouse/receipt`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            receivedQuantity: payload.receivedQuantity,
            expectedQuantity: payload.expectedQuantity,
            location: payload.location || "Main",
            branch: payload.branch || "HQ",
            actor: payload.actor || "stash-ui",
            notes: payload.notes,
          }),
        });
        break;

      case "production_route":
        result = await fetchBackendJson(`/api/v1/jobs/${id}/production/route`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            department: payload.department,
            lane: payload.lane,
            actor: payload.actor || "stash-ui",
            notes: payload.notes,
          }),
        });
        break;

      case "stock_order":
        result = await fetchBackendJson(`/api/v1/jobs/${id}/stock/order`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            supplierName: payload.supplierName,
            supplierReference: payload.supplierReference,
            eta: payload.eta,
            notes: payload.notes,
            actor: payload.actor || "stash-ui",
          }),
        });
        break;

      case "review":
        result = await fetchBackendJson(`/api/v1/jobs/${id}/review`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accepted: payload.accepted,
            actor: payload.actor || "stash-ui",
            note: payload.note,
          }),
        });
        break;

      case "deco_push":
        result = await fetchBackendJson(`/api/v1/jobs/${id}/deco-push`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ actor: payload.actor || "stash-ui" }),
        });
        break;

      case "update_item":
        if (!payload.itemId) {
          return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
        }
        result = await fetchBackendJson(
          `/api/v1/jobs/${id}/items/${encodeURIComponent(String(payload.itemId))}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              decorationMethod: payload.decorationMethod,
              decorationPlacement: payload.decorationPlacement,
              designs: payload.designs,
              actor: payload.actor || "stash-ui",
            }),
          },
        );
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ...((result && typeof result === "object") ? result : {}) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
