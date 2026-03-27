import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getProductionBatchDetail, listDecoratorProducts, listDecoratorTemplates } from "@/lib/data-repository";
import { DecoratorStudio } from "@/components/decorator/decorator-studio";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ batchId: string }>;
}

export default async function BatchDesignerPage({ params }: Props) {
  const { batchId } = await params;
  
  const [batch, products, templates] = await Promise.all([
    getProductionBatchDetail(batchId),
    listDecoratorProducts(),
    listDecoratorTemplates(),
  ]);

  if (!batch) {
    notFound();
  }

  return (
    <AppShell title={`Design Batch: ${batch.displayTitle}`}>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">Batch Personalisation Setup</h2>
        <p className="text-sm text-gray-400">
          Apply logos and configure initials for {batch.totalQuantity} items. Placements will automatically sync across properties.
        </p>
      </div>
      <DecoratorStudio products={products} templates={templates} />
    </AppShell>
  );
}
