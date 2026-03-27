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

  // Ensure we inject the batch details as a valid product if products feed is empty or unlinked
  const batchProduct = {
    id: batch.id,
    name: batch.displayTitle,
    brand: batch.accountName,
    sku: "BATCH-CUSTOM",
    garmentColor: batch.colour ?? "N/A",
    decorationArea: { width: 320, height: 280 }
  };
  
  const batchTemplate = {
    id: `TMP-${batch.id}`,
    name: "Batch Setup",
    description: "Initial placement locked",
    layers: [
      {
        id: "L1",
        name: "Crest Placement",
        type: "graphic" as const,
        color: "#ffffff",
        x: 60,
        y: 60,
        width: 80,
        rotation: 0,
        opacity: 1,
        content: "Crest"
      },
      {
        id: "L2",
        name: "Initials",
        type: "text" as const,
        color: "#f8fafc",
        x: 180,
        y: 60,
        width: 60,
        rotation: 0,
        opacity: 0.9,
        content: "AB"
      }
    ]
  };

  const finalProducts = products.length > 0 ? products : [batchProduct];
  const finalTemplates = templates.length > 0 ? templates : [batchTemplate];

  return (
    <AppShell title={`Design Batch: ${batch.displayTitle}`}>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">Batch Personalisation Setup</h2>
        <p className="text-sm text-gray-400">
          Apply logos and configure initials for {batch.totalQuantity} items. Placements will automatically sync across properties.
        </p>
      </div>
      <DecoratorStudio products={finalProducts} templates={finalTemplates} />
    </AppShell>
  );
}
