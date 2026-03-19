import { CommunicationChannel, CommunicationDirection, type Prisma } from "@prisma/client";

export type CommunicationEventInput = {
  channel: "gmail" | "slack" | "internal";
  direction: "inbound" | "outbound" | "internal";
  subject: string;
  bodyPreview?: string;
  externalMessageId?: string;
  actor: string;
};

const channelMap: Record<string, CommunicationChannel> = {
  gmail: CommunicationChannel.GMAIL,
  slack: CommunicationChannel.SLACK,
  internal: CommunicationChannel.INTERNAL_NOTE,
};

const directionMap: Record<string, CommunicationDirection> = {
  inbound: CommunicationDirection.INBOUND,
  outbound: CommunicationDirection.OUTBOUND,
  internal: CommunicationDirection.INTERNAL,
};

export async function appendCommunicationEvent(
  tx: Prisma.TransactionClient,
  jobId: string,
  input: CommunicationEventInput,
): Promise<void> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: { id: true },
  });

  if (!job) {
    throw new Error("Job not found.");
  }

  await tx.communication.create({
    data: {
      jobId,
      channel: channelMap[input.channel] ?? CommunicationChannel.INTERNAL_NOTE,
      direction: directionMap[input.direction] ?? CommunicationDirection.INTERNAL,
      subject: input.subject,
      bodyPreview: input.bodyPreview ?? null,
      providerMessageId: input.externalMessageId ?? null,
      sentBy: input.actor,
      sentAt: new Date(),
    },
  });

  await tx.activityLog.create({
    data: {
      jobId,
      eventType: "communication.logged",
      message: `${input.channel.toUpperCase()} ${input.direction} communication recorded.`,
      payload: {
        channel: input.channel,
        direction: input.direction,
        subject: input.subject,
        actor: input.actor,
      },
    },
  });
}

