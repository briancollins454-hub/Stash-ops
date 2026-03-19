-- Unified Ops canonical schema (PostgreSQL)

create extension if not exists pgcrypto;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  external_customer_id text,
  name text not null,
  company text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  internal_order_id text not null unique,
  origin text not null check (origin in ('shopify', 'manual', 'deco')),
  shopify_order_id text,
  deco_order_id text,
  customer_id uuid not null references customers(id),
  urgency text not null check (urgency in ('normal', 'rush', 'critical')) default 'normal',
  assigned_department text not null check (
    assigned_department in ('sales', 'design', 'purchasing', 'production', 'dispatch', 'finance', 'ops')
  ) default 'ops',
  owner text,
  due_at timestamptz,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_shopify_order_id on orders(shopify_order_id);
create index if not exists idx_orders_deco_order_id on orders(deco_order_id);
create index if not exists idx_orders_due_at on orders(due_at);

create table if not exists order_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  address_type text not null check (address_type in ('billing', 'shipping')),
  line1 text not null,
  line2 text,
  city text not null,
  state text,
  postcode text,
  country text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_order_addresses_unique_type
  on order_addresses(order_id, address_type);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  external_line_id text,
  sku text not null,
  product_title text not null,
  variant_title text,
  garment_reference text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  decoration_method text not null,
  decoration_placement text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_order_items_sku on order_items(sku);

create table if not exists order_artwork_assets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  mime_type text,
  revision integer not null default 1,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_order_artwork_assets_order_id on order_artwork_assets(order_id);

create table if not exists order_approval (
  order_id uuid primary key references orders(id) on delete cascade,
  status text not null check (
    status in (
      'not_required',
      'awaiting_artwork',
      'proof_in_progress',
      'proof_sent',
      'awaiting_customer_approval',
      'approved',
      'changes_requested',
      'rejected'
    )
  ),
  proof_version text,
  proof_sent_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists order_stock (
  order_id uuid primary key references orders(id) on delete cascade,
  status text not null check (
    status in (
      'in_stock',
      'partially_in_stock',
      'awaiting_supplier',
      'purchasing_required',
      'stock_risk',
      'stock_confirmed'
    )
  ),
  shortage_detected boolean not null default false,
  purchasing_required boolean not null default false,
  supplier_eta timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists order_production (
  order_id uuid primary key references orders(id) on delete cascade,
  stage text not null check (
    stage in (
      'pending_review',
      'awaiting_artwork',
      'awaiting_approval',
      'approved_awaiting_stock',
      'ready_for_production',
      'in_production',
      'quality_check',
      'ready_for_dispatch',
      'dispatched',
      'complete'
    )
  ),
  dispatch_blocked boolean not null default true,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists order_communications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  channel text not null check (channel in ('gmail', 'internal_note')),
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  subject text not null,
  body_preview text,
  provider_message_id text,
  attachments jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_communications_order_id on order_communications(order_id);

create table if not exists order_activity_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  activity_type text not null,
  message text not null,
  actor text not null,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_activity_log_order_id on order_activity_log(order_id);
create index if not exists idx_order_activity_log_created_at on order_activity_log(created_at desc);

create table if not exists integration_event_inbox (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_type text not null,
  idempotency_key text not null unique,
  refs jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  processed_at timestamptz,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_integration_event_inbox_created_at
  on integration_event_inbox(created_at desc);

create table if not exists outbound_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  target_system text not null,
  job_type text not null,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  next_run_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_outbound_jobs_status_next_run on outbound_jobs(status, next_run_at);
