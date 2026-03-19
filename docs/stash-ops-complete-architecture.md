# Stash Ops — Complete System Architecture

> Unified internal operations platform for garment decoration.
> One canonical job record. Shopify and Deco are data sources, not masters.

---

## A. SYSTEM ARCHITECTURE

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                     EXPERIENCE LAYER (Next.js)                      │
│  Dashboard │ Jobs │ Accounts │ Artwork │ Stock │ Warehouse │ Prod   │
│  Communications │ Admin/Integrations                                │
├─────────────────────────────────────────────────────────────────────┤
│                  BACKEND API (Fastify + BullMQ Worker)              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  ORCHESTRATION CORE                            │ │
│  │  Job Ingestion → Account Matching → Preconfiguration          │ │
│  │  Job Configuration → Deco Push → Stock Gate → Production      │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                  DOMAIN SERVICES                               │ │
│  │  Job Ingestion Service      │  Account Matching Engine         │ │
│  │  Job Configuration Service  │  Deco Sync/Push Service          │ │
│  │  Stock/Purchasing Service   │  Warehouse Receiving Service     │ │
│  │  Production Routing Service │  Communications Service          │ │
│  │  Audit/Activity Service     │  Event Inbox Service             │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                  DOMAIN MODEL                                  │ │
│  │  Job State Machine (lifecycle + sub-statuses + blockers)       │ │
│  │  Job Status Enums + Workflow Snapshot                          │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │                  INTEGRATION ADAPTERS                          │ │
│  │  Shopify Adapter    │  Deco Adapter                            │ │
│  │  Gmail Adapter      │  Slack Adapter                           │ │
│  │  (adapters publish events into orchestration core)             │ │
│  └────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                    PERSISTENCE + ASYNC                              │
│  PostgreSQL (Prisma) │ Redis (BullMQ) │ Event Inbox │ Activity Log │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
External Event (Shopify webhook / Deco sync / Gmail / Slack)
    │
    ▼
Integration Adapter (normalize + HMAC verify)
    │
    ▼
Event Inbox (idempotency key dedup)
    │
    ▼
BullMQ Queue → Worker picks up event
    │
    ▼
Orchestration Core:
    ├─ Upsert canonical Job record
    ├─ Run Account Matching Engine
    ├─ Run Preconfiguration (assets/templates/placements)
    ├─ Evaluate State Machine (lifecycle + sub-statuses)
    ├─ Evaluate Blockers
    ├─ Write Activity Log entries
    └─ Queue outbound events (Slack alerts, Deco push, etc.)
```

### Module ↔ Service Mapping

| UI Module           | Primary Backend Service(s)                                    |
|---------------------|--------------------------------------------------------------|
| Dashboard           | All services (aggregated operational queries)                |
| Jobs                | Job Ingestion, Job Configuration, Account Matching           |
| Accounts            | Account Matching Engine, Prisma account/alias/asset CRUD     |
| Artwork/Templates   | Account asset/placement CRUD, Deco Sync Service              |
| Stock/Purchasing    | Stock/Purchasing Service                                     |
| Warehouse           | Warehouse Receiving Service                                  |
| Production          | Production Routing Service                                   |
| Communications      | Communications Service (Gmail + Slack adapters)              |
| Admin/Integrations  | Event Inbox Service, Sync routes, Audit Service              |

### Integration Boundaries

Each external system has ONE adapter that normalizes its data into the internal model:

- **Shopify Adapter**: webhooks (orders/create, orders/updated, fulfillments/create) + REST backfill. Produces `ShopifyOrderPayload` → feeds `Job Ingestion Service`.
- **Deco Adapter**: sync pull (customers, designs, templates, products, inventory) + push (prepared job payload). Reads/writes via `Deco Sync Service`.
- **Gmail Adapter**: webhook for inbound messages, API for sending proofs/updates. Feeds `Communications Service`.
- **Slack Adapter**: bot token for posting alerts. Reads from `Audit Service` triggers.

Adapters do NOT own workflow state. They publish normalized events. The orchestration core owns all state transitions.

---

## B. CANONICAL DATABASE SCHEMA

### Entity Relationship Summary

```
Account ────────── AccountAlias (1:N)
  │                AccountAsset (1:N)
  │                AccountPlacementConfig (1:N)
  │                AccountProductRule (1:N)
  │
  └─── Job (N:1) ─── JobItem (1:N)
         │            JobItemRecommendation (1:1 per item)
         │
         ├─── ExternalLink (1:N)
         ├─── JobStockRequirement (1:N per item)
         ├─── WarehouseReceipt (1:N)
         ├─── WarehouseScanEvent (1:N)
         ├─── Communication (1:N)
         ├─── ActivityLog (1:N)
         └─── EventInbox (referenced)
```

### Core Tables (Prisma Models)

Below is the complete extended schema. Models already in place are preserved and extended. New models are added for stock, warehouse, production, communications, and the richer job record.

#### Enums

```prisma
enum JobSource {
  SHOPIFY
  MANUAL
  DECO
}

enum MainLifecycle {
  INGESTED
  CLASSIFIED
  CONFIGURED
  PUSHED_TO_DECO
  AWAITING_STOCK
  STOCK_RECEIVED
  PRODUCTION_QUEUED
  IN_PRODUCTION
  COMPLETED
  ON_HOLD
  CANCELLED
}

enum ClassificationStatus {
  UNCLASSIFIED
  ACCOUNT_MATCHED
  ACCOUNT_REVIEW_NEEDED
  ASSET_REVIEW_NEEDED
  RULE_REVIEW_NEEDED
  METHOD_REVIEW_NEEDED
  CLASSIFIED_READY
}

enum ConfigurationStatus {
  NOT_STARTED
  IN_PROGRESS
  READY_FOR_CONFIRMATION
  CONFIRMED
  PUSHED_TO_DECO
  DECO_PUSH_FAILED
}

enum StockStatus {
  NOT_REQUIRED
  AWAITING_ORDER
  ORDERED
  AWAITING_ARRIVAL
  PARTIALLY_RECEIVED
  FULLY_RECEIVED
  STOCK_ISSUE
}

enum ProductionStatus {
  NOT_READY
  QUEUED_EMBROIDERY
  QUEUED_DTF
  QUEUED_MIXED
  IN_EMBROIDERY
  IN_DTF
  IN_MIXED
  QC
  READY_FOR_DISPATCH
  COMPLETE
}

enum ApprovalStatus {
  NOT_REQUIRED
  AWAITING_ARTWORK
  PROOF_IN_PROGRESS
  PROOF_SENT
  AWAITING_CUSTOMER_APPROVAL
  APPROVED
  CHANGES_REQUESTED
  REJECTED
}

enum ProductionDepartment {
  EMBROIDERY
  DTF
  MIXED
}

enum AccountType {
  SCHOOL
  CLUB
  CLIENT
  OTHER
}

enum MatchStatus {
  AUTO_MATCHED
  MANUAL_MATCHED
  REVIEW_REQUIRED
  UNMATCHED
}

enum AssetType {
  LOGO
  TEMPLATE
  DESIGN_REFERENCE
  PROOF
}

enum AssetStatus {
  ACTIVE
  INACTIVE
  SUPERSEDED
}

enum ProductMatcherType {
  ANY
  SKU_EXACT
  SKU_PREFIX
  SKU_CONTAINS
  TITLE_CONTAINS
  TAG_CONTAINS
  METAFIELD_EQUALS
}

enum ExternalProvider {
  SHOPIFY_ORDER
  SHOPIFY_FULFILLMENT
  DECO_ORDER
  DECO_CUSTOMER
  GMAIL_THREAD
  SLACK_CHANNEL
  SHIPSTATION_LABEL
}

enum EventProvider {
  SHOPIFY
  DECO
  GMAIL
  SLACK
  MANUAL
  SYSTEM
}

enum EventStatus {
  RECEIVED
  PROCESSED
  FAILED
  IGNORED
}

enum CommunicationChannel {
  GMAIL
  SLACK
  INTERNAL_NOTE
}

enum CommunicationDirection {
  INBOUND
  OUTBOUND
  INTERNAL
}

enum Urgency {
  NORMAL
  RUSH
  CRITICAL
}
```

#### Job (canonical internal job record)

```prisma
model Job {
  id                    String               @id @default(cuid())
  internalJobId         String               @unique  // e.g. ST-1234
  source                JobSource

  // ── Main lifecycle + sub-statuses ──
  lifecycle             MainLifecycle        @default(INGESTED)
  classificationStatus  ClassificationStatus @default(UNCLASSIFIED)
  configurationStatus   ConfigurationStatus  @default(NOT_STARTED)
  stockStatus           StockStatus          @default(NOT_REQUIRED)
  productionStatus      ProductionStatus     @default(NOT_READY)
  approvalStatus        ApprovalStatus       @default(NOT_REQUIRED)
  assignedDepartment    ProductionDepartment?

  // ── External references ──
  shopifyOrderId        String?
  shopifyOrderName      String?
  decoOrderId           String?
  shopifyCustomerId     String?
  decoCustomerId        String?

  // ── Account context ──
  accountId             String?
  accountMatchStatus    MatchStatus          @default(UNMATCHED)
  accountMatchScore     Int?
  accountMatchReason    String?

  // ── Review / blocking ──
  requiresReview        Boolean              @default(false)
  reviewReason          String?
  blockedReason         String?

  // ── Customer context ──
  customerName          String?
  customerEmail         String?
  customerCompany       String?
  schoolName            String?
  clubName              String?
  leaversYear           String?

  // ── Commercial ──
  currencyCode          String               @default("GBP")
  subtotalMinor         Int?
  totalMinor            Int                  @default(0)
  urgency               Urgency              @default(NORMAL)
  orderPlacedAt         DateTime?
  dueAt                 DateTime?
  owner                 String?
  tags                  String[]             @default([])
  orderNotes            String?

  // ── Source group (school/club/company grouping) ──
  sourceGroupKey        String?
  sourceGroupLabel      String?
  sourceGroupType       String?

  // ── Metadata snapshots ──
  shopifyMetadata       Json?   // original Shopify tags, notes, metafields
  preconfiguration      Json?   // result of account matching + rule engine
  preconfiguredAt       DateTime?

  // ── Deco push context ──
  pushToDecoStatus      String?   // ready | pushed | failed
  lastDecoPushAt        DateTime?
  decoPushErrors        String?

  // ── Artwork / proof ──
  proofVersion          String?
  proofSentAt           DateTime?
  approvedAt            DateTime?
  rejectedAt            DateTime?
  approvalNotes         String?

  // ── Production ──
  productionStartedAt   DateTime?
  productionCompletedAt DateTime?
  productionNotes       String?

  // ── Relations ──
  items                 JobItem[]
  externalLinks         ExternalLink[]
  stockRequirements     JobStockRequirement[]
  warehouseReceipts     WarehouseReceipt[]
  communications        Communication[]
  activityLogs          ActivityLog[]
  account               Account?             @relation(fields: [accountId], references: [id], onDelete: SetNull)

  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  @@index([lifecycle])
  @@index([classificationStatus])
  @@index([configurationStatus])
  @@index([stockStatus])
  @@index([productionStatus])
  @@index([approvalStatus])
  @@index([assignedDepartment])
  @@index([shopifyOrderId])
  @@index([decoOrderId])
  @@index([accountId])
  @@index([accountMatchStatus])
  @@index([requiresReview])
  @@index([sourceGroupKey])
  @@index([dueAt])
  @@index([urgency])
}
```

#### JobItem (line items within a job)

```prisma
model JobItem {
  id                  String    @id @default(cuid())
  jobId               String
  externalLineId      String?   // Shopify line item ID
  sku                 String?
  productTitle        String
  variantTitle        String?
  quantity            Int
  unitPriceMinor      Int?
  totalPriceMinor     Int?
  garmentReference    String?   // wholesaler garment ref
  decorationMethod    String?   // embroidery | dtf | both | review_needed
  decorationPlacement String?   // left_chest | back | etc

  // ── Preconfiguration recommendation (denormalized for speed) ──
  matchedRuleId       String?
  matchedAssetId      String?
  matchedPlacementId  String?
  recommendedMethod   String?
  recommendationScore Int?
  lineReviewRequired  Boolean   @default(false)
  lineReviewReasons   String[]  @default([])

  // ── Custom options from Shopify properties ──
  customOptions       Json?     // initials, names list, sizing info
  metadata            Json?

  job                 Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)
  stockRequirement    JobStockRequirement?

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@index([jobId])
  @@index([sku])
}
```

#### JobStockRequirement (per-item stock tracking)

```prisma
model JobStockRequirement {
  id                String    @id @default(cuid())
  jobId             String
  jobItemId         String    @unique
  requiredQuantity  Int
  receivedQuantity  Int       @default(0)
  status            StockStatus @default(AWAITING_ORDER)

  // ── Supplier tracking ──
  supplierName      String?
  supplierReference String?   // PO number or web order ref
  supplierNotes     String?
  eta               DateTime?

  // ── Blocking ──
  isBlocking        Boolean   @default(true)  // blocks production?
  shortageFlag      Boolean   @default(false)

  job               Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)
  jobItem           JobItem   @relation(fields: [jobItemId], references: [id], onDelete: Cascade)

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([jobId])
  @@index([status])
}
```

#### WarehouseReceipt + WarehouseScanEvent

```prisma
model WarehouseReceipt {
  id              String               @id @default(cuid())
  jobId           String
  receivedBy      String
  branch          String               @default("HQ")
  isPartial       Boolean              @default(true)
  totalReceived   Int                  @default(0)
  notes           String?
  receivedAt      DateTime             @default(now())

  scanEvents      WarehouseScanEvent[]
  job             Job                  @relation(fields: [jobId], references: [id], onDelete: Cascade)

  createdAt       DateTime             @default(now())

  @@index([jobId])
  @@index([receivedAt])
}

model WarehouseScanEvent {
  id              String           @id @default(cuid())
  receiptId       String
  sku             String
  barcode         String?
  quantity        Int
  scannedBy       String
  location        String?           // shelf, bay, zone
  scannedAt       DateTime          @default(now())

  receipt         WarehouseReceipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)

  @@index([receiptId])
  @@index([sku])
}
```

#### Communication

```prisma
model Communication {
  id                  String                 @id @default(cuid())
  jobId               String
  channel             CommunicationChannel
  direction           CommunicationDirection
  subject             String
  bodyPreview         String?
  bodyHtml            String?
  providerMessageId   String?                // Gmail message ID, Slack ts
  providerThreadId    String?                // Gmail thread ID, Slack channel
  attachments         Json                   @default("[]")
  sentBy              String?
  sentAt              DateTime?
  createdAt           DateTime               @default(now())

  job                 Job                    @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
  @@index([channel])
  @@index([providerThreadId])
}
```

#### Account (extended)

```prisma
model Account {
  id                      String                   @id @default(cuid())
  key                     String                   @unique
  name                    String
  type                    AccountType              @default(CLIENT)
  active                  Boolean                  @default(true)
  decoCustomerId          String?
  shopifyCustomerIds      String[]                 @default([])
  defaultDecorationMethod String?
  defaultProductionNotes  String?
  notes                   String?
  metadata                Json?

  aliases                 AccountAlias[]
  assets                  AccountAsset[]
  placementConfigs        AccountPlacementConfig[]
  productRules            AccountProductRule[]
  jobs                    Job[]

  createdAt               DateTime                 @default(now())
  updatedAt               DateTime                 @updatedAt

  @@index([name])
  @@index([decoCustomerId])
  @@index([type])
}
```

#### AccountAsset (extended with status)

```prisma
model AccountAsset {
  id               String              @id @default(cuid())
  accountId        String
  assetType        AssetType
  assetStatus      AssetStatus         @default(ACTIVE)
  label            String
  decoDesignId     String?
  decoTemplateId   String?
  fileUrl          String?
  colorway         String?
  decorationMethod String?
  isDefault        Boolean             @default(false)
  priority         Int                 @default(100)
  active           Boolean             @default(true)
  metadata         Json?
  account          Account             @relation(fields: [accountId], references: [id], onDelete: Cascade)
  productRules     AccountProductRule[] @relation("RuleAsset")

  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  @@index([accountId, assetType, active])
  @@index([assetStatus])
}
```

#### Remaining Account Models (unchanged logic, preserved)

`AccountAlias`, `AccountPlacementConfig`, `AccountProductRule` — as currently defined in the existing Prisma schema. No structural changes needed.

#### ExternalLink, EventInbox, ActivityLog, SyncCursor

These remain as currently defined. `ExternalLink.provider` enum is extended with `DECO_CUSTOMER`.

---

## C. TOP-LEVEL SCREEN STRUCTURE

### Navigation

```
01  Dashboard       /                    Operational command view
02  Jobs            /jobs                Canonical workflow record
03  Accounts        /accounts            School/club intelligence
04  Artwork         /artwork-templates   Templates and logo packs
05  Stock           /stock-purchasing    Supplier and ETA control
06  Warehouse       /warehouse           Scan-in and receipt flow
07  Production      /production          Department queue routing
08  Comms           /communications      Gmail + Slack timeline
09  Admin           /admin               Integrations and control room
```

### Screen Details

#### 1. Dashboard `/`

| Section | Content |
|---------|---------|
| Metric cards | Jobs awaiting classification, config pending, stock blocked, production-ready, overdue |
| Intake queue | Jobs requiring review (account unmatched, assets missing) |
| Stock blockers | Jobs where stock is blocking progression |
| Warehouse gate | Pending receipt tasks |
| Production flow | Department-ready lanes with counts |
| Comms load | Unread messages, awaiting replies, proof approvals due |

#### 2. Jobs `/jobs`

| Section | Content |
|---------|---------|
| Manual intake form | Create manual internal job |
| Active pipeline | All active jobs grouped by source/account, filterable by lifecycle, department, account, due date, review state |
| Completed lane | Fulfilled/completed jobs |
| Review queue | Jobs flagged for review (account mismatch, asset gaps, rule conflicts) |

##### Unified Job Detail `/jobs/[jobId]`

Tabs/panels on the unified job screen:

| Tab | Content |
|-----|---------|
| **Overview** | Internal job ID, source, lifecycle state, sub-statuses, urgency, due date, owner, assigned department, active blockers |
| **Account** | Matched account, school/club/company, linked Shopify customer, linked Deco customer, confidence score, review state, prior order history |
| **Items** | Line items with product, quantity, variant, sizes, colours, custom options, decoration method per item |
| **Branding/Artwork** | Matched logos/templates per item, asset previews, placement rules, production method, initials/names data, proof status |
| **Deco** | Deco customer link, Deco order link, linked designs, push status, sync history, errors |
| **Stock/Purchasing** | Per-item supplier, supplier reference, stock state, ETA, receipt progress, shortage issues |
| **Warehouse** | Scan-in records, received quantities, timestamps, branch/location |
| **Production** | Assigned department, queue position, production notes, status, completion markers |
| **Communications** | Gmail thread timeline, proof sends, customer replies, internal notes, Slack events |
| **Activity Log** | All state changes with actor, timestamp, before/after for key fields |

#### 3. Accounts `/accounts`

| Section | Content |
|---------|---------|
| Account list | All accounts with type badge, alias count, asset count, rule count, linked Deco ID |
| Account detail `/accounts/[accountId]` | Full account profile: aliases, assets (with status badges), placement configs, product rules, linked jobs history |
| Alias management | Add/edit/deactivate aliases, weight adjustment |
| Asset management | Upload/link logos, set default, set status (active/inactive/superseded) |
| Rule builder | Create product rules with matcher type, link assets and placements |

#### 4. Artwork/Templates `/artwork-templates`

| Section | Content |
|---------|---------|
| Asset packs | Grid of all account assets across all accounts, filterable by type (logo/template/design ref/proof), status, account |
| Template sets | Grouped by account with placement previews |
| Placement library | All placement configs with geometry details |

#### 5. Stock/Purchasing `/stock-purchasing`

| Section | Content |
|---------|---------|
| Supplier ordering board | All stock requirements grouped by status (awaiting order → ordered → awaiting arrival → received) |
| Per-row actions | Mark as ordered, enter supplier ref, enter ETA, flag shortage |
| Blocker view | Jobs blocked by stock with urgency sorting |

#### 6. Warehouse `/warehouse`

| Section | Content |
|---------|---------|
| Receiving queue | Jobs awaiting goods-in, sorted by ETA |
| Scan-in form | Barcode/SKU entry, quantity, branch selector |
| Receipt log | Recent receipts with partial/full status |
| Production gate | Jobs unlocked for production by this receipt |

#### 7. Production `/production`

| Section | Content |
|---------|---------|
| Department boards | Embroidery queue, DTF queue, Mixed queue |
| Job cards | Internal job ID, customer/account, garment/product, quantity, placements, selected assets, notes, due date, urgency |
| Status controls | Move between queued → in progress → QC → ready for dispatch → complete |

#### 8. Communications `/communications`

| Section | Content |
|---------|---------|
| Gmail timeline | All job-linked email threads |
| Proof/approval events | Proof sent, customer approved, changes requested |
| Internal notes | Staff notes attached to jobs |
| Slack events | Alert history with linked job references |

#### 9. Admin `/admin`

| Section | Content |
|---------|---------|
| Sync control room | Per-provider sync status, trigger sync, backfill controls |
| Integration health | Adapter status board |
| Event inbox | Recent events with status (received/processed/failed) |
| Mapping rules | Account alias bulk management |
| Audit tools | Activity log search across all jobs |
| Exception lane | Failed events, Deco push failures, stock issues |

---

## D. JOB STATE MACHINE

### Main Lifecycle States

```
INGESTED → CLASSIFIED → CONFIGURED → PUSHED_TO_DECO → AWAITING_STOCK
                                                            │
                                                            ▼
                              COMPLETED ← IN_PRODUCTION ← PRODUCTION_QUEUED ← STOCK_RECEIVED
```

Any state can transition to `ON_HOLD` or `CANCELLED`.
`ON_HOLD` can return to `CLASSIFIED`, `CONFIGURED`, or `AWAITING_STOCK`.

### Transition Map

```
ingested        → [classified, on_hold, cancelled]
classified      → [configured, on_hold, cancelled]
configured      → [pushed_to_deco, awaiting_stock, production_queued, on_hold, cancelled]
pushed_to_deco  → [awaiting_stock, production_queued, on_hold, cancelled]
awaiting_stock  → [stock_received, on_hold, cancelled]
stock_received  → [production_queued, on_hold, cancelled]
production_queued → [in_production, on_hold, cancelled]
in_production   → [completed, on_hold, cancelled]
completed       → []
on_hold         → [classified, configured, awaiting_stock, cancelled]
cancelled       → []
```

Note: `configured` can skip to `production_queued` when stock is not required and Deco push is optional.

### Parallel Sub-Status Tracks

Each job carries parallel sub-statuses that are evaluated independently:

#### Classification Status
```
UNCLASSIFIED → ACCOUNT_MATCHED → CLASSIFIED_READY
             → ACCOUNT_REVIEW_NEEDED → (manual resolution) → ACCOUNT_MATCHED
             → ASSET_REVIEW_NEEDED
             → RULE_REVIEW_NEEDED
             → METHOD_REVIEW_NEEDED
```

#### Configuration Status
```
NOT_STARTED → IN_PROGRESS → READY_FOR_CONFIRMATION → CONFIRMED → PUSHED_TO_DECO
                                                                → DECO_PUSH_FAILED
```

#### Stock Status
```
NOT_REQUIRED (no stock gate)
AWAITING_ORDER → ORDERED → AWAITING_ARRIVAL → PARTIALLY_RECEIVED → FULLY_RECEIVED
                                                                  → STOCK_ISSUE
```

#### Production Status
```
NOT_READY → QUEUED_EMBROIDERY ─┐
          → QUEUED_DTF ────────┤
          → QUEUED_MIXED ──────┤
                               ▼
            IN_EMBROIDERY ─────┐
            IN_DTF ────────────┤
            IN_MIXED ──────────┤
                               ▼
                              QC → READY_FOR_DISPATCH → COMPLETE
```

#### Approval Status
```
NOT_REQUIRED (no approval gate)
AWAITING_ARTWORK → PROOF_IN_PROGRESS → PROOF_SENT → AWAITING_CUSTOMER_APPROVAL
                                                      │
                                                      ├─ APPROVED
                                                      ├─ CHANGES_REQUESTED → back to AWAITING_ARTWORK
                                                      └─ REJECTED
```

### Gating Rules

Transition to target lifecycle requires these gates:

| Target | Gates |
|--------|-------|
| `CLASSIFIED` | `classificationStatus` must be `ACCOUNT_MATCHED` or `CLASSIFIED_READY` |
| `CONFIGURED` | `configurationStatus` must be `READY_FOR_CONFIRMATION` or `CONFIRMED` |
| `PUSHED_TO_DECO` | Account matched + Deco customer linked + assets selected + placements set + method confirmed + review flags cleared + `configurationStatus = CONFIRMED` |
| `AWAITING_STOCK` | `stockStatus ≠ NOT_REQUIRED` |
| `STOCK_RECEIVED` | `stockStatus = FULLY_RECEIVED` |
| `PRODUCTION_QUEUED` | `productionStatus` is one of `QUEUED_*` + approval gate satisfied + stock gate satisfied (or `NOT_REQUIRED`) |
| `IN_PRODUCTION` | `productionStatus` is one of `IN_*` + department assigned |
| `COMPLETED` | `productionStatus = COMPLETE` |

### Blocker Types

Each job is evaluated for active blockers:

| Blocker | Condition | Hard block? |
|---------|-----------|-------------|
| `account` | No matched account or classification = `ACCOUNT_REVIEW_NEEDED` | Yes |
| `asset` | No required assets or classification = `ASSET_REVIEW_NEEDED` | Yes |
| `rule` | No placement config or classification = `RULE_REVIEW_NEEDED` | Yes |
| `method` | No production method or classification = `METHOD_REVIEW_NEEDED` | Yes |
| `approval` | Approval not cleared (awaiting/changes_requested/rejected) | Yes |
| `stock` | Stock not fully received when required | Yes |
| `warehouse` | Partial receipt only, ratio < 1.0 | Yes |
| `deco_push` | Deco push previously failed | Yes |
| `production` | No department assigned when in production queue | Yes |
| `review` | Unresolved review flags > 0 | Yes |

### Workflow Snapshot

The state machine evaluates a `JobWorkflowSnapshot` — a flat projection of the job's current state across all sub-status tracks:

```typescript
type JobWorkflowSnapshot = {
  lifecycle: MainLifecycleState;
  classification: ClassificationStatus;
  configuration: ConfigurationStatus;
  stock: StockStatus;
  production: ProductionStatus;
  approval: ApprovalStatus;
  hasMatchedAccount: boolean;
  hasDecoCustomerLink: boolean;
  hasRequiredAssets: boolean;
  hasPlacementConfiguration: boolean;
  hasProductionMethod: boolean;
  unresolvedReviewFlags: number;
  receivedQuantityRatio: number;    // 0.0 to 1.0
  requiresStock: boolean;
  assignedDepartment?: ProductionDepartment;
};
```

---

## E. IMPLEMENTATION ORDER

### Phase 1: Foundation (current state + extensions)

**What exists:** Prisma schema with Order/Account models, Shopify ingestion, account matching engine, preconfiguration pipeline, event inbox + BullMQ worker, Next.js 9-module shell.

**What to build:**

1. **Rename `Order` to `Job` across the schema and codebase** — align the canonical record name to the business language. The internal record is a "Job", not an "Order".
2. **Add lifecycle + sub-status columns** — replace the single `workflowStatus` enum with the multi-track state model (`lifecycle`, `classificationStatus`, `configurationStatus`, `stockStatus`, `productionStatus`, `approvalStatus`).
3. **Add missing Job fields** — `schoolName`, `clubName`, `leaversYear`, `urgency`, `tags[]`, `orderNotes`, `pushToDecoStatus`, `decoCustomerId`, `shopifyCustomerId`, `productionNotes`, `productionStartedAt`, `productionCompletedAt`, `assignedDepartment`.
4. **Add `JobItem` recommendation columns** — `matchedRuleId`, `matchedAssetId`, `matchedPlacementId`, `recommendedMethod`, `recommendationScore`, `lineReviewRequired`, `lineReviewReasons`.
5. **Create `JobStockRequirement` model** — per-item stock tracking.
6. **Create `WarehouseReceipt` + `WarehouseScanEvent` models**.
7. **Create `Communication` model**.
8. **Extend `AccountAsset` with `assetStatus` (active/inactive/superseded)**.
9. **Extend `Account` with `shopifyCustomerIds[]`**.
10. **Update state machine** — the existing `job-state-machine.ts` and `job-status.ts` already match the target design. Wire the new Prisma enum values to the domain types.
11. **Write Prisma migration** for all schema changes.
12. **Update `upsertOrderFromShopify`** to populate the new lifecycle/sub-status fields during ingestion.
13. **Update frontend adapters** to read from the new field names.

**Deliverable:** The system operates on the full multi-track state model with all core tables in place.

### Phase 2: Account + Template Intelligence (largely built)

**What exists:** Account matching engine, alias scoring, asset/template/placement/rule models, preconfiguration pipeline.

**What to build:**

1. **Account detail screen** — full CRUD for aliases, assets, placements, rules via the existing API endpoints.
2. **Review queue UI** — a dedicated screen or panel on the Jobs page showing jobs with `requiresReview = true`, with actions to accept/reject/override match.
3. **Account linking from job detail** — manual account assignment or match override from the unified job screen.
4. **Deco customer sync** — pull Deco customer records into `Account.decoCustomerId` and `AccountAsset.decoDesignId/decoTemplateId`.
5. **Asset status management** — mark assets as active/inactive/superseded in the Artwork/Templates screen.
6. **Preconfiguration result display** — show the full recommendation breakdown (matched rule, chosen asset, chosen placement, confidence, review reasons) on the job detail Branding/Artwork tab.

**Deliverable:** Staff can manage accounts, see intelligent preconfiguration results, handle review queues, and link Deco customers.

### Phase 3: Stock + Warehouse

**What to build:**

1. **Stock requirement creation** — when a job is configured, create `JobStockRequirement` records per item. Default `status = AWAITING_ORDER`.
2. **Stock/Purchasing screen** — supplier ordering board with group-by-status lanes. Actions: mark ordered, enter supplier ref, enter ETA, flag shortage.
3. **API routes** — `GET /api/v1/stock-requirements`, `PATCH /api/v1/stock-requirements/:id` (update status, supplier, ETA).
4. **Warehouse receiving screen** — goods-in form with barcode/SKU entry, quantity, branch selector. Creates `WarehouseReceipt` + `WarehouseScanEvent`.
5. **API routes** — `POST /api/v1/warehouse/receive` (create receipt + scan events), `GET /api/v1/warehouse/receipts`.
6. **Stock gate logic** — when `WarehouseScanEvent` is created, update `JobStockRequirement.receivedQuantity`. When all requirements for a job are fully received, transition `stockStatus → FULLY_RECEIVED` and advance `lifecycle → STOCK_RECEIVED`.
7. **Blocker integration** — stock/warehouse blockers surface in job detail and dashboard.

**Deliverable:** Manual supplier ordering becomes visible and traceable. Warehouse scan-in unlocks production gates automatically.

### Phase 4: Production + Communications

**What to build:**

1. **Production routing** — when stock gate is satisfied and approval gate is satisfied, auto-advance to `PRODUCTION_QUEUED` with department assignment based on decoration method.
2. **Production board** — department-specific queue screens. Each job card shows: internal job ID, customer/account, garment/product, quantity, placements, selected assets, decoration instructions, notes, due date, urgency.
3. **Production status controls** — move jobs through `QUEUED → IN_PROGRESS → QC → READY_FOR_DISPATCH → COMPLETE`.
4. **API routes** — `GET /api/v1/production/queue?department=embroidery`, `PATCH /api/v1/production/:jobId/status`.
5. **Communications model** — `Communication` records linked to jobs. Gmail integration: send proof emails via Gmail API, capture replies via webhook. Link `providerThreadId` for threading.
6. **Communications screen** — unified timeline of Gmail messages, Slack alerts, internal notes per job.
7. **Slack integration** — post alerts on key lifecycle transitions (approval received, stock issue, production ready, dispatch blocker).
8. **API routes** — `POST /api/v1/jobs/:jobId/communications` (send/log), `GET /api/v1/jobs/:jobId/communications`.

**Deliverable:** Production teams see clean, instruction-ready cards. Communications are linked to jobs. Slack provides real-time internal alerts.

### Phase 5: Deco Push + Optimization

**What to build:**

1. **Push to Deco action** — from the job detail Deco tab, trigger `buildDecoPreparedPayload` + HTTP push to Deco bridge. Record success/failure. Update `pushToDecoStatus`, `lastDecoPushAt`, `decoPushErrors`.
2. **Deco sync pull** — scheduled sync of Deco customer/account records, design references, template references, product references into the internal model.
3. **Dashboard refinement** — real metrics from the database: jobs by lifecycle state, blocked count, department queue depths, overdue count, unread comms.
4. **Audit log search** — admin screen to search activity logs across all jobs by actor, event type, date range.
5. **Exception management** — admin screen showing Deco push failures, event inbox failures, stock issues, unmatched jobs.
6. **Performance** — indexed queries for dashboard aggregations, paginated job lists, optimistic UI updates.

**Deliverable:** Full end-to-end workflow from Shopify/manual intake through Deco push, stock ordering, warehouse receipt, production, dispatch, and communication — all in one platform.

---

## F. FILE / FOLDER STRUCTURE

```
frontend/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma                    # Canonical Prisma schema
│   └── src/
│       ├── index.ts                         # Fastify API entry
│       ├── worker.ts                        # BullMQ event worker
│       ├── config/
│       │   └── env.ts                       # Environment config
│       ├── domain/
│       │   ├── job-state-machine.ts         # Lifecycle transitions + blocker evaluation
│       │   └── job-status.ts                # Status enums + JobWorkflowSnapshot type
│       ├── lib/
│       │   ├── logger.ts
│       │   └── prisma.ts
│       ├── queue/
│       │   ├── connection.ts                # Redis/BullMQ connection
│       │   ├── jobs.ts                      # Job payload types
│       │   └── queues.ts                    # Queue definitions
│       ├── routes/
│       │   ├── index.ts                     # Route registration
│       │   ├── health-routes.ts
│       │   ├── account-routes.ts            # Account CRUD + alias/asset/rule management
│       │   ├── job-routes.ts                # Job list, detail, review queue, manual create
│       │   ├── stock-routes.ts              # Stock requirement CRUD
│       │   ├── warehouse-routes.ts          # Receipt + scan-in endpoints
│       │   ├── production-routes.ts         # Department queues + status transitions
│       │   ├── communication-routes.ts      # Message send/log + timeline
│       │   ├── sync-routes.ts               # Shopify backfill, sync status
│       │   └── shopify-webhook-routes.ts    # Shopify webhook ingestion
│       ├── services/
│       │   ├── job-ingestion-service.ts     # Shopify + manual job creation
│       │   ├── account-matching-engine.ts   # Alias scoring + confidence ranking
│       │   ├── shopify-order-context.ts     # Metadata extraction from Shopify payloads
│       │   ├── order-account-preconfiguration.ts  # Rule + asset + placement matching
│       │   ├── job-configuration-service.ts # Review decisions + Deco push readiness
│       │   ├── deco-linking-service.ts      # Deco prepared payload builder
│       │   ├── deco-sync-service.ts         # Deco customer/design/template pull + push
│       │   ├── stock-purchasing-service.ts  # Stock requirement lifecycle
│       │   ├── warehouse-receiving-service.ts # Receipt + scan + stock gate evaluation
│       │   ├── production-routing-service.ts  # Department assignment + queue management
│       │   ├── communications-service.ts    # Gmail send/receive + Slack alerts
│       │   ├── audit-service.ts             # Activity log writes
│       │   ├── event-inbox-service.ts       # Idempotent event storage + queue dispatch
│       │   ├── order-service.ts             # Legacy name - Shopify order upsert
│       │   └── source-group.ts              # Source group inference
│       └── types/
│           └── fastify.d.ts
├── db/
│   └── unified_ops_schema.sql               # Reference SQL schema
├── docs/
│   ├── stash-ops-complete-architecture.md   # This document
│   ├── unified-ops-architecture.md
│   ├── unified-ops-product-architecture.md
│   └── account-aware-template-workflow.md
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                         # Dashboard
│   │   ├── jobs/
│   │   │   ├── page.tsx                     # Job list
│   │   │   └── [jobId]/
│   │   │       └── page.tsx                 # Unified job detail
│   │   ├── accounts/
│   │   │   ├── page.tsx                     # Account list
│   │   │   └── [accountId]/
│   │   │       └── page.tsx                 # Account detail
│   │   ├── artwork-templates/
│   │   │   └── page.tsx                     # Asset/template browser
│   │   ├── stock-purchasing/
│   │   │   └── page.tsx                     # Supplier ordering board
│   │   ├── warehouse/
│   │   │   └── page.tsx                     # Receiving + scan-in
│   │   ├── production/
│   │   │   └── page.tsx                     # Department queue boards
│   │   ├── communications/
│   │   │   └── page.tsx                     # Gmail/Slack/notes timeline
│   │   ├── admin/
│   │   │   └── page.tsx                     # Integrations + sync + audit
│   │   └── api/
│   │       ├── webhooks/
│   │       │   ├── shopify/route.ts
│   │       │   ├── deco/route.ts
│   │       │   ├── gmail/route.ts
│   │       │   └── slack/route.ts
│   │       └── ...                          # Proxy/BFF routes to backend
│   ├── components/
│   │   ├── app-shell.tsx                    # Navigation + layout
│   │   ├── section-card.tsx                 # Reusable section wrapper
│   │   ├── modules/
│   │   │   ├── metric-grid.tsx
│   │   │   ├── orders-table.tsx             # → rename: jobs-table.tsx
│   │   │   ├── stock-purchasing-board.tsx
│   │   │   ├── warehouse-receipts-board.tsx
│   │   │   ├── production-board.tsx
│   │   │   ├── communications-workbench.tsx
│   │   │   └── approvals-board.tsx
│   │   ├── job-cockpit/                     # Unified job detail components
│   │   │   ├── job-cockpit.tsx
│   │   │   ├── job-overview-panel.tsx
│   │   │   ├── job-account-panel.tsx
│   │   │   ├── job-items-panel.tsx
│   │   │   ├── job-branding-panel.tsx
│   │   │   ├── job-deco-panel.tsx
│   │   │   ├── job-stock-panel.tsx
│   │   │   ├── job-warehouse-panel.tsx
│   │   │   ├── job-production-panel.tsx
│   │   │   ├── job-communications-panel.tsx
│   │   │   └── job-activity-panel.tsx
│   │   ├── accounts/
│   │   │   ├── account-detail.tsx
│   │   │   ├── alias-manager.tsx
│   │   │   ├── asset-manager.tsx
│   │   │   └── rule-builder.tsx
│   │   └── integrations/
│   │       └── sync-control-panel.tsx
│   ├── lib/
│   │   ├── backend-api.ts                   # Fetch wrapper to backend
│   │   ├── backend-job-adapter.ts           # Map backend → UI types
│   │   ├── content.ts                       # Shell copy registry
│   │   ├── data-repository.ts               # Server data layer
│   │   ├── format.ts                        # Currency/date formatting
│   │   ├── navigation.ts                    # Navigation items
│   │   ├── presentation.ts                  # UI tone/style helpers
│   │   └── types.ts                         # Frontend type definitions
│   └── server/
│       ├── core/                            # Legacy orchestration (migration target)
│       ├── queries/
│       └── repositories/
└── package.json
```

---

## G. CODING OUTPUT STYLE EXPECTATIONS

- Every service has a single responsibility
- State transitions are centralized in `domain/job-state-machine.ts`
- Blocker evaluation is always run before lifecycle transitions
- Activity log is written for every meaningful state change
- Integration adapters normalize external data before passing to services
- No business logic in route handlers — routes validate input, call services, return results
- Prisma transactions are used for multi-model operations
- Frontend reads from the backend API via `data-repository.ts`
- Components are server components by default; client components only when interactivity is needed
- All user-facing data passes through adapter functions (`backend-job-adapter.ts`) to decouple backend shape from UI shape
