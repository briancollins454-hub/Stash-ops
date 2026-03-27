export type NavItem = {
  href: string;
  label: string;
  caption: string;
  icon: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navigationGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", caption: "Overview", icon: "grid" },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/jobs", label: "Jobs", caption: "All jobs", icon: "layers" },
      { href: "/quotes", label: "Quotes", caption: "Create & price", icon: "file-text" },
      { href: "/accounts", label: "Accounts", caption: "Clients & rules", icon: "users" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/production", label: "Production", caption: "Floor routing", icon: "zap" },
      { href: "/production/batches", label: "Batches", caption: "Production batches", icon: "stack" },
      { href: "/stock-purchasing", label: "Stock", caption: "Ordering & ETAs", icon: "package" },
      { href: "/warehouse", label: "Warehouse", caption: "Receiving", icon: "warehouse" },
    ],
  },
  {
    label: "Other",
    items: [
      { href: "/communications", label: "Comms", caption: "Email & messages", icon: "mail" },
      { href: "/accounts-receivable", label: "Receivables", caption: "Payments", icon: "credit-card" },
      { href: "/admin", label: "Admin", caption: "Settings", icon: "settings" },
    ],
  },
];

// Flat list for backward compatibility
export const navigationItems = navigationGroups.flatMap((g) => g.items);
