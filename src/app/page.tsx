import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { AccountingList } from "@/components/modules/accounting-list";
import { ApprovalsBoard } from "@/components/modules/approvals-board";
import { CommandSpotlight } from "@/components/modules/command-spotlight";
import { CustomerList } from "@/components/modules/customer-list";
import { InboxList } from "@/components/modules/inbox-list";
import { IntegrationsGrid } from "@/components/modules/integrations-grid";
import { MetricGrid } from "@/components/modules/metric-grid";
import { OrdersTable } from "@/components/modules/orders-table";
import { ProductionBoard } from "@/components/modules/production-board";
import { formatCount, shellCopy } from "@/lib/content";
import { getCommandCenterData } from "@/lib/data-repository";

export default async function Home() {
  const {
    orders,
    customers,
    inboxThreads,
    approvals,
    productionJobs,
    accountingRecords,
    integrations,
    metrics,
  } = await getCommandCenterData();

  return (
    <AppShell
      title={shellCopy.home.title}
      description={shellCopy.home.description}
    >
      <CommandSpotlight
        orders={orders}
        threads={inboxThreads}
        integrations={integrations}
      />

      <MetricGrid metrics={metrics} />

      <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          kicker="Orders"
          title="Live job traffic"
          detail={formatCount(orders.length, "active order")}
        >
          <OrdersTable orders={orders} />
        </SectionCard>
        <SectionCard
          kicker="Inbox"
          title="Customer comms"
          detail={formatCount(inboxThreads.length, "active thread")}
        >
          <InboxList threads={inboxThreads} />
        </SectionCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
        <SectionCard
          kicker="Approvals"
          title="Proof queue"
          detail={formatCount(approvals.length, "proof item")}
        >
          <ApprovalsBoard approvals={approvals} compact />
        </SectionCard>
        <SectionCard
          kicker="Production"
          title="Floor routing"
          detail={formatCount(productionJobs.length, "live job")}
        >
          <ProductionBoard jobs={productionJobs.slice(0, 3)} />
        </SectionCard>
        <SectionCard
          kicker="Accounting"
          title="QBO sync staging"
          detail={formatCount(accountingRecords.length, "staged record")}
        >
          <AccountingList records={accountingRecords} />
        </SectionCard>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          kicker="Customers"
          title="High-value accounts"
          detail={formatCount(customers.length, "tracked account")}
        >
          <CustomerList customers={customers.slice(0, 3)} />
        </SectionCard>
        <SectionCard
          kicker="Integrations"
          title="Server-side health"
          detail={formatCount(integrations.length, "connected system")}
        >
          <IntegrationsGrid integrations={integrations} />
        </SectionCard>
      </div>
    </AppShell>
  );
}
