# Account-Aware + Template-Aware Workflow

This extends Stash Ops from "order sync" into "intelligent preparation" for repeat decorated jobs.

## 1) Matching Engine Design

### Goal
Automatically match each incoming Shopify order to the correct internal account (school/club/client) with confidence scoring.

### Inputs
- Shopify order tags
- Shopify note attributes
- Shopify custom metafields
- Line-item properties
- Billing/shipping company fields
- Customer/company text hints

### Matching strategy
1. Extract normalized tokens/signals from Shopify payload.
2. Exact alias match against `AccountAlias.aliasNormalized`.
3. Fuzzy account candidate search by account name + alias partial matches.
4. Score candidates by:
   - alias weight
   - signal source quality (metafield > note attribute > tag > free text)
   - account type alignment (school/club signal boost)
   - lead over second-best candidate
5. Emit `MatchStatus`:
   - `AUTO_MATCHED`
   - `REVIEW_REQUIRED`
   - `UNMATCHED`

### Output
- matched account (if any)
- confidence score
- reasons + candidate leaderboard
- extracted order context for auditability

Implemented in:
- `backend/src/services/shopify-order-context.ts`
- `backend/src/services/account-matching-engine.ts`

## 2) Database Schema (Accounts / Assets / Rules)

Core new entities:
- `Account`
- `AccountAlias`
- `AccountAsset`
- `AccountPlacementConfig`
- `AccountProductRule`

Order-level extensions:
- `Order.accountId`
- `Order.accountMatchStatus`
- `Order.accountMatchScore`
- `Order.accountMatchReason`
- `Order.requiresReview`
- `Order.reviewReason`
- `Order.shopifyMetadata`
- `Order.preconfiguration`
- `Order.preconfiguredAt`

Enums:
- `AccountType`
- `MatchStatus`
- `AssetType`
- `ProductMatcherType`

Source of truth schema:
- `backend/prisma/schema.prisma`

## 3) Order Ingestion Logic Using Shopify Metadata / Metafields

Flow:
1. Shopify webhook/backfill event enters `EventInbox`.
2. Worker processes order event.
3. Base order + line items are upserted.
4. Account-aware pipeline runs:
   - extract metadata signals
   - match account
   - apply product/template/placement rules
   - persist preconfiguration + review flags
5. Activity log entries are written for traceability.

Implemented in:
- `backend/src/services/order-service.ts` (ingestion orchestration)
- `backend/src/services/order-account-preconfiguration.ts` (automation step)

## 4) Deco Customer / Design Linking Logic

Account-level linkage:
- `Account.decoCustomerId` maps to Deco customer account.
- `AccountAsset.decoDesignId` / `decoTemplateId` map to Deco design/template references.

Order-level prepared linkage:
- Preconfiguration stores `decoLinkage` block:
  - `decoCustomerId`
  - list of design IDs
  - list of template IDs
- `readyForDecoPush` is true only when match/rules do not require review and Deco customer exists.

Deco payload builder:
- `backend/src/services/deco-linking-service.ts`
- endpoint: `GET /api/v1/orders/:orderId/deco-prepared`

## 5) Rule-Based Automatic Placement Logic

Rule resolver per line item:
1. Find highest-priority matching `AccountProductRule`.
2. Resolve decoration method:
   - rule override -> account default -> line fallback.
3. Resolve asset:
   - rule asset -> account default asset (scoped by method).
4. Resolve placement:
   - rule placement -> account default placement (scoped by method).
5. Build line recommendation + confidence score.

Each recommendation includes:
- chosen rule
- chosen asset/template
- placement geometry (`widthMm`, `heightMm`, offsets, rotation)
- `reviewRequired` + reasons if any part missing/ambiguous.

Implemented in:
- `backend/src/services/order-account-preconfiguration.ts`

## 6) Fallback Review Flow

Order is automatically flagged for review if:
- no confident account match
- match is ambiguous (score lead too low)
- no usable rule for line item
- no default asset/template
- no placement config
- rule explicitly requires review

Review handling:
- `Order.requiresReview = true`
- `Order.reviewReason` populated
- preconfiguration contains candidate accounts + review reasons
- activity log records the reason
- review queue endpoint:
  - `GET /api/v1/orders/review/matching`

## 7) Full Implementation File Structure

### Data model
- `backend/prisma/schema.prisma`

### Matching + rule engine
- `backend/src/services/shopify-order-context.ts`
- `backend/src/services/account-matching-engine.ts`
- `backend/src/services/order-account-preconfiguration.ts`
- `backend/src/services/deco-linking-service.ts`

### Ingestion wiring
- `backend/src/services/order-service.ts`
- `backend/src/worker.ts`

### API routes
- `backend/src/routes/account-routes.ts`
- `backend/src/routes/order-routes.ts`
- `backend/src/routes/index.ts`

### Existing supporting infrastructure
- `backend/src/services/event-inbox-service.ts`
- `backend/src/services/shopify-service.ts`
- `backend/src/queue/*`
- `backend/src/lib/*`

