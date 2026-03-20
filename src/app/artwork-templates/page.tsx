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
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {templates.map((template) => (
            <article key={template.id} className="card p-4">
              <p className="eyebrow">Template</p>
              <p className="mt-1.5 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{template.name}</p>
              <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>{template.description}</p>
              <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
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
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {products.map((product) => (
            <article key={product.id} className="card p-4">
              <p className="eyebrow">{product.brand}</p>
              <p className="mt-1.5 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{product.name}</p>
              <p className="mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>{product.sku}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>Colour: {product.garmentColor}</p>
              <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                Default area {product.decorationArea.width} x {product.decorationArea.height}
              </p>
            </article>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}

