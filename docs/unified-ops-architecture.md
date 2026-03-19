# Unified Ops Architecture (Shopify + Deco + Gmail + Slack)

## Owner-Confirmed Current Flow (As-Is)

1. Sales agrees product range, decoration details, pricing, and margin.
2. Decoration details are recorded in Notion and Stash Shop.
3. Customer is created in Deco with files attached to the customer record.
4. Shopify store is built with tags/warnings; Airtable drives setup steps.
5. Customers place orders on Shopify.
6. Fulfillment expectations are communicated at purchase time:
   - Stock items: 15-20 working days dispatch.
   - MTO items: 8-12 weeks from shop close date.
7. Orders are batched and manually added to Deco, with Deco job number added to notes.
8. Normal Deco workflow continues:
   - Quote (auto-approved for standard setups)
   - Raise PO and order goods
   - Goods booked in and moved to print/embroidery production
   - Production runs from Deco job card
9. Finished goods are shipped in ShipStation.
10. Shopify is updated automatically from ShipStation; Deco shipment is marked manually.

## Unified Target Flow In Stash (To-Be)

1. **Sales setup workspace in Stash**
   - Capture product range, decoration spec, pricing/profit.
   - Store files/specs on a reusable customer program profile.
   - Keep links/sync references for Notion/Airtable where needed during migration.
2. **Shop launch orchestration**
   - Track Shopify tag/warning readiness checklist in Stash (can ingest Airtable checklist).
3. **Order ingestion**
   - Shopify order creates canonical `UnifiedOrderRecord` immediately.
   - SLA model attached (`stock` vs `MTO`) with due-date logic.
4. **Batching + Deco sync**
   - Batch engine groups orders by program/shop close/deco rules.
   - Deco order/job created from Stash and Deco job number linked automatically.
5. **Purchasing + receiving**
   - PO workflow tracked in Stash.
   - Scan-in updates receiving state and stock gate.
6. **Production**
   - Work routed by decoration method (DTF/embroidery/print) from one production board.
7. **Shipping + closeout**
   - ShipStation events sync into Stash and Shopify.
   - Deco shipment update is automated from the same event (removes manual Deco ship-marking).

## Immediate Build Priorities From This Discovery

1. Add **program/shop model** (shop close date, SLA type, batching key).
2. Add **batching service** from Shopify orders to Deco jobs.
3. Add **Deco job card linkage** as first-class field (not manual notes).
4. Add **ShipStation sync** to auto-close Shopify + Deco from one shipment event.
5. Add migration adapters for **Notion/Airtable checklists** so rollout can be phased without disruption.

## 1) System Architecture

### Canonical model
- The internal `UnifiedOrderRecord` is the canonical source of operational truth.
- Shopify, Deco, Gmail, and Slack are integration inputs/outputs, not workflow owners.

### Core layers
- `UI layer (Next.js app routes + components)`:
  - Unified order cockpit and department queues.
- `Application/orchestration layer`:
  - Ingestion, state transitions, automation rules, activity logging.
- `Integration layer`:
  - Webhook mappers and connector adapters for Shopify/Deco/Gmail/Slack.
- `Persistence layer`:
  - Order store, timeline/activity, integration links, inbox/outbox tables.

### Runtime data flow
1. Integration webhook/event arrives.
2. Mapper normalizes payload into `InboundIntegrationEvent`.
3. Orchestrator enforces idempotency and applies centralized business rules.
4. Canonical order record updates.
5. Activity log/timeline entries are appended.
6. Outbound notifications/sync jobs are queued.
7. On production completion, order is auto-queued for Deco import and linked to a `decoOrderId`.
8. Auto-sync engine checks stale provider windows and re-syncs in the background without blocking UI reads.

## 2) Recommended Folder/File Structure

```text
src/
  app/
    api/
      v1/orders/...
      webhooks/shopify
      webhooks/deco
      webhooks/gmail
      webhooks/slack
    orders/[orderId]/page.tsx
  components/
    order-cockpit/
      order-cockpit.tsx
  server/
    core/
      order-types.ts
      order-events.ts
      order-state-machine.ts
      order-orchestrator.ts
    integrations/
      webhook-mappers.ts
    repositories/
      unified-order-repository.ts
db/
  unified_ops_schema.sql
docs/
  unified-ops-architecture.md
```

## 3) Database Schema

- See [`db/unified_ops_schema.sql`](../db/unified_ops_schema.sql).
- Key tables:
  - `orders` (canonical order/job)
  - `order_addresses`, `order_items`, `order_artwork_assets`
  - `order_approval`, `order_stock`, `order_production`
  - `order_communications`, `order_activity_log`
  - `integration_event_inbox` (idempotency + replay safety)
  - `outbound_jobs` (sync/alert dispatch)

## 4) Event Model

- Envelope: `InboundIntegrationEvent`.
- Required metadata:
  - `eventId`
  - `idempotencyKey`
  - `source`
  - `eventType`
  - `occurredAt`
  - `refs` (`internalOrderId`/`shopifyOrderId`/`decoOrderId`/`gmailThreadId`)
- Initial event types:
  - `shopify.order.created`, `shopify.order.updated`
  - `deco.stock.updated`, `deco.order.synced`
  - `gmail.message.received`, `gmail.message.sent`
  - `slack.alert.received`

## 5) Webhook Handlers

- `/api/webhooks/shopify`
- `/api/webhooks/deco`
- `/api/webhooks/gmail`
- `/api/webhooks/slack`

Each endpoint:
1. Parses external payload.
2. Maps to normalized internal event.
3. Routes through orchestrator.
4. Returns accepted + internal order linkage (when resolved).

Shopify ingress uses HMAC verification when `SHOPIFY_WEBHOOK_SECRET` is configured.

## 6) Order State Machine

### Approval states
- `not_required`
- `awaiting_artwork`
- `proof_in_progress`
- `proof_sent`
- `awaiting_customer_approval`
- `approved`
- `changes_requested`
- `rejected`

### Stock states
- `in_stock`
- `partially_in_stock`
- `awaiting_supplier`
- `purchasing_required`
- `stock_risk`
- `stock_confirmed`

### Design setup states
- `not_started`
- `in_progress`
- `proof_ready`
- `customer_approved`
- `production_locked`

### Purchasing/receiving states
- `not_started`
- `ordered_from_supplier`
- `in_transit`
- `scanned_partial`
- `scanned_complete`

### Production stages
- `pending_review`
- `awaiting_artwork`
- `awaiting_approval`
- `approved_awaiting_stock`
- `ready_for_production`
- `in_production`
- `quality_check`
- `ready_for_dispatch`
- `dispatched`
- `complete`

### Guard rules
- `ready_for_production` requires design approved (`customer_approved` or `production_locked`), approval cleared (`approved` or `not_required`), and stock ready (`in_stock` or `stock_confirmed`).
- Approval `changes_requested`/`rejected` returns order to `awaiting_artwork`.
- State transitions are validated centrally in `order-state-machine.ts`.

## 7) Approval Workflow Logic

1. Design setup is created inside the order (`3D` preferred, `2D` fallback).
2. Embellishment placements (DTF/embroidery/etc) are saved to the canonical order.
3. Proof is sent via Gmail integration and logged on timeline.
4. Customer response updates approval state.
5. Purchasing/receiving flow runs and scan-in events update stock readiness.
6. Automation checks design + approval + stock guards.
7. If all pass, order auto-unlocks to `ready_for_production`.

## 8) Sync Strategy (Shopify/Deco/Gmail/Slack)

### Shopify
- Source for ecommerce orders and updates.
- Ingest via webhook and normalize to canonical order.
- Legacy bridge compatibility retained:
  - extract Deco job-number candidates from Shopify notes/comments
  - preserve mapping filters for non-physical/service add-ons

### Deco
- Source for stock/production backend signals.
- Sync inventory/PO/production metadata into canonical order stock + production states.

### Gmail
- Channel for customer communication.
- Send proof/update emails from platform; capture replies and attach to order timeline.

### Slack
- Internal notification channel only.
- Alerts are emitted from canonical state changes; Slack does not own workflow state.

### Reliability pattern
- Idempotent inbox (`integration_event_inbox`) for dedupe and replay.
- Outbox jobs for connector dispatch.
- Canonical state machine controls progression, not integration-specific logic.
- Stale-aware provider sync engine:
  - `shopify` (90s target freshness)
  - `deco` (120s target freshness)
  - `qbo` (180s target freshness)
  - `shipstation` (120s target freshness)
  - `gmail` (150s target freshness)
  - `slack` (150s target freshness)
- Manual sync control remains available while auto-sync keeps data fresh.

## 9) Initial API Endpoints

### Canonical orders API
- `GET /api/v1/orders`
- `POST /api/v1/orders`
- `GET /api/v1/orders/:orderId`
- `PATCH /api/v1/orders/:orderId`
- `GET /api/v1/orders/:orderId/timeline`
- `PATCH /api/v1/orders/:orderId/approval`

`POST /api/v1/orders` is used for manual order creation from the internal UI (`/orders`).
`PATCH /api/v1/orders/:orderId` with `productionStage: "complete"` auto-links and queues Deco import.

### Sync control API
- `POST /api/sync/shopify`
- `POST /api/sync/shopify/backfill`
- `POST /api/sync/deco`
- `POST /api/sync/qbo`
- `POST /api/sync/shipstation`
- `POST /api/sync/gmail`
- `POST /api/sync/slack`
- `GET /api/sync/status`

Live connector requirements:
- `ENABLE_DEMO_DATA=false` to keep all demo seed data off.
- Shopify pull sync: `SHOPIFY_DOMAIN`, `SHOPIFY_ACCESS_TOKEN` (and optional `SHOPIFY_API_VERSION`).
- Shopify optional page controls: `SHOPIFY_SYNC_MAX_PAGES`, `SHOPIFY_BACKFILL_MAX_PAGES`.
- Shopify sync timeout: `SHOPIFY_SYNC_TIMEOUT_MS`.
- Stale provider lock recovery: `SYNC_PROVIDER_MAX_RUNTIME_MS`.
- Shopify webhook verification: `SHOPIFY_WEBHOOK_SECRET`.
- Deco upsert sync: `DECO_ORDER_UPSERT_URL` (and optional token headers).
- QBO sync: `QBO_REALM_ID`, `QBO_ACCESS_TOKEN`.
- Gmail sync: `GMAIL_ACCESS_TOKEN`.
- Slack sync: `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_IDS`.
- ShipStation live print: `SHIPSTATION_PRINT_URL` (otherwise simulated print mode).

### Integration ingress
- `POST /api/webhooks/shopify`
- `POST /api/webhooks/deco`
- `POST /api/webhooks/gmail`
- `POST /api/webhooks/slack`

## 10) React UI Structure

### Primary UX objects
- Unified queue pages (orders, approvals, production, stock risk, dispatch).
- Single order cockpit page (`/orders/[orderId]`) showing:
  - IDs and integration refs
  - line items + garment/deco context
  - approval state + proof context
  - stock/purchasing status
  - production stage
  - communication timeline
  - activity/audit log

### UX rule
- Users should be able to run an order end-to-end without leaving the internal platform UI.
