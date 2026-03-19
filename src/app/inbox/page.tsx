import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { InboxList } from "@/components/modules/inbox-list";
import { formatCount, shellCopy } from "@/lib/content";
import { listInboxThreads } from "@/lib/data-repository";

export default async function InboxPage() {
  const inboxThreads = await listInboxThreads();

  return (
    <AppShell
      title={shellCopy.inbox.title}
      description={shellCopy.inbox.description}
    >
      <SectionCard
        kicker="Comms"
        title="Linked conversations"
        detail={formatCount(inboxThreads.length, "open conversation")}
      >
        <InboxList threads={inboxThreads} />
      </SectionCard>
    </AppShell>
  );
}
