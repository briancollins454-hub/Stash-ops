import { NextResponse } from "next/server";
import { listProductionJobs } from "@/lib/data-repository";

export async function GET() {
  const data = await listProductionJobs();

  return NextResponse.json({
    data,
    count: data.length,
    generatedAt: new Date().toISOString(),
  });
}
