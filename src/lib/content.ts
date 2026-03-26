export const shellCopy = {
  dashboard: { title: "Dashboard" },
  jobs: { title: "Jobs" },
  accounts: { title: "Accounts" },
  artworkTemplates: { title: "Artwork & Templates" },
  stockPurchasing: { title: "Stock & Purchasing" },
  warehouse: { title: "Warehouse" },
  production: { title: "Production" },
  communications: { title: "Communications" },
  accountsReceivable: { title: "Accounts Receivable" },
  admin: { title: "Admin" },
  // Legacy keys for redirect pages.
  home: { title: "Dashboard" },
  orders: { title: "Jobs" },
  customers: { title: "Accounts" },
  inbox: { title: "Communications" },
  approvals: { title: "Communications" },
  dispatch: { title: "Warehouse" },
  accounting: { title: "Admin" },
  integrations: { title: "Admin" },
  designer: { title: "Artwork & Templates" },
} as const;

export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}
