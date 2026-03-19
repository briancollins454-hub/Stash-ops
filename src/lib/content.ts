export const shellCopy = {
  dashboard: {
    title: "Operations Dashboard",
    description:
      "Run intake, account matching, stock gates, warehouse receipt, production routing, and communications from one operating layer. Shopify and Deco enrich jobs, but Stash controls workflow truth.",
  },
  jobs: {
    title: "Jobs",
    description:
      "Canonical internal job records spanning Shopify metadata, Deco account/design linkage, stock readiness, production routing, and communication timelines. Staff should operate here, not across disconnected tools.",
  },
  accounts: {
    title: "Accounts",
    description:
      "Schools, clubs, and repeat clients live here with aliases, Deco linkage, template packs, and product rules so repeat jobs can be preconfigured instead of rebuilt manually.",
  },
  artworkTemplates: {
    title: "Artwork & Templates",
    description:
      "Manage crest files, logo packs, and reusable templates linked to accounts and product rules. This is the configuration source for auto-placement and job prebuild.",
  },
  stockPurchasing: {
    title: "Stock & Purchasing",
    description:
      "Track manual wholesaler ordering with supplier references, ETA, shortages, and blocker visibility. Manual real-world stock actions become workflow-aware system steps.",
  },
  warehouse: {
    title: "Warehouse",
    description:
      "Goods-in receiving and scan-in confirmation. Partial and full receipts update the canonical job and automatically open production gates when stock is sufficient.",
  },
  production: {
    title: "Production",
    description:
      "Department-led routing for embroidery, DTF, and mixed jobs. Operators get clean, instruction-ready cards with account context, placements, and due-date urgency.",
  },
  communications: {
    title: "Communications",
    description:
      "Unified communication timeline for Gmail proof/update messages, replies, internal notes, and Slack alert events tied back to each job.",
  },
  admin: {
    title: "Admin & Integrations",
    description:
      "Integration health, sync controls, mapping rules, account aliases, and exception tooling. External platforms integrate through this backplane while workflow remains internal.",
  },
  // Legacy keys maintained for existing pages while migration is in progress.
  home: {
    title: "Operations Dashboard",
    description:
      "Run intake, account matching, stock gates, warehouse receipt, production routing, and communications from one operating layer.",
  },
  orders: {
    title: "Jobs",
    description:
      "Canonical internal job records spanning Shopify metadata, Deco account/design linkage, stock readiness, production routing, and communication timelines.",
  },
  customers: {
    title: "Accounts",
    description:
      "Schools, clubs, and repeat clients with alias matching, Deco linkage, and reusable rules.",
  },
  inbox: {
    title: "Communications",
    description:
      "Shared communication linked to jobs, approvals, and internal events.",
  },
  approvals: {
    title: "Communications",
    description:
      "Proof and approval visibility that ties directly to the job lifecycle.",
  },
  dispatch: {
    title: "Warehouse",
    description:
      "Dispatch and fulfillment lanes linked to warehouse readiness.",
  },
  accounting: {
    title: "Admin & Integrations",
    description:
      "Accounting and integration controls for operational reliability.",
  },
  integrations: {
    title: "Admin & Integrations",
    description:
      "Backplane controls, sync status, and mapping governance.",
  },
  designer: {
    title: "Artwork & Templates",
    description:
      "Template and design workspace tied to account rules and production instructions.",
  },
} as const;

export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}
