import { NextResponse } from "next/server";
import { projectDispatchBoard } from "@/server/queries/dispatch-queue";

export async function GET() {
  const data = await projectDispatchBoard();

  return NextResponse.json({
    data,
    counts: {
      unfulfilled: data.unfulfilled.length,
      fulfilled: data.fulfilled.length,
      total: data.unfulfilled.length + data.fulfilled.length,
    },
    generatedAt: new Date().toISOString(),
  });
}
