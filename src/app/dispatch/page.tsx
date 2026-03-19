import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { DispatchQueue } from "@/components/modules/dispatch-queue";
import { listDispatchBoard } from "@/lib/data-repository";
import { formatCount, shellCopy } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const board = await listDispatchBoard();
  const ready = board.unfulfilled.filter((order) => order.readyToShip).length;

  return (
    <AppShell
      title={shellCopy.dispatch.title}
      description={shellCopy.dispatch.description}
    >
      <SectionCard
        kicker="Shopify lane"
        title="Fulfillment board"
        detail={`${formatCount(board.unfulfilled.length, "unfulfilled order")} · ${formatCount(
          board.fulfilled.length,
          "fulfilled order",
        )} · ${formatCount(
          ready,
          "ready shipment",
        )}`}
      >
        <DispatchQueue
          unfulfilledOrders={board.unfulfilled}
          fulfilledOrders={board.fulfilled}
        />
      </SectionCard>
    </AppShell>
  );
}
