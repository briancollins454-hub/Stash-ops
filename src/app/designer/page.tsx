import { AppShell } from "@/components/app-shell";
import { shellCopy } from "@/lib/content";
import { listDecoratorProducts, listDecoratorTemplates } from "@/lib/data-repository";
import { DecoratorStudio } from "@/components/decorator/decorator-studio";

export const dynamic = "force-dynamic";

export default async function DesignerPage() {
  const [products, templates] = await Promise.all([
    listDecoratorProducts(),
    listDecoratorTemplates(),
  ]);

  return (
    <AppShell title={shellCopy.designer.title}>
      <DecoratorStudio products={products} templates={templates} />
    </AppShell>
  );
}

