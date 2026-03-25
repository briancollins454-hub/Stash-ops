import { notFound } from "next/navigation";
import { getJob } from "@/lib/data-repository";
import { QuotePrintView } from "@/components/quotes/quote-print-view";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ jobId: string }>;
}

export default async function QuotePrintPage({ params }: Props) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) return notFound();

  return <QuotePrintView job={job} />;
}
