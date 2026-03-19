import { NextResponse } from "next/server";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";

export async function GET(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json(
      { error: "Backend API is not configured. Set BACKEND_API_URL." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const lane = searchParams.get("lane") ?? "all";
  const limit = searchParams.get("limit") ?? "300";

  try {
    const payload = await fetchBackendJson<{
      lane: "active" | "fulfilled" | "all";
      total: number;
      items: unknown[];
      groupedBySource: unknown[];
    }>(`/api/v1/orders?lane=${encodeURIComponent(lane)}&limit=${encodeURIComponent(limit)}`);

    return NextResponse.json({
      data: payload.items,
      count: payload.total,
      lane: payload.lane,
      groupedBySource: payload.groupedBySource,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load jobs from backend API.",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  if (!isBackendApiConfigured()) {
    return NextResponse.json(
      { error: "Backend API is not configured. Set BACKEND_API_URL." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as {
    customer?: { name: string; email?: string; company?: string };
    lineItems?: {
      sku: string;
      productTitle: string;
      decorationPlacement?: string;
      quantity: number;
      decorationMethod: string;
      unitPrice?: number;
    }[];
    billingAddress?: unknown;
    shippingAddress?: unknown;
  };

  if (!body.customer || !body.lineItems?.length) {
    return NextResponse.json(
      {
        error:
          "Invalid payload. customer and lineItems are required.",
      },
      { status: 400 },
    );
  }

  try {
    const manualPayload = {
      customerName: body.customer.name,
      customerEmail: body.customer.email,
      sourceGroupLabel: body.customer.company,
      lineItems: body.lineItems.map((lineItem) => ({
        sku: lineItem.sku,
        productTitle: lineItem.productTitle,
        variantTitle: lineItem.decorationPlacement,
        quantity: lineItem.quantity,
        decorationMethod: lineItem.decorationMethod,
        requiresArtwork:
          lineItem.decorationMethod !== "other" &&
          lineItem.decorationMethod !== "screen_print",
        unitPriceMinor:
          lineItem.unitPrice !== undefined && Number.isFinite(lineItem.unitPrice) ? Math.round(lineItem.unitPrice * 100) : undefined,
      })),
    };

    const created = await fetchBackendJson<{
      ok: boolean;
      jobId: string;
      internalJobId: string;
    }>("/api/v1/orders/manual", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(manualPayload),
    });

    return NextResponse.json(
      {
        data: {
          internalJobId: created.internalJobId,
          jobId: created.jobId,
        },
        created: true,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create job in backend API.",
      },
      { status: 502 },
    );
  }
}
