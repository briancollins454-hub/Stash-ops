import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { shellCopy, formatCount } from "@/lib/content";
import { listDecoratorProducts, listDecoratorTemplates } from "@/lib/data-repository";

export const dynamic = "force-dynamic";

export default async function ArtworkTemplatesPage() {
  const [products, templates] = await Promise.all([
    listDecoratorProducts(),
    listDecoratorTemplates(),
  ]);

  return (
    <AppShell title={shellCopy.artworkTemplates.title}>
      <SectionCard
        kicker="Templates"
        title="Logo & template sets"
        detail={`${formatCount(templates.length, "template")} · ${formatCount(products.length, "product")}`}
      >
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {templates.map((template) => (
            <article key={template.id} className="record-card p-4 sm:p-5">
              <p className="eyebrow">Template</p>
              <p className="mt-2 text-base font-semibold text-white">{template.name}</p>
              <p className="mt-2 break-words text-sm text-white/68">{template.description}</p>
              <p className="mt-3 text-xs text-white/56">
                {formatCount(template.layers.length, "layer")}
              </p>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        kicker="Products"
        title="Garment profiles"
        detail={formatCount(products.length, "product")}
      >
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {products.map((product) => (
            <article key={product.id} className="record-card p-4 sm:p-5">
              <p className="eyebrow">{product.brand}</p>
              <p className="mt-2 text-base font-semibold text-white">{product.name}</p>
              <p className="mt-2 text-sm text-white/68">{product.sku}</p>
              <p className="mt-2 text-sm text-white/62">Colour: {product.garmentColor}</p>
              <p className="mt-3 text-xs text-white/56">
                Default area {product.decorationArea.width} x {product.decorationArea.height}
              </p>
            </article>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}

