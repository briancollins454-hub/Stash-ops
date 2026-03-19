export type SlackMessageSnapshot = {
  channelId: string;
  ts: string;
  text?: string;
  threadTs?: string;
  user?: string;
};

export type SlackPullResult = {
  messages: SlackMessageSnapshot[];
  latestTs?: string;
};

function getSlackConfig() {
  const botToken = process.env.SLACK_BOT_TOKEN?.trim();
  const channelIds = (process.env.SLACK_CHANNEL_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const maxPerChannel = Number(process.env.SLACK_SYNC_MAX_PER_CHANNEL ?? "50");

  if (!botToken || channelIds.length === 0) {
    return undefined;
  }

  return {
    botToken,
    channelIds,
    maxPerChannel: Number.isFinite(maxPerChannel)
      ? Math.max(1, Math.min(200, maxPerChannel))
      : 50,
  };
}

export function isSlackConnectorConfigured() {
  return Boolean(getSlackConfig());
}

function toSlackTsSeconds(iso?: string) {
  if (!iso) {
    return String(Math.floor((Date.now() - 1000 * 60 * 60) / 1000));
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return String(Math.floor((Date.now() - 1000 * 60 * 60) / 1000));
  }
  return String(Math.floor(parsed.getTime() / 1000));
}

function tsToIso(ts: string) {
  const seconds = Number(ts.split(".")[0] ?? ts);
  if (!Number.isFinite(seconds)) {
    return undefined;
  }
  return new Date(seconds * 1000).toISOString();
}

export async function pullSlackMessagesSince(sinceIso: string): Promise<SlackPullResult> {
  const config = getSlackConfig();
  if (!config) {
    return {
      messages: [],
    };
  }

  const oldest = toSlackTsSeconds(sinceIso);
  const messages: SlackMessageSnapshot[] = [];
  let latestTs: string | undefined;

  for (const channelId of config.channelIds) {
    const endpoint =
      `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channelId)}` +
      `&oldest=${encodeURIComponent(oldest)}&limit=${config.maxPerChannel}&inclusive=false`;

    const response = await fetch(endpoint, {
      headers: {
        authorization: `Bearer ${config.botToken}`,
      },
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`Slack sync failed (${response.status}): ${rawText.slice(0, 220)}`);
    }

    let jsonBody: unknown = undefined;
    try {
      jsonBody = rawText ? JSON.parse(rawText) : undefined;
    } catch {
      jsonBody = undefined;
    }

    const ok = Boolean((jsonBody as { ok?: boolean } | undefined)?.ok);
    if (!ok) {
      const errorCode = (jsonBody as { error?: string } | undefined)?.error ?? "unknown_error";
      throw new Error(`Slack sync failed: ${errorCode}`);
    }

    const channelMessages = (jsonBody as { messages?: unknown[] } | undefined)?.messages;
    if (!Array.isArray(channelMessages)) {
      continue;
    }

    for (const rawMessage of channelMessages) {
      if (typeof rawMessage !== "object" || rawMessage === null) {
        continue;
      }
      const message = rawMessage as Record<string, unknown>;
      if (typeof message.ts !== "string") {
        continue;
      }

      if (!latestTs || message.ts > latestTs) {
        latestTs = message.ts;
      }

      messages.push({
        channelId,
        ts: message.ts,
        text: typeof message.text === "string" ? message.text : undefined,
        threadTs: typeof message.thread_ts === "string" ? message.thread_ts : undefined,
        user: typeof message.user === "string" ? message.user : undefined,
      });
    }
  }

  return {
    messages,
    latestTs: latestTs ? tsToIso(latestTs) : undefined,
  };
}
