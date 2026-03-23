import { projectDispatchBoard } from "@/server/queries/dispatch-queue";
import { DispatchQueue } from "@/components/modules/dispatch-queue";

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const { unfulfilled, fulfilled } = await projectDispatchBoard();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Dispatch
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Print labels, fulfill on Shopify, and track shipments.
        </p>
      </header>

      <DispatchQueue unfulfilledOrders={unfulfilled} fulfilledOrders={fulfilled} />
    </div>
  );
}
