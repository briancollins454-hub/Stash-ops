export const navigationItems = [
  { href: "/", label: "Dashboard", caption: "Overview", icon: "grid" },
  { href: "/jobs", label: "Jobs", caption: "All jobs", icon: "layers" },
  { href: "/quotes", label: "Quotes", caption: "Create & price", icon: "file-text" },
  { href: "/accounts", label: "Accounts", caption: "Clients & rules", icon: "users" },
  { href: "/stock-purchasing", label: "Stock", caption: "Ordering & ETAs", icon: "package" },
  { href: "/warehouse", label: "Warehouse", caption: "Receiving & scan-in", icon: "warehouse" },
  { href: "/production", label: "Production", caption: "Floor routing", icon: "zap" },
  { href: "/production/batches", label: "Batches", caption: "Production batches", icon: "stack" },
  { href: "/communications", label: "Comms", caption: "Email & messages", icon: "mail" },
  { href: "/accounts-receivable", label: "Accounts Receivable", caption: "Outstanding payments", icon: "credit-card" },
  { href: "/admin", label: "Admin", caption: "Settings", icon: "settings" },
] as const;
