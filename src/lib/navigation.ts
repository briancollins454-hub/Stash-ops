export const navigationItems = [
  { href: "/", label: "Dashboard", caption: "Operational command view" },
  { href: "/jobs", label: "Jobs", caption: "Canonical workflow record" },
  { href: "/accounts", label: "Accounts", caption: "School/club intelligence" },
  { href: "/artwork-templates", label: "Artwork", caption: "Templates and logo packs" },
  { href: "/stock-purchasing", label: "Stock", caption: "Supplier and ETA control" },
  { href: "/warehouse", label: "Warehouse", caption: "Scan-in and receipt flow" },
  { href: "/production", label: "Production", caption: "Department queue routing" },
  { href: "/communications", label: "Comms", caption: "Gmail + Slack timeline" },
  {
    href: "/admin",
    label: "Admin",
    caption: "Integrations and control room",
  },
] as const;
