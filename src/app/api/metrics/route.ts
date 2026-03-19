import { NextResponse } from "next/server";
import { listMetrics } from "@/lib/data-repository";

export async function GET() {
  const data = await listMetrics();

  return NextResponse.json({
    data,
    count: data.length,
    generatedAt: new Date().toISOString(),
  });
}
