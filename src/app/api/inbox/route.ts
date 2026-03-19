import { NextResponse } from "next/server";
import { listInboxThreads } from "@/lib/data-repository";

export async function GET() {
  const data = await listInboxThreads();

  return NextResponse.json({
    data,
    count: data.length,
    generatedAt: new Date().toISOString(),
  });
}
