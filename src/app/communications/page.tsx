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
    <AppShell
      title={shellCopy.communications.title}
      description={shellCopy.communications.description}
    >
      <SectionCard
        kicker="Unified timeline"
        title="Gmail and Slack linked events"
        detail={formatCount(signals.length, "communication signal")}
      >
        <CommunicationsWorkbench items={signals} />
      </SectionCard>

      <SectionCard
        kicker="Proof gate"
        title="Approval communication workload"
        detail={formatCount(approvals.length, "approval item")}
      >
        <ApprovalsBoard approvals={approvals} />
      </SectionCard>
    </AppShell>
  );
}

