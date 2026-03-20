import QuoteBuilder from "@/components/quotes/quote-builder";

export default function QuotesPage() {
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">New Order</p>
        <h1 className="page-title">Create Quote</h1>
      </div>
      <QuoteBuilder />
    </div>
  );
}
