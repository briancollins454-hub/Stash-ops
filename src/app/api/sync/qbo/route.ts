import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    accepted: true,
    status: "acknowledged",
    note: "QBO sync is managed by the Fastify backend worker.",
    generatedAt: new Date().toISOString(),
  });
}
