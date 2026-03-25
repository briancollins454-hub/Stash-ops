import { AppShell } from "@/components/app-shell";
import QuoteBuilder from "@/components/quotes/quote-builder";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;

  return (
    <AppShell title={edit ? "Edit Quote" : "Create Quote"}>
      <QuoteBuilder editJobId={edit} />
    </AppShell>
  );
}
