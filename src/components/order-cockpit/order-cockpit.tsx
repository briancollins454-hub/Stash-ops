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
    <div className="space-y-6">
      <section className="panel section-panel p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="eyebrow">Unified order cockpit</p>
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              {order.internalOrderId}
            </h2>
            <p className="text-sm text-white/72">{order.customer.company ?? order.customer.name}</p>
            <div className="flex flex-wrap gap-2">
              <span className="data-pill">Origin: {order.origin}</span>
              <span className="data-pill">Design: {order.designSetup.status}</span>
              <span className="data-pill">Approval: {order.approval.status}</span>
              <span className="data-pill">Purchasing: {order.purchasing.status}</span>
              <span className="data-pill">Stock: {order.stock.status}</span>
              <span className="data-pill">Production: {order.production.stage}</span>
            </div>
          </div>
          <div className="record-card p-4 sm:p-5">
            <p className="eyebrow">Flow gate</p>
            <p className="mt-3 text-sm font-medium text-white">{gateLabel(order)}</p>
            <div className="mt-4 border-t border-white/10 pt-3 text-xs text-white/58">
              Due: {formatDate(order.dueAt)}
            </div>
            <div className="mt-2 text-xs text-white/58">
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

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="panel section-panel p-5 sm:p-6">
          <p className="eyebrow">Design setup</p>
          <div className="mt-4 space-y-3">
            <article className="record-card p-4">
              <p className="font-medium text-white">{order.designSetup.productLabel}</p>
              <p className="mt-1 text-sm text-white/62">
                Studio: {order.designSetup.studioView.toUpperCase()} · Garment SKU:{" "}
                {order.designSetup.garmentSku ?? "N/A"}
              </p>
              <p className="mt-1 text-sm text-white/62">
                3D model: {order.designSetup.model3dUrl ? "Connected" : "Fallback to 2D preview"}
              </p>
              <p className="mt-2 text-xs text-white/58">
                Last edit: {order.designSetup.lastEditedBy ?? "N/A"} ·{" "}
                {formatDate(order.designSetup.lastEditedAt)}
              </p>
            </article>

            {order.designSetup.placements.length > 0 ? (
              order.designSetup.placements.map((placement) => (
                <article key={placement.placementId} className="record-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-medium text-white">{placement.location}</p>
                    <span className="data-pill">{placement.method}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/62">
                    {placement.widthMm}x{placement.heightMm}mm · Offset {placement.offsetXMm},{" "}
                    {placement.offsetYMm}mm
                  </p>
                  <p className="mt-1 text-xs text-white/58">
                    Spec: {placement.stitchOrFilm ?? "No method spec added"}
                  </p>
                </article>
              ))
            ) : (
              <article className="record-card p-4 text-sm text-white/62">
                No embellishments configured yet.
              </article>
            )}

            {order.artworkFiles.length === 0 ? (
              <article className="record-card p-4 text-sm text-white/62">
                No artwork files attached yet.
              </article>
            ) : (
              order.artworkFiles.map((artwork) => (
                <article key={artwork.artworkId} className="record-card p-4">
                  <p className="font-medium text-white">{artwork.fileName}</p>
                  <p className="mt-1 text-sm text-white/62">Revision {artwork.revision}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel section-panel p-5 sm:p-6">
          <p className="eyebrow">Proof + purchasing + receiving</p>
          <div className="mt-4 space-y-3">
            <article className="record-card p-4">
              <p className="text-sm font-medium text-white">Proof and approval</p>
              <p className="mt-2 text-sm text-white/62">
                Status: {order.approval.status} · Version: {order.approval.proofVersion ?? "N/A"}
              </p>
              <p className="mt-1 text-xs text-white/58">
                Sent: {formatDate(order.approval.proofSentAt)} · Approved:{" "}
                {formatDate(order.approval.approvedAt)}
              </p>
            </article>

            <article className="record-card p-4">
              <p className="text-sm font-medium text-white">Purchasing</p>
              <p className="mt-2 text-sm text-white/62">
                {order.purchasing.status} · Supplier: {order.purchasing.supplierName ?? "N/A"}
              </p>
              <p className="mt-1 text-sm text-white/62">
                PO: {order.purchasing.supplierPoNumber ?? "N/A"} · ETA:{" "}
                {formatDate(order.purchasing.expectedAt)}
              </p>
              <p className="mt-1 text-xs text-white/58">
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
                  <article key={scan.scanId} className="record-card p-4">
                    <p className="text-sm font-medium text-white">
                      Scan: {scan.quantity} x {scan.sku}
                    </p>
                    <p className="mt-1 text-sm text-white/62">
                      {scan.location ?? "Warehouse"} · {scan.scannedBy}
                    </p>
                    <p className="mt-1 text-xs text-white/58">{formatDate(scan.scannedAt)}</p>
                  </article>
                ))
            ) : (
              <article className="record-card p-4 text-sm text-white/62">
                No receiving scans logged yet.
              </article>
            )}
          </div>
        </section>
      </div>

      <section className="panel section-panel p-5 sm:p-6">
        <p className="eyebrow">Timeline</p>
        <div className="mt-4 space-y-3">
          {order.activityLog
            .slice()
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
            .slice(0, 10)
            .map((activity) => (
              <article key={activity.activityId} className="record-card p-4">
                <p className="text-sm font-medium text-white">{activity.message}</p>
                <p className="mt-2 text-xs text-white/58">
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
                <article key={communication.communicationId} className="record-card p-4">
                  <p className="text-sm font-medium text-white">
                    {communication.channel.toUpperCase()} {communication.direction}
                  </p>
                  <p className="mt-1 break-words text-sm text-white/62">
                    {communication.subject}
                  </p>
                  <p className="mt-2 text-xs text-white/58">
                    {formatDate(communication.createdAt)}
                  </p>
                </article>
              ))
          ) : (
            <article className="record-card p-4 text-sm text-white/62">
              No communication events attached yet.
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
