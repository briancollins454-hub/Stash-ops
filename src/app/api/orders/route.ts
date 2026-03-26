import { NextResponse } from "next/server";
import { listOrders } from "@/lib/data-repository";

export async function GET() {
  const { orders: data } = await listOrders();

  return NextResponse.json({
    data,
    count: data.length,
    generatedAt: new Date().toISOString(),
  });
}
