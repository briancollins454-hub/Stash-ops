import { AppShell } from "@/components/app-shell";
import QuoteBuilder from "@/components/quotes/quote-builder";

export default function QuotesPage() {
  return (
    <AppShell title="Create Quote">
      <QuoteBuilder />
    </AppShell>
  );
}
