import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json();
  console.warn("[webhooks/slack] Received Slack webhook — ingestion not yet wired to backend.", payload);

  return NextResponse.json({
    accepted: true,
    note: "Slack webhooks should be configured to hit the Fastify backend directly.",
  });
}
