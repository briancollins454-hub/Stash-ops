"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductionWorkflowStage } from "@/server/core/order-types";

type OrderFlowActionsProps = {
  orderId: string;
  stage: ProductionWorkflowStage;
  decoOrderId?: string;
};

export function OrderFlowActions({
  orderId,
  stage,
  decoOrderId,
}: OrderFlowActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canComplete = stage === "dispatched";
  const isComplete = stage === "complete";

  async function markCompleteAndSync() {
    setMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/v1/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          actor: "ops.ui",
          productionStage: "complete",
          notes: "Completed in Stash UI and sent to Deco import queue.",
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        data?: {
          externalReferences?: {
            decoOrderId?: string;
          };
        };
      };

      if (!response.ok) {
        setMessage(data.error ?? "Unable to complete order.");
        setIsLoading(false);
        return;
      }

      await fetch("/api/sync/deco", {
        method: "POST",
      });

      const syncedId = data.data?.externalReferences?.decoOrderId;
      setMessage(
        syncedId
          ? `Completed and queued to Deco as ${syncedId}.`
          : "Completed and queued to Deco.",
      );

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setMessage("Network error while completing order.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      {canComplete ? (
        <button
          type="button"
          onClick={markCompleteAndSync}
          disabled={isLoading}
          className="btn btn--primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Syncing..." : "Mark Complete + Import to Deco"}
        </button>
      ) : null}

      {isComplete ? (
        <p className="text-xs" style={{ color: "var(--accent-light)" }}>
          Deco import linked: {decoOrderId ?? "queued"}
        </p>
      ) : (
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Auto Deco import is triggered when production reaches complete.
        </p>
      )}

      {message ? <p className="text-xs" style={{ color: "var(--accent-light)" }}>{message}</p> : null}
    </div>
  );
}
