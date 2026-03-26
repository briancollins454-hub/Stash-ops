import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { IntegrationsHub } from "@/components/integrations/integrations-hub";
import { CatalogImportUploader } from "@/components/modules/catalog-import-uploader";
import { shellCopy } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  return (
    <AppShell title={shellCopy.admin.title}>
      <SectionCard
        kicker="Control room"
        title="Integrations"
        detail="Click an integration to configure & sync"
      >
        <IntegrationsHub />
      </SectionCard>

      <SectionCard
        kicker="Catalog"
        title="Product catalog import"
        detail="Upload supplier CSV files"
      >
        <CatalogImportUploader />
      </SectionCard>
    </AppShell>
  );
}

