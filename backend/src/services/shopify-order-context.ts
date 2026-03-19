import type { ShopifyOrderPayload } from "./order-service";

type TokenSource =
  | "tag"
  | "note"
  | "note_attribute"
  | "metafield"
  | "line_property"
  | "company"
  | "customer"
  | "shipping"
  | "billing";

export type ShopifyOrderContext = {
  candidateTokens: string[];
  tokenSources: Record<string, TokenSource[]>;
  tags: string[];
  combinedText: string;
  schoolName?: string;
  clubName?: string;
  leaversYear?: string;
  customIdentifiers: string[];
  normalizedMetafields: Record<string, string>;
  normalizedNoteAttributes: Record<string, string>;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeMatchToken(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function maybeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = normalizeWhitespace(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

type MutableTokenState = {
  candidateTokens: Set<string>;
  tokenSources: Map<string, Set<TokenSource>>;
  customIdentifiers: Set<string>;
  textFragments: string[];
};

function addToken(state: MutableTokenState, rawValue: string | undefined, source: TokenSource): void {
  if (!rawValue) {
    return;
  }
  const normalized = normalizeMatchToken(rawValue);
  if (!normalized || normalized.length < 3) {
    return;
  }

  state.candidateTokens.add(normalized);
  const existing = state.tokenSources.get(normalized);
  if (existing) {
    existing.add(source);
  } else {
    state.tokenSources.set(normalized, new Set([source]));
  }
}

function addText(state: MutableTokenState, rawValue: string | undefined): void {
  if (!rawValue) {
    return;
  }
  state.textFragments.push(rawValue);
}

function parseTags(rawTags?: string): string[] {
  if (!rawTags) {
    return [];
  }
  return rawTags
    .split(",")
    .map((tag) => normalizeWhitespace(tag))
    .filter((tag) => tag.length > 0);
}

function detectNamedValue(input: Record<string, string>, matcher: RegExp): string | undefined {
  for (const [key, value] of Object.entries(input)) {
    if (matcher.test(key) && value) {
      return value;
    }
  }
  return undefined;
}

function detectLeaversYear(input: Record<string, string>): string | undefined {
  for (const value of Object.values(input)) {
    const year = value.match(/\b(20[2-4][0-9])\b/)?.[1];
    if (year) {
      return year;
    }
  }
  return undefined;
}

function normalizeMapKeys(entries: Array<{ key?: string | null; value?: string | null }>): Record<string, string> {
  const map: Record<string, string> = {};

  for (const entry of entries) {
    const key = maybeString(entry.key);
    const value = maybeString(entry.value);
    if (!key || !value) {
      continue;
    }
    map[key.toLowerCase()] = value;
  }

  return map;
}

export function extractShopifyOrderContext(payload: ShopifyOrderPayload): ShopifyOrderContext {
  const state: MutableTokenState = {
    candidateTokens: new Set<string>(),
    tokenSources: new Map<string, Set<TokenSource>>(),
    customIdentifiers: new Set<string>(),
    textFragments: [],
  };

  const tags = parseTags(payload.tags);
  for (const tag of tags) {
    addToken(state, tag, "tag");
    addText(state, tag);
  }

  const orderNote = maybeString(payload.note);
  if (orderNote) {
    addToken(state, orderNote, "note");
    addText(state, orderNote);
  }

  const companyValues = [
    payload.shipping_address?.company,
    payload.billing_address?.company,
    payload.customer?.default_address?.company,
  ]
    .map((value) => maybeString(value))
    .filter((value): value is string => Boolean(value));

  for (const company of companyValues) {
    addToken(state, company, "company");
    addText(state, company);
  }

  addText(state, maybeString(payload.customer?.first_name ?? undefined));
  addText(state, maybeString(payload.customer?.last_name ?? undefined));
  addText(state, maybeString(payload.shipping_address?.name ?? undefined));
  addText(state, maybeString(payload.billing_address?.name ?? undefined));

  const noteAttributes = normalizeMapKeys(payload.note_attributes ?? []);
  for (const [key, value] of Object.entries(noteAttributes)) {
    addToken(state, key, "note_attribute");
    addToken(state, value, "note_attribute");
    addText(state, `${key} ${value}`);

    if (key.match(/school|club|house|leavers|cohort|client|identifier|code/i)) {
      state.customIdentifiers.add(value);
    }
  }

  const metafields = normalizeMapKeys(
    (payload.metafields ?? []).map((entry) => ({
      key: `${entry.namespace ?? ""}.${entry.key ?? ""}`.replace(/^\./, ""),
      value: maybeString(entry.value),
    })),
  );

  for (const [key, value] of Object.entries(metafields)) {
    addToken(state, key, "metafield");
    addToken(state, value, "metafield");
    addText(state, `${key} ${value}`);

    if (key.match(/school|club|house|leavers|cohort|client|identifier|code/i)) {
      state.customIdentifiers.add(value);
    }
  }

  for (const line of payload.line_items ?? []) {
    addToken(state, maybeString(line.sku ?? undefined), "line_property");
    addToken(state, maybeString(line.title ?? line.name ?? undefined), "line_property");
    addText(state, maybeString(line.title ?? line.name ?? undefined));

    for (const property of line.properties ?? []) {
      const propName = maybeString(property.name ?? undefined);
      const propValue = maybeString(property.value ?? undefined);
      addToken(state, propName, "line_property");
      addToken(state, propValue, "line_property");
      addText(state, `${propName ?? ""} ${propValue ?? ""}`.trim());

      if ((propName ?? "").match(/school|club|house|leavers|cohort|client|identifier|code/i) && propValue) {
        state.customIdentifiers.add(propValue);
      }
    }
  }

  const schoolName =
    detectNamedValue(metafields, /school|academy|college|campus/i) ??
    detectNamedValue(noteAttributes, /school|academy|college|campus/i);
  const clubName =
    detectNamedValue(metafields, /club|team|society|house/i) ??
    detectNamedValue(noteAttributes, /club|team|society|house/i);
  const leaversYear = detectLeaversYear(metafields) ?? detectLeaversYear(noteAttributes);

  if (schoolName) {
    addToken(state, schoolName, "metafield");
    addText(state, schoolName);
  }
  if (clubName) {
    addToken(state, clubName, "metafield");
    addText(state, clubName);
  }
  if (leaversYear) {
    state.customIdentifiers.add(leaversYear);
  }

  const tokenSources: Record<string, TokenSource[]> = {};
  for (const token of state.candidateTokens) {
    tokenSources[token] = Array.from(state.tokenSources.get(token) ?? []);
  }

  return {
    candidateTokens: Array.from(state.candidateTokens),
    tokenSources,
    tags,
    combinedText: state.textFragments.join(" | ").toLowerCase(),
    schoolName,
    clubName,
    leaversYear,
    customIdentifiers: Array.from(state.customIdentifiers),
    normalizedMetafields: metafields,
    normalizedNoteAttributes: noteAttributes,
  };
}

