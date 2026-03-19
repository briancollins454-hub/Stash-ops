import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { CustomerList } from "@/components/modules/customer-list";
import { formatCount, shellCopy } from "@/lib/content";
import { listCustomers } from "@/lib/data-repository";

export default async function CustomersPage() {
  const customers = await listCustomers();

  return (
    <AppShell
      title={shellCopy.customers.title}
      description={shellCopy.customers.description}
    >
      <SectionCard
        kicker="Accounts"
        title="Customer 360"
        detail={formatCount(customers.length, "active account")}
      >
        <CustomerList customers={customers} />
      </SectionCard>
    </AppShell>
  );
}
