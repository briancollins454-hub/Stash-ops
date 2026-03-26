import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { IntegrationsHub } from "@/components/integrations/integrations-hub";
import { CatalogImportUploader } from "@/components/modules/catalog-import-uploader";
import { ProductCatalogBrowser } from "@/components/modules/product-catalog-browser";
import { BulkDecoArtworkImporter } from "@/components/modules/bulk-deco-artwork-importer";
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
        kicker="Artwork"
        title="Bulk Deco artwork import"
        detail="Import artwork for all accounts at once"
      >
        <BulkDecoArtworkImporter />
      </SectionCard>

      <SectionCard
        kicker="Catalog"
        title="Product catalog import"
        detail="Upload supplier CSV files"
      >
        <CatalogImportUploader />
      </SectionCard>

      <SectionCard
        kicker="Catalog"
        title="Product catalog browser"
        detail="Browse, search, and manage imported products by brand and type"
      >
        <ProductCatalogBrowser />
      </SectionCard>
    </AppShell>
  );
}

