export type SourceGroupType = "tag" | "company" | "note" | "unassigned";

export type InferredSourceGroup = {
  key: string;
  label: string;
  type: SourceGroupType;
};

type SourceInferenceInput = {
  tags?: string[];
  note?: string | null;
  company?: string | null;
};

const GENERIC_TAGS = new Set([
  "shopify",
  "online",
  "order",
  "repeat",
  "new",
  "priority",
  "urgent",
  "custom",
]);

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLabel(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function pickTag(tags: string[]): string | null {
  const meaningful = tags
    .map((tag) => normalizeLabel(tag))
    .filter((tag) => tag.length > 1)
    .filter((tag) => !GENERIC_TAGS.has(tag.toLowerCase()));

  if (meaningful.length === 0) {
    return null;
  }

  const ranked =
    meaningful.find((tag) => /(school|club|academy|college|house|fc|rugby|hockey|netball)/i.test(tag)) ??
    meaningful[0];

  return ranked ?? null;
}

function extractGroupFromNote(note: string): string | null {
  const compact = normalizeLabel(note);
  if (!compact) {
    return null;
  }

  const explicit =
    compact.match(/(?:school|club|academy|college|house)\s+([a-z0-9 '&-]{3,60})/i)?.[0] ??
    compact.match(/([a-z0-9 '&-]{4,60})\s+(?:school|club|academy|college|house)/i)?.[0];

  if (!explicit) {
    return null;
  }

  return normalizeLabel(explicit);
}

export function inferSourceGroup(input: SourceInferenceInput): InferredSourceGroup {
  const tagMatch = pickTag(input.tags ?? []);
  if (tagMatch) {
    return {
      key: slugify(tagMatch),
      label: tagMatch,
      type: "tag",
    };
  }

  const company = normalizeLabel(input.company ?? "");
  if (company) {
    return {
      key: slugify(company),
      label: company,
      type: "company",
    };
  }

  const noteMatch = extractGroupFromNote(input.note ?? "");
  if (noteMatch) {
    return {
      key: slugify(noteMatch),
      label: noteMatch,
      type: "note",
    };
  }

  return {
    key: "unassigned",
    label: "Unassigned",
    type: "unassigned",
  };
}

