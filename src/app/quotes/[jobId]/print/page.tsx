import { notFound } from "next/navigation";
import { getEnrichedQuoteDetail, getJob } from "@/lib/data-repository";
import { QuotePrintView } from "@/components/quotes/quote-print-view";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ jobId: string }>;
}

export default async function QuotePrintPage({ params }: Props) {
  const { jobId } = await params;

  // Try enriched detail first (includes Deco product data), fall back to basic job
  const enriched = await getEnrichedQuoteDetail(jobId);
  if (enriched) {
    return <QuotePrintView job={enriched} />;
  }

  const job = await getJob(jobId);
  if (!job) return notFound();

  return <QuotePrintView job={job} />;
}
