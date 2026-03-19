import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { ApprovalsBoard } from "@/components/modules/approvals-board";
import { CommunicationsWorkbench } from "@/components/modules/communications-workbench";
import { formatCount, shellCopy } from "@/lib/content";
import { listApprovals, listCommunicationSignals } from "@/lib/data-repository";

export const dynamic = "force-dynamic";

export default async function CommunicationsPage() {
  const [signals, approvals] = await Promise.all([
    listCommunicationSignals(),
    listApprovals(),
  ]);

  return (
    <AppShell title={shellCopy.communications.title}>
      <SectionCard
        kicker="Timeline"
        title="Linked messages"
        detail={formatCount(signals.length, "signal")}
      >
        <CommunicationsWorkbench items={signals} />
      </SectionCard>

      <SectionCard
        kicker="Proof gate"
        title="Approvals"
        detail={formatCount(approvals.length, "approval")}
      >
        <ApprovalsBoard approvals={approvals} />
      </SectionCard>
    </AppShell>
  );
}

