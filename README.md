# Stash Ops

Internal operations shell for:

- orders
- customers
- inbox
- approvals
- production
- dispatch
- accounting
- integrations
- custom decorator studio

## What is here

This is a greenfield Next.js app scaffolded for the architecture we discussed:

- `DecoNetwork` stays server-side
- `Shopify` remains storefront + checkout
- `QuickBooks Online` is the accounting truth
- `Stash` becomes the internal UI and orchestration layer

The current build includes:

- a multi-route UI shell for the main operational modules
- typed domain models and live-derived operational data
- a shared data repository layer (`src/lib/data-repository.ts`) for server pages + APIs
- a centralized content registry (`src/lib/content.ts`) for page-level copy consistency
- a first custom decorator workspace
- API routes for `orders`, `customers`, `inbox`, `approvals`, `production`, `accounting`, `metrics`, `integration health`, decorator studio seed data, plus a command overview route
- dispatch routes:
  - `GET /api/dispatch/queue` (Shopify fulfillment board: unfulfilled + fulfilled)
  - `POST /api/dispatch/bulk-ship` (bulk ShipStation print + Shopify fulfillment + internal dispatch stage update)
- sync engine + control routes:
  - `POST /api/sync/{shopify|deco|qbo|shipstation|gmail|slack}`
  - `POST /api/sync/shopify/backfill` (one-time historical unfulfilled import)
  - `GET /api/sync/status`
  - stale-aware auto-sync triggers from core read paths
- unified orchestration scaffolding under `src/server/`:
  - canonical order model
  - event envelope model
  - order state machine with guard rails
  - webhook mappers for Shopify/Deco/Gmail/Slack
  - bridge compatibility helpers migrated from legacy in-house logic (`standardizeSize`, eligibility rules, Deco job ID extraction)
  - unified order repository with PostgreSQL mode (`DATABASE_URL`) and in-memory fallback
  - indexed JSONB query paths for faster PostgreSQL order reads
  - orchestration service to process integration events and lifecycle automation
- canonical REST seed endpoints:
  - `GET/POST /api/v1/orders`
  - `GET/PATCH /api/v1/orders/:orderId`
  - `GET /api/v1/orders/:orderId/timeline`
  - `PATCH /api/v1/orders/:orderId/approval`
  - `POST /api/webhooks/{shopify|deco|gmail|slack}`
- initial unified order cockpit route: `/orders/[orderId]`
- workflow-ready order model additions:
  - per-order design setup (3D/2D studio mode + saved embellishment placements)
  - purchasing/receiving state with scan-in events
  - lifecycle gates so production readiness requires design + approval + stock
- manual intake + Deco handoff:
  - create internal orders directly in `/orders`
  - when production transitions to `complete`, order is automatically queued for Deco import and linked with a `decoOrderId`
- integrations UI now includes a sync control room at `/integrations` for auto-sync visibility and one-click provider sync
- architecture reference docs:
  - `docs/unified-ops-architecture.md`
  - `db/unified_ops_schema.sql`

## Persistence modes

The canonical repository now runs in two modes:

- `memory` mode (default when `DATABASE_URL` is not set)
- `postgres` mode (enabled when `DATABASE_URL` is set)

When PostgreSQL mode is enabled, the repository auto-creates:

- `unified_order_snapshots` (JSON canonical order records)
- `unified_idempotency_keys` (dedupe keys for inbound events)

Set your database connection:

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"
```

## Live connector env vars

To run live provider sync and secure webhooks, set:

```bash
cp .env.example .env.local

export ENABLE_DEMO_DATA="false"

export SHOPIFY_DOMAIN="your-store.myshopify.com"
export SHOPIFY_ACCESS_TOKEN="shpat_or_admin_api_token"
export SHOPIFY_API_VERSION="2025-01"
export SHOPIFY_WEBHOOK_SECRET="shopify_webhook_signing_secret"
export SHOPIFY_SYNC_MAX_PAGES="20"                    # optional
export SHOPIFY_BACKFILL_MAX_PAGES="250"               # optional
export SHOPIFY_SYNC_TIMEOUT_MS="30000"                # optional

export SYNC_PROVIDER_MAX_RUNTIME_MS="900000"          # optional stale-lock recovery

export DECO_ORDER_UPSERT_URL="https://your-internal-deco-bridge.example.com/upsert"
export DECO_UPSERT_TOKEN="your_token_if_required"
export DECO_UPSERT_TOKEN_HEADER="authorization"   # optional
export DECO_UPSERT_TOKEN_PREFIX="Bearer"          # optional
export DECO_SYNC_TIMEOUT_MS="25000"               # optional

export SHIPSTATION_PRINT_URL="https://your-internal-shipstation-bridge.example.com/print"
export SHIPSTATION_PRINT_TOKEN="your_token_if_required"
export SHIPSTATION_PRINT_TOKEN_HEADER="authorization"  # optional
export SHIPSTATION_PRINT_TOKEN_PREFIX="Bearer"         # optional

export QBO_REALM_ID="1234567890"
export QBO_ACCESS_TOKEN="qbo_oauth_access_token"
export QBO_MINOR_VERSION="75"                          # optional
export QBO_BASE_URL="https://quickbooks.api.intuit.com" # optional

export GMAIL_ACCESS_TOKEN="gmail_oauth_access_token"
export GMAIL_USER_ID="me"                              # optional
export GMAIL_SYNC_MAX_RESULTS="40"                     # optional

export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_CHANNEL_IDS="C0123456789,C0987654321"
export SLACK_SYNC_MAX_PER_CHANNEL="50"                 # optional
```

Notes:
- `ENABLE_DEMO_DATA=false` keeps demo seed records disabled by default in both memory and PostgreSQL modes.
- `SHOPIFY_WEBHOOK_SECRET` enables HMAC verification on `/api/webhooks/shopify`.
- `POST /api/sync/shopify/backfill` performs a historical backfill for Shopify unfulfilled orders.
- `SHOPIFY_SYNC_TIMEOUT_MS` prevents Shopify sync requests from hanging indefinitely.
- `SYNC_PROVIDER_MAX_RUNTIME_MS` auto-recovers stale provider locks if a worker gets stuck.
- `DECO_ORDER_UPSERT_URL` enables live Deco create/update during sync and completion handoff.
- `SHIPSTATION_PRINT_URL` enables live label print calls; without it, dispatch runs in simulated print mode but still performs Shopify fulfillment attempts.
- `QBO_REALM_ID` + `QBO_ACCESS_TOKEN` enable live QuickBooks invoice sync.
- `GMAIL_ACCESS_TOKEN` enables Gmail polling sync in addition to webhook ingestion.
- `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_IDS` enable Slack channel sync in addition to webhook ingestion.
- Without provider vars, sync engine stays operational but reports provider as not configured.

## Local run

The machine did not have a global Node install, so a local Node runtime was bundled into the project root at:

`../.local/node-v24.14.0-darwin-arm64`

From the project root you can run:

```bash
./run-frontend.sh
```

Or manually:

```bash
export PATH="$PWD/../.local/node-v24.14.0-darwin-arm64/bin:$PATH"
npm run dev
```

## Validation

```bash
export PATH="$PWD/../.local/node-v24.14.0-darwin-arm64/bin:$PATH"
npm run lint
npm run build
```

## Next recommended slices

1. Add auth + role permissions over the canonical order lifecycle.
2. Move from snapshot persistence to fully normalized PostgreSQL writes (`db/unified_ops_schema.sql`).
3. Add background jobs/outbox workers for `Deco`, `Shopify`, `Gmail`, `Slack`, and `QBO`.
4. Build proof send/reply automation over Gmail with signed approval links.
5. Turn decorator payloads into saved design revisions linked to order proofs.
