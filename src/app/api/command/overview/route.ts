import { NextResponse } from "next/server";
import { getCommandCenterData } from "@/lib/data-repository";

export async function GET() {
  const data = await getCommandCenterData();

  return NextResponse.json({
    data,
    generatedAt: new Date().toISOString(),
  });
}
