import { NextResponse } from "next/server";
import { listIntegrations } from "@/lib/data-repository";

export async function GET() {
  const data = await listIntegrations();

  return NextResponse.json({
    data,
    count: data.length,
    generatedAt: new Date().toISOString(),
  });
}
