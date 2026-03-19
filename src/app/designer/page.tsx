import { AppShell } from "@/components/app-shell";
import { DecoratorStudio } from "@/components/decorator/decorator-studio";
import { shellCopy } from "@/lib/content";
import {
  listDecoratorProducts,
  listDecoratorTemplates,
} from "@/lib/data-repository";

export default async function DesignerPage() {
  const [products, templates] = await Promise.all([
    listDecoratorProducts(),
    listDecoratorTemplates(),
  ]);

  return (
    <AppShell
      title={shellCopy.designer.title}
      description={shellCopy.designer.description}
    >
      <DecoratorStudio products={products} templates={templates} />
    </AppShell>
  );
}
