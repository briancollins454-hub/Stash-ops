import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OrderCockpit } from "@/components/order-cockpit/order-cockpit";
import { getUnifiedOrder } from "@/server/repositories/unified-order-repository";

type OrderDetailPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = await params;
  const order = await getUnifiedOrder(orderId.toUpperCase());

  if (!order) {
    notFound();
  }

  return (
    <AppShell
      title={`Order ${order.internalOrderId}`}
      description="Unified order cockpit with Shopify, Deco, Gmail, Slack, approvals, stock, production, and full activity history in one place."
    >
      <OrderCockpit order={order} />
    </AppShell>
  );
}
