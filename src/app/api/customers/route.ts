import { NextResponse } from "next/server";
import { listCustomers } from "@/lib/data-repository";

export async function GET() {
  const data = await listCustomers();

  return NextResponse.json({
    data,
    count: data.length,
    generatedAt: new Date().toISOString(),
  });
}
