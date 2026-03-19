import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderCockpit } from "@/components/order-cockpit/order-cockpit";
import { fetchBackendJson, isBackendApiConfigured } from "@/lib/backend-api";
import {
  mapBackendJobToLegacyRecord,
  type BackendJobFull,
} from "@/lib/backend-order-adapter";

type OrderDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = await params;

  if (!isBackendApiConfigured()) {
    notFound();
  }

  let job: BackendJobFull;
  try {
    job = await fetchBackendJson<BackendJobFull>(
      `/api/v1/jobs/${encodeURIComponent(orderId.toUpperCase())}`,
    );
  } catch {
    notFound();
  }

  const order = mapBackendJobToLegacyRecord(job);

  return (
    <AppShell title={`Job ${order.internalOrderId}`}>
      <OrderCockpit order={order} />
    </AppShell>
  );
}
