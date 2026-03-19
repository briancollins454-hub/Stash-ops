export const shellCopy = {
  home: {
    title: "Command Center",
    description:
      "Run the whole shop from one place. This shell keeps customer-facing ops, internal communication, production routing, and accounting visibility in your own UI while Deco stays on the server side where it belongs.",
  },
  orders: {
    title: "Orders",
    description:
      "This module is the internal order truth for your staff. Each record can stitch together Shopify events, Deco production context, approvals, inbox threads, and accounting readiness without sending people back into Deco screens.",
  },
  customers: {
    title: "Customers",
    description:
      "A customer layer for your team, not just account records. This is where account health, open jobs, communication history, and design tendencies can live together.",
  },
  inbox: {
    title: "Inbox",
    description:
      "Shared communication should be tied to orders and customers, not trapped in personal mailboxes. This is the message layer where your team sees the context before they reply.",
  },
  approvals: {
    title: "Approvals",
    description:
      "Approvals become a tracked workflow in your own app, with SLA visibility and customer context around every proof. The aim is to stop approvals from hiding in separate systems.",
  },
  production: {
    title: "Production",
    description:
      "Production should read like a routing board, not an admin screen. This module is where decorators, operators, and packers get the next best action without digging through Deco.",
  },
  dispatch: {
    title: "Dispatch",
    description:
      "This is your Shopify unfulfilled lane. Teams can bulk print ShipStation tickets from here, push fulfillment back to Shopify, and keep the unified order record in sync automatically.",
  },
  accounting: {
    title: "Accounting",
    description:
      "QuickBooks Online sits here as the accounting source of truth. Your app decides what is ready, what is blocked, and what needs investigation before anything hits the books.",
  },
  integrations: {
    title: "Integrations",
    description:
      "This layer is the bridge between your UI and the systems that stay behind the scenes. The app owns orchestration, retries, mapping, and visibility while external platforms keep doing the jobs they are good at.",
  },
  designer: {
    title: "Decorator Studio",
    description:
      "Your front-end-owned decorator experience: fast, premium, and fully in Stash, with proof and production payloads staying in your own data model.",
  },
} as const;

export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}
