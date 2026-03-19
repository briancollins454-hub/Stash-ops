import { NextResponse } from "next/server";
import { listApprovals } from "@/lib/data-repository";

export async function GET() {
  const data = await listApprovals();

  return NextResponse.json({
    data,
    count: data.length,
    generatedAt: new Date().toISOString(),
  });
}
