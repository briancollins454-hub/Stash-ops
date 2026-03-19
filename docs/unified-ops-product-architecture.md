# Unified Ops Product Architecture (Production Blueprint)

## Product Positioning

Stash Ops is a **single internal operating system** for garment decoration operations.  
It unifies Shopify, DecoNetwork, Gmail, Slack, purchasing, warehouse receipt, and production routing around one canonical internal job record.

The user-facing workspace is Stash. External systems are connectors and data providers.

## System Architecture

### 1. Frontend Experience Layer (Next.js)

Top-level first-class modules:

1. Dashboard
2. Jobs
3. Accounts
4. Artwork/Templates
5. Stock/Purchasing
6. Warehouse
7. Production
8. Communications
9. Admin/Integrations

Responsibilities:
- fast operational UI
- filtered work queues
- unified job detail
- review/exception handling

### 2. Backend Orchestration Core (Fastify + Worker)

Core domain services:
- `Job Ingestion Service`
- `Account Matching Engine`
- `Job Configuration Service`
- `Deco Sync/Push Service`
- `Stock/Purchasing Service`
- `Warehouse Receiving Service`
- `Production Routing Service`
- `Communications Service`
- `Audit Service`

Core rule engine:
- state machine in `backend/src/domain/job-state-machine.ts`
- status model in `backend/src/domain/job-status.ts`

### 3. Integration Boundary

Adapters only:
- Shopify adapter (webhooks + order pull)
- Deco adapter (customer/design/template/product/inventory sync + job push)
- Gmail adapter (messages/proofs/replies)
- Slack adapter (alerts/events)

Adapters publish normalized events into the orchestration core.
They do not own workflow state.

### 4. Persistence + Async

- PostgreSQL canonical model
- Redis + BullMQ async processing
- Event Inbox (idempotent inbound handling)
- Activity/Audit timeline

## Canonical Job Data Model

The internal `Order` (canonical job) is the single source of operational truth.

Critical fields include:
- source refs (`shopifyOrderId`, `decoOrderId`, customer refs)
- account match status + confidence + reason
- review flags and review reasons
- metadata snapshot from ingestion
- preconfiguration result (assets/templates/placement)
- stock/purchasing/warehouse/production/communication context

Expanded account intelligence model includes:
- `Account`
- `AccountAlias`
- `AccountAsset`
- `AccountPlacementConfig`
- `AccountProductRule`

## State Model

Main lifecycle:
- `ingested`
- `classified`
- `configured`
- `pushed_to_deco`
- `awaiting_stock`
- `stock_received`
- `production_queued`
- `in_production`
- `completed`
- `cancelled`
- `on_hold`

Parallel sub-statuses:
- classification status
- configuration status
- stock status
- production status
- approval status

Transition and blocker logic is centralized in:
- `backend/src/domain/job-state-machine.ts`

## Module-Level Backend Design

### Ingestion
- receives Shopify webhooks/backfill events
- normalizes payload
- upserts canonical job + line items
- runs account/template preconfiguration

### Accounts + Templates
- aliases and scoring-based matching
- asset/template lookups
- product rule matching and placement defaults
- confidence and review flagging

### Deco Linkage
- uses matched account and asset/template refs
- builds prepared Deco payload
- stores push readiness and sync results

### Stock + Purchasing
- tracks manual supplier order references/ETA
- marks stock gate states
- surfaces shortages/blockers

### Warehouse
- logs scan-in and receipt events
- supports partial/full receipt
- unblocks production gating when complete

### Production
- routes to department lanes (embroidery/dtf/mixed)
- tracks queue/in-progress/QC/complete

### Communications
- appends Gmail/Slack/internal events to job timeline

### Audit
- every major state/configuration change is logged with context

## UI Screen Structure

### Dashboard
- operational cards and blocker queues
- “needs review”, “awaiting stock”, “ready for production”, “overdue”

### Jobs
- canonical job list with lanes + filters
- open job to unified detail cockpit

### Accounts
- account profile, aliases, linked systems
- default assets/templates/rules

### Artwork/Templates
- account-linked asset packs and placement rules
- active/inactive/superseded management

### Stock/Purchasing
- supplier ordering board
- ETA and shortage tracking

### Warehouse
- receiving queue and scan log
- partial/full receipt state

### Production
- department boards + operator-ready job cards

### Communications
- Gmail timeline + approval events + internal notes + Slack event log

### Admin/Integrations
- sync controls, mapping and exception tooling

## Implementation Order

### Phase 1: Foundation
- canonical schema
- state machine + blockers
- event inbox + queue + audit log
- module-first UI shell

### Phase 2: Account/Template Intelligence
- account matching engine
- alias management
- asset/template/rule model
- preconfiguration + review queue

### Phase 3: Stock + Warehouse
- purchasing workflow
- receiving scans
- stock blockers and lifecycle gates

### Phase 4: Production + Communications
- department routing
- production boards + QC
- Gmail/Slack timeline integration

### Phase 5: Optimization
- SLA metrics
- exception analytics
- bulk action tooling
- resilience and sync repair workflows

