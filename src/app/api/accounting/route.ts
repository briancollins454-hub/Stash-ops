import { NextResponse } from "next/server";
import { listAccountingRecords } from "@/lib/data-repository";

export async function GET() {
  const data = await listAccountingRecords();

  return NextResponse.json({
    data,
    count: data.length,
    generatedAt: new Date().toISOString(),
  });
}
