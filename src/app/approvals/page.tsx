import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { ApprovalsBoard } from "@/components/modules/approvals-board";
import { formatCount, shellCopy } from "@/lib/content";
import { listApprovals } from "@/lib/data-repository";

export default async function ApprovalsPage() {
  const approvals = await listApprovals();

  return (
    <AppShell
      title={shellCopy.approvals.title}
      description={shellCopy.approvals.description}
    >
      <SectionCard
        kicker="Artwork"
        title="Approval states"
        detail={formatCount(approvals.length, "tracked proof")}
      >
        <ApprovalsBoard approvals={approvals} />
      </SectionCard>
    </AppShell>
  );
}
