import { AppShell } from "@/components/app-shell";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";
import { notFound } from "next/navigation";
import { AccountAssetsManager } from "./account-assets-manager";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface AccountDetail {
  id: string;
  key: string;
  name: string;
  type: string;
  active: boolean;
  decoCustomerId: string | null;
  defaultDecorationMethod: string | null;
  notes: string | null;
  aliases: { id: string; aliasRaw: string; source: string }[];
  assets: AccountAsset[];
  placementConfigs: {
    id: string;
    label: string;
    placementKey: string;
    decorationMethod: string | null;
    widthMm: number | null;
    heightMm: number | null;
  }[];
}

export interface AccountAsset {
  id: string;
  accountId: string;
  assetType: "LOGO" | "TEMPLATE" | "DESIGN_REFERENCE" | "PROOF";
  assetStatus: string;
  label: string;
  decoDesignId: string | null;
  decoTemplateId: string | null;
  fileUrl: string | null;
  colorway: string | null;
  decorationMethod: string | null;
  isDefault: boolean;
  priority: number;
  active: boolean;
  createdAt: string;
}

async function getAccount(accountId: string): Promise<AccountDetail | null> {
  if (!isBackendApiConfigured()) return null;
  try {
    const res = await fetchBackendJson<{ data: AccountDetail }>(
      `/api/v1/accounts/${encodeURIComponent(accountId)}`,
    );
    return res.data;
  } catch {
    return null;
  }
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const account = await getAccount(accountId);

  if (!account) return notFound();

  const typeColors: Record<string, { bg: string; text: string; border: string }> = {
    SCHOOL: { bg: "rgba(59,130,246,0.12)", text: "#93c5fd", border: "rgba(59,130,246,0.3)" },
    CLUB: { bg: "rgba(168,85,247,0.12)", text: "#c4b5fd", border: "rgba(168,85,247,0.3)" },
    CLIENT: { bg: "rgba(16,185,129,0.12)", text: "#6ee7b7", border: "rgba(16,185,129,0.3)" },
    OTHER: { bg: "rgba(156,163,175,0.12)", text: "#d1d5db", border: "rgba(156,163,175,0.3)" },
  };
  const tc = typeColors[account.type] ?? typeColors.OTHER;

  return (
    <AppShell title={account.name}>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
        <Link href="/accounts" className="hover:underline" style={{ color: "var(--text-secondary)" }}>
          Accounts
        </Link>
        <span>/</span>
        <span style={{ color: "var(--text-primary)" }}>{account.name}</span>
      </div>

      {/* Header card */}
      <div className="card mb-6 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {account.name}
              </h2>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}
              >
                {account.type}
              </span>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              Key: {account.key}
              {account.decoCustomerId && <> · Deco ID: {account.decoCustomerId}</>}
              {account.defaultDecorationMethod && <> · Default: {account.defaultDecorationMethod}</>}
            </p>
          </div>
        </div>

        {/* Aliases */}
        {account.aliases.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {account.aliases.map((a) => (
              <span
                key={a.id}
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "var(--text-secondary)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {a.aliasRaw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Placement Configs */}
      {account.placementConfigs.length > 0 && (
        <div className="card mb-6 p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Placement configs
          </h3>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
            {account.placementConfigs.map((pc) => (
              <div
                key={pc.id}
                className="rounded-lg p-3"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{pc.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                  {pc.placementKey}
                  {pc.widthMm && pc.heightMm && <> · {pc.widthMm}×{pc.heightMm}mm</>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assets / Badges / Logos — client component for interactivity */}
      <AccountAssetsManager
        accountId={account.id}
        accountName={account.name}
        initialAssets={account.assets}
      />
    </AppShell>
  );
}
