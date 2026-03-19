# Stash Ops Backend

Dedicated orchestration backend for the Stash unified operations platform.

This service is designed for Railway as two deployables:

- `api` process: webhooks, internal API, sync endpoints
- `worker` process: queue-driven event processing and lifecycle transitions

## Stack

- Fastify + TypeScript
- Prisma + PostgreSQL
- BullMQ + Redis
- Shopify webhook ingestion + backfill starter flow

## What this backend already includes

- canonical `Order` model with Shopify/Manual/Deco source support
- `EventInbox` for idempotent webhook/event ingestion
- queue-backed processing worker
- source grouping logic (school/club/company) for order lanes
- account-aware/template-aware auto-configuration pipeline:
  - account matching from Shopify tags/metafields/note attributes/line properties
  - account alias scoring + confidence ranking
  - default logo/template + placement preconfiguration
  - fallback review flags for ambiguous/unmatched orders
- Shopify webhook endpoints:
  - `POST /api/webhooks/shopify/orders-create`
  - `POST /api/webhooks/shopify/orders-updated`
  - `POST /api/webhooks/shopify/fulfillments-create`
- order endpoints:
  - `GET /api/v1/orders?lane=active|fulfilled|all`
  - `GET /api/v1/orders/review/matching`
  - `GET /api/v1/orders/:orderId/deco-prepared`
  - `POST /api/v1/orders/manual`
- account setup endpoints:
  - `GET /api/v1/accounts`
  - `GET /api/v1/accounts/:accountId`
  - `POST /api/v1/accounts`
  - `POST /api/v1/accounts/:accountId/aliases`
  - `POST /api/v1/accounts/:accountId/assets`
  - `POST /api/v1/accounts/:accountId/placement-configs`
  - `POST /api/v1/accounts/:accountId/product-rules`
- sync endpoints:
  - `POST /api/sync/shopify/backfill`
  - `GET /api/sync/status`
- health endpoints:
  - `GET /api/health`
  - `GET /api/ready`

## Local run

1. Copy env file:

```bash
cp .env.example .env
```

2. Install packages:

```bash
npm install
```

3. Generate Prisma client and apply schema:

```bash
npm run prisma:generate
npm run prisma:push
```

4. Run API and worker:

```bash
npm run dev
npm run dev:worker
```

## Railway deployment

Use one GitHub repo with two Railway services, both rooted at `backend/`:

- Service A: `stash-api`
  - Start command: `npm run start`
- Service B: `stash-worker`
  - Start command: `npm run start:worker`

Attach shared Postgres + Redis, and set the same environment variables on both services.

## Required env vars

- `DATABASE_URL`
- `REDIS_URL`
- `FRONTEND_ORIGIN`
- `SHOPIFY_DOMAIN`
- `SHOPIFY_ACCESS_TOKEN`
- `SHOPIFY_WEBHOOK_SECRET`
