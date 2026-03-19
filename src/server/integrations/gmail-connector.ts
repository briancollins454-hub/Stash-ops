export type GmailMessageSnapshot = {
  messageId: string;
  threadId?: string;
  subject?: string;
  snippet?: string;
  internalDate?: string;
};

export type GmailPullResult = {
  messages: GmailMessageSnapshot[];
  latestInternalDate?: string;
};

function getGmailConfig() {
  const accessToken = process.env.GMAIL_ACCESS_TOKEN?.trim();
  const userId = process.env.GMAIL_USER_ID?.trim() || "me";
  const maxResults = Number(process.env.GMAIL_SYNC_MAX_RESULTS ?? "40");

  if (!accessToken) {
    return undefined;
  }

  return {
    accessToken,
    userId,
    maxResults: Number.isFinite(maxResults) ? Math.max(1, Math.min(200, maxResults)) : 40,
  };
}

function subjectFromHeaders(headers: Array<{ name?: string; value?: string }> | undefined) {
  if (!headers) {
    return undefined;
  }
  const found = headers.find((header) => header.name?.toLowerCase() === "subject");
  return found?.value;
}

export function isGmailConnectorConfigured() {
  return Boolean(getGmailConfig());
}

export async function pullGmailMessagesSince(sinceIso: string): Promise<GmailPullResult> {
  const config = getGmailConfig();
  if (!config) {
    return {
      messages: [],
    };
  }

  const sinceDate = new Date(sinceIso);
  const sinceSeconds = Number.isNaN(sinceDate.getTime())
    ? Math.floor((Date.now() - 1000 * 60 * 60) / 1000)
    : Math.floor(sinceDate.getTime() / 1000);
  const query = `after:${sinceSeconds}`;
  const encodedUser = encodeURIComponent(config.userId);

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${encodedUser}/messages?maxResults=${config.maxResults}&q=${encodeURIComponent(query)}`,
    {
      headers: {
        authorization: `Bearer ${config.accessToken}`,
      },
    },
  );

  const listRaw = await listResponse.text();
  if (!listResponse.ok) {
    throw new Error(`Gmail sync failed (${listResponse.status}): ${listRaw.slice(0, 240)}`);
  }

  let listJson: unknown = undefined;
  try {
    listJson = listRaw ? JSON.parse(listRaw) : undefined;
  } catch {
    listJson = undefined;
  }

  const messageRefs = (listJson as { messages?: Array<{ id?: string; threadId?: string }> } | undefined)
    ?.messages;
  const ids = Array.isArray(messageRefs) ? messageRefs : [];

  let latestInternalDate: string | undefined;
  const messages: GmailMessageSnapshot[] = [];

  for (const reference of ids) {
    if (!reference?.id) {
      continue;
    }

    const detailResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${encodedUser}/messages/${encodeURIComponent(reference.id)}?format=metadata&metadataHeaders=Subject`,
      {
        headers: {
          authorization: `Bearer ${config.accessToken}`,
        },
      },
    );

    const detailRaw = await detailResponse.text();
    if (!detailResponse.ok) {
      continue;
    }

    let detailJson: unknown = undefined;
    try {
      detailJson = detailRaw ? JSON.parse(detailRaw) : undefined;
    } catch {
      detailJson = undefined;
    }

    const detail = detailJson as {
      id?: string;
      threadId?: string;
      snippet?: string;
      internalDate?: string;
      payload?: {
        headers?: Array<{ name?: string; value?: string }>;
      };
    };

    const internalDate =
      typeof detail.internalDate === "string" && /^\d+$/.test(detail.internalDate)
        ? new Date(Number(detail.internalDate)).toISOString()
        : undefined;

    if (internalDate && (!latestInternalDate || internalDate > latestInternalDate)) {
      latestInternalDate = internalDate;
    }

    messages.push({
      messageId: detail.id ?? reference.id,
      threadId: detail.threadId ?? reference.threadId,
      subject: subjectFromHeaders(detail.payload?.headers),
      snippet: detail.snippet,
      internalDate,
    });
  }

  return {
    messages,
    latestInternalDate,
  };
}
