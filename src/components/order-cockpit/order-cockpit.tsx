import type { UnifiedOrderRecord } from "@/server/core/order-types";
import { OrderFlowActions } from "@/components/order-cockpit/order-flow-actions";

type OrderCockpitProps = {
  order: UnifiedOrderRecord;
};

function formatDate(value?: string) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleString();
}

function gateLabel(order: UnifiedOrderRecord) {
  if (order.designSetup.status !== "customer_approved" && order.designSetup.status !== "production_locked") {
    return "Complete design setup and prepare/send proof";
  }
  if (order.approval.status !== "approved" && order.approval.status !== "not_required") {
    return "Await customer approval";
  }
  if (order.purchasing.status !== "scanned_complete") {
    return "Receive and scan garments into stock";
  }
  if (order.production.stage !== "in_production" && order.production.stage !== "quality_check") {
    return "Route to production queue";
  }

  return "Continue production and dispatch sign-off";
}

export function OrderCockpit({ order }: OrderCockpitProps) {
  return (
    <div className="space-y-4">
      <section className="surface-raised p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="eyebrow">Unified order cockpit</p>
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {order.internalOrderId}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{order.customer.company ?? order.customer.name}</p>
            <div className="flex flex-wrap gap-2">
              <span className="pill pill--ghost">Origin: {order.origin}</span>
              <span className="pill pill--ghost">Design: {order.designSetup.status}</span>
              <span className="pill pill--ghost">Approval: {order.approval.status}</span>
              <span className="pill pill--ghost">Purchasing: {order.purchasing.status}</span>
              <span className="pill pill--ghost">Stock: {order.stock.status}</span>
              <span className="pill pill--ghost">Production: {order.production.stage}</span>
            </div>
          </div>
          <div className="card p-4 sm:p-5">
            <p className="eyebrow">Flow gate</p>
            <p className="mt-2 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{gateLabel(order)}</p>
            <div className="mt-3 border-t pt-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-tertiary)" }}>
              Due: {formatDate(order.dueAt)}
            </div>
            <div className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
              Blocked reason: {order.blockedReason ?? "No active blocker"}
            </div>
            <OrderFlowActions
              orderId={order.internalOrderId}
              stage={order.production.stage}
              decoOrderId={order.externalReferences.decoOrderId}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="surface p-5">
          <p className="eyebrow">Design setup</p>
          <div className="mt-4 space-y-2">
            <article className="card p-4">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{order.designSetup.productLabel}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                Studio: {order.designSetup.studioView.toUpperCase()} · Garment SKU:{" "}
                {order.designSetup.garmentSku ?? "N/A"}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                3D model: {order.designSetup.model3dUrl ? "Connected" : "Fallback to 2D preview"}
              </p>
              <p className="mt-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
                Last edit: {order.designSetup.lastEditedBy ?? "N/A"} ·{" "}
                {formatDate(order.designSetup.lastEditedAt)}
              </p>
            </article>

            {order.designSetup.placements.length > 0 ? (
              order.designSetup.placements.map((placement) => (
                <article key={placement.placementId} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{placement.location}</p>
                    <span className="pill pill--ghost">{placement.method}</span>
                  </div>
                  <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {placement.widthMm}x{placement.heightMm}mm · Offset {placement.offsetXMm},{" "}
                    {placement.offsetYMm}mm
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    Spec: {placement.stitchOrFilm ?? "No method spec added"}
                  </p>
                </article>
              ))
            ) : (
              <article className="card p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                No embellishments configured yet.
              </article>
            )}

            {order.artworkFiles.length === 0 ? (
              <article className="card p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                No artwork files attached yet.
              </article>
            ) : (
              order.artworkFiles.map((artwork) => (
                <article key={artwork.artworkId} className="card p-4">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{artwork.fileName}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>Revision {artwork.revision}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="surface p-5">
          <p className="eyebrow">Proof + purchasing + receiving</p>
          <div className="mt-4 space-y-2">
            <article className="card p-4">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Proof and approval</p>
              <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                Status: {order.approval.status} · Version: {order.approval.proofVersion ?? "N/A"}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                Sent: {formatDate(order.approval.proofSentAt)} · Approved:{" "}
                {formatDate(order.approval.approvedAt)}
              </p>
            </article>

            <article className="card p-4">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Purchasing</p>
              <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                {order.purchasing.status} · Supplier: {order.purchasing.supplierName ?? "N/A"}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                PO: {order.purchasing.supplierPoNumber ?? "N/A"} · ETA:{" "}
                {formatDate(order.purchasing.expectedAt)}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                Ordered: {formatDate(order.purchasing.orderedAt)} · Received:{" "}
                {formatDate(order.purchasing.receivedAt)}
              </p>
            </article>

            {order.purchasing.scanEvents.length > 0 ? (
              order.purchasing.scanEvents
                .slice()
                .sort((a, b) => (a.scannedAt < b.scannedAt ? 1 : -1))
                .slice(0, 4)
                .map((scan) => (
                  <article key={scan.scanId} className="card p-4">
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      Scan: {scan.quantity} x {scan.sku}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {scan.location ?? "Warehouse"} · {scan.scannedBy}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>{formatDate(scan.scannedAt)}</p>
                  </article>
                ))
            ) : (
              <article className="card p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                No receiving scans logged yet.
              </article>
            )}
          </div>
        </section>
      </div>

      <section className="surface p-5">
        <p className="eyebrow">Timeline</p>
        <div className="mt-4 space-y-2">
          {order.activityLog
            .slice()
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
            .slice(0, 10)
            .map((activity) => (
              <article key={activity.activityId} className="card p-4">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{activity.message}</p>
                <p className="mt-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {activity.actor} · {formatDate(activity.createdAt)}
                </p>
              </article>
            ))}
          {order.communicationTimeline.length > 0 ? (
            order.communicationTimeline
              .slice()
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
              .slice(0, 5)
              .map((communication) => (
                <article key={communication.communicationId} className="card p-4">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {communication.channel.toUpperCase()} {communication.direction}
                  </p>
                  <p className="mt-1 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                    {communication.subject}
                  </p>
                  <p className="mt-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {formatDate(communication.createdAt)}
                  </p>
                </article>
              ))
          ) : (
            <article className="card p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              No communication events attached yet.
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
