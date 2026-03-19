import { Pool } from "pg";
import type {
  ActivityLogEntry,
  ApprovalWorkflowStatus,
  CommunicationEvent,
  ManualOrderCreateInput,
  ProductionWorkflowStage,
  StockWorkflowStatus,
  UnifiedOrderRecord,
} from "@/server/core/order-types";

type OrderStore = Map<string, UnifiedOrderRecord>;

type OrderFilters = {
  stage?: ProductionWorkflowStage;
  approval?: ApprovalWorkflowStatus;
  stock?: StockWorkflowStatus;
  owner?: string;
};

type RepositoryMode = "memory" | "postgres";

const orderStore: OrderStore = new Map();
const processedIdempotencyKeys = new Set<string>();

const mode: RepositoryMode = process.env.DATABASE_URL ? "postgres" : "memory";
const demoDataEnabled = process.env.ENABLE_DEMO_DATA?.toLowerCase() === "true";

let memorySeeded = false;

const globalForPg = globalThis as typeof globalThis & {
  __stashOpsPgPool?: Pool;
  __stashOpsPgInitPromise?: Promise<void>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nowIso() {
  return new Date().toISOString();
}

function buildAddress(city: string, state: string): UnifiedOrderRecord["shippingAddress"] {
  return {
    line1: "1 Commerce Way",
    city,
    state,
    postcode: "00000",
    country: "US",
  };
}

function createSeedOrder(
  input: Omit<
    UnifiedOrderRecord,
    "activityLog" | "communicationTimeline" | "createdAt" | "updatedAt"
  >,
): UnifiedOrderRecord {
  const timestamp = nowIso();

  return {
    ...input,
    activityLog: [
      {
        activityId: `act-${input.internalOrderId}-created`,
        type: "order_created",
        message: `Order ${input.internalOrderId} was created from ${input.origin}.`,
        actor: "system",
        source: "system",
        createdAt: timestamp,
      },
    ],
    communicationTimeline: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildSeedOrders(): UnifiedOrderRecord[] {
  return [
    createSeedOrder({
      internalOrderId: "ST-4821",
      origin: "shopify",
      externalReferences: {
        shopifyOrderId: "SH-91002",
        decoOrderId: "DE-44021",
      },
      customer: {
        customerId: "CU-1004",
        name: "Mara Ellis",
        company: "Harbor Wellness",
        email: "mara@harborwellness.com",
      },
      billingAddress: buildAddress("San Diego", "CA"),
      shippingAddress: buildAddress("San Diego", "CA"),
      lineItems: [
        {
          lineId: "LI-1",
          sku: "ASC-5080-STONE",
          productTitle: "Premium Heavyweight Tee",
          variantTitle: "Stone / M",
          garmentReference: "AS Colour 5080",
          quantity: 48,
          unitPrice: 28,
          decorationMethod: "embroidery",
          decorationPlacement: "left chest",
        },
      ],
      artworkFiles: [],
      designSetup: {
        status: "proof_ready",
        studioView: "3d",
        productLabel: "Premium Heavyweight Tee",
        garmentSku: "ASC-5080-STONE",
        model3dUrl: "https://assets.example.com/models/asc-5080.glb",
        previewImageUrl: "https://assets.example.com/previews/asc-5080-front.png",
        placements: [
          {
            placementId: "pl-st4821-1",
            method: "embroidery",
            location: "left chest",
            widthMm: 95,
            heightMm: 45,
            offsetXMm: 20,
            offsetYMm: 22,
            stitchOrFilm: "3-color stitch",
          },
        ],
        notes: "Embroidery draft ready for client sign-off.",
        lastEditedAt: nowIso(),
        lastEditedBy: "ava",
      },
      approval: {
        status: "proof_sent",
        proofVersion: "v04",
        proofSentAt: nowIso(),
      },
      stock: {
        status: "partially_in_stock",
        shortageDetected: true,
        purchasingRequired: true,
        notes: "Missing 12 units in M/L.",
      },
      purchasing: {
        status: "ordered_from_supplier",
        supplierName: "S&S Activewear",
        supplierPoNumber: "PO-4821",
        orderedAt: nowIso(),
        expectedAt: new Date(Date.now() + 1000 * 60 * 60 * 30).toISOString(),
        scanEvents: [],
        notes: "Backfill in progress for missing size run.",
      },
      production: {
        stage: "approved_awaiting_stock",
        dispatchBlocked: true,
      },
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
      urgency: "rush",
      assignedDepartment: "purchasing",
      owner: "reece",
      blockedReason: "Waiting for stock confirmation.",
    }),
    createSeedOrder({
      internalOrderId: "ST-4820",
      origin: "manual",
      externalReferences: {
        decoOrderId: "DE-44019",
      },
      customer: {
        customerId: "CU-1001",
        name: "Jordan Reid",
        company: "Northline HVAC",
        email: "jordan@northlinehvac.com",
      },
      billingAddress: buildAddress("Houston", "TX"),
      shippingAddress: buildAddress("Houston", "TX"),
      lineItems: [
        {
          lineId: "LI-2",
          sku: "IND-4500-FST",
          productTitle: "Midweight Crew Sweat",
          variantTitle: "Forest / L",
          garmentReference: "Independent 4500",
          quantity: 120,
          unitPrice: 35,
          decorationMethod: "screen_print",
          decorationPlacement: "front + back",
        },
      ],
      artworkFiles: [],
      designSetup: {
        status: "proof_ready",
        studioView: "3d",
        productLabel: "Midweight Crew Sweat",
        garmentSku: "IND-4500-FST",
        model3dUrl: "https://assets.example.com/models/ind-4500.glb",
        previewImageUrl: "https://assets.example.com/previews/ind-4500-front.png",
        placements: [
          {
            placementId: "pl-st4820-1",
            method: "screen_print",
            location: "front + back",
            widthMm: 280,
            heightMm: 340,
            offsetXMm: 0,
            offsetYMm: 20,
            stitchOrFilm: "2-color print",
          },
        ],
        notes: "Proof sent, waiting for customer response.",
        lastEditedAt: nowIso(),
        lastEditedBy: "ava",
      },
      approval: {
        status: "awaiting_customer_approval",
        proofVersion: "v02",
        proofSentAt: nowIso(),
      },
      stock: {
        status: "stock_confirmed",
        shortageDetected: false,
        purchasingRequired: false,
      },
      purchasing: {
        status: "scanned_complete",
        supplierName: "AlphaBroder",
        supplierPoNumber: "PO-4820",
        orderedAt: nowIso(),
        receivedAt: nowIso(),
        scanEvents: [
          {
            scanId: "scan-st4820-1",
            sku: "IND-4500-FST",
            quantity: 120,
            location: "Rack A2",
            scannedAt: nowIso(),
            scannedBy: "reece",
          },
        ],
      },
      production: {
        stage: "awaiting_approval",
        dispatchBlocked: true,
      },
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
      urgency: "normal",
      assignedDepartment: "design",
      owner: "ava",
      blockedReason: "Waiting for customer approval.",
    }),
    createSeedOrder({
      internalOrderId: "ST-4818",
      origin: "shopify",
      externalReferences: {
        shopifyOrderId: "SH-90981",
        decoOrderId: "DE-44010",
      },
      customer: {
        customerId: "CU-0996",
        name: "Taylor Wong",
        company: "Slate Coffee",
        email: "ops@slatecoffee.com",
      },
      billingAddress: buildAddress("New York", "NY"),
      shippingAddress: buildAddress("New York", "NY"),
      lineItems: [
        {
          lineId: "LI-3",
          sku: "DTF-TSHIRT-SLATE",
          productTitle: "Team tee bundle",
          variantTitle: "Mixed size run",
          quantity: 86,
          unitPrice: 22,
          decorationMethod: "dtf",
          decorationPlacement: "front",
        },
      ],
      artworkFiles: [],
      designSetup: {
        status: "customer_approved",
        studioView: "3d",
        productLabel: "Team tee bundle",
        garmentSku: "DTF-TSHIRT-SLATE",
        model3dUrl: "https://assets.example.com/models/team-tee.glb",
        previewImageUrl: "https://assets.example.com/previews/team-tee-front.png",
        placements: [
          {
            placementId: "pl-st4818-1",
            method: "dtf",
            location: "front",
            widthMm: 240,
            heightMm: 280,
            offsetXMm: 0,
            offsetYMm: 24,
            stitchOrFilm: "DTF film",
          },
        ],
        notes: "Client approved front treatment.",
        lastEditedAt: nowIso(),
        lastEditedBy: "nico",
      },
      approval: {
        status: "approved",
        proofVersion: "v03",
        approvedAt: nowIso(),
      },
      stock: {
        status: "stock_confirmed",
        shortageDetected: false,
        purchasingRequired: false,
      },
      purchasing: {
        status: "scanned_complete",
        supplierName: "SanMar",
        supplierPoNumber: "PO-4818",
        orderedAt: nowIso(),
        receivedAt: nowIso(),
        scanEvents: [
          {
            scanId: "scan-st4818-1",
            sku: "DTF-TSHIRT-SLATE",
            quantity: 86,
            location: "Rack B1",
            scannedAt: nowIso(),
            scannedBy: "nico",
          },
        ],
      },
      production: {
        stage: "ready_for_production",
        dispatchBlocked: false,
      },
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 96).toISOString(),
      urgency: "normal",
      assignedDepartment: "production",
      owner: "nico",
    }),
    createSeedOrder({
      internalOrderId: "ST-4816",
      origin: "deco",
      externalReferences: {
        decoOrderId: "DE-44006",
      },
      customer: {
        customerId: "CU-0975",
        name: "Chris Patel",
        company: "Cinder Athletics",
        email: "chris@cinderathletics.com",
      },
      billingAddress: buildAddress("Miami", "FL"),
      shippingAddress: buildAddress("Miami", "FL"),
      lineItems: [
        {
          lineId: "LI-4",
          sku: "DTF-GANG-CINDER",
          productTitle: "Cinder spring run",
          variantTitle: "Bulk mixed",
          quantity: 240,
          unitPrice: 18,
          decorationMethod: "dtf",
          decorationPlacement: "front + sleeve",
        },
      ],
      artworkFiles: [],
      designSetup: {
        status: "production_locked",
        studioView: "3d",
        productLabel: "Cinder spring run",
        garmentSku: "DTF-GANG-CINDER",
        model3dUrl: "https://assets.example.com/models/cinder-run.glb",
        previewImageUrl: "https://assets.example.com/previews/cinder-run-front.png",
        placements: [
          {
            placementId: "pl-st4816-1",
            method: "dtf",
            location: "front + sleeve",
            widthMm: 290,
            heightMm: 300,
            offsetXMm: 0,
            offsetYMm: 20,
            stitchOrFilm: "DTF gang sheet",
          },
        ],
        notes: "Locked for production routing.",
        lastEditedAt: nowIso(),
        lastEditedBy: "dani",
      },
      approval: {
        status: "approved",
        approvedAt: nowIso(),
      },
      stock: {
        status: "in_stock",
        shortageDetected: false,
        purchasingRequired: false,
      },
      purchasing: {
        status: "scanned_complete",
        supplierName: "Stock on hand",
        scanEvents: [
          {
            scanId: "scan-st4816-1",
            sku: "DTF-GANG-CINDER",
            quantity: 240,
            location: "Floor staging",
            scannedAt: nowIso(),
            scannedBy: "dani",
          },
        ],
        receivedAt: nowIso(),
      },
      production: {
        stage: "in_production",
        dispatchBlocked: false,
        startedAt: nowIso(),
      },
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 18).toISOString(),
      urgency: "rush",
      assignedDepartment: "production",
      owner: "dani",
    }),
    createSeedOrder({
      internalOrderId: "ST-4812",
      origin: "shopify",
      externalReferences: {
        shopifyOrderId: "SH-90922",
        decoOrderId: "DE-43992",
      },
      customer: {
        customerId: "CU-0963",
        name: "Bella Moore",
        company: "Birch & Beam",
        email: "hello@birchbeam.com",
      },
      billingAddress: buildAddress("Austin", "TX"),
      shippingAddress: buildAddress("Austin", "TX"),
      lineItems: [
        {
          lineId: "LI-5",
          sku: "DTG-HOODIE-BB",
          productTitle: "Launch hoodie drop",
          variantTitle: "Black / Mixed",
          quantity: 44,
          unitPrice: 42,
          decorationMethod: "dtg",
          decorationPlacement: "front",
        },
      ],
      artworkFiles: [],
      designSetup: {
        status: "production_locked",
        studioView: "3d",
        productLabel: "Launch hoodie drop",
        garmentSku: "DTG-HOODIE-BB",
        model3dUrl: "https://assets.example.com/models/hoodie-drop.glb",
        previewImageUrl: "https://assets.example.com/previews/hoodie-drop-front.png",
        placements: [
          {
            placementId: "pl-st4812-1",
            method: "dtg",
            location: "front",
            widthMm: 260,
            heightMm: 280,
            offsetXMm: 0,
            offsetYMm: 22,
            stitchOrFilm: "DTG pass",
          },
        ],
        notes: "Completed run.",
        lastEditedAt: nowIso(),
        lastEditedBy: "kai",
      },
      approval: {
        status: "approved",
        approvedAt: nowIso(),
      },
      stock: {
        status: "stock_confirmed",
        shortageDetected: false,
        purchasingRequired: false,
      },
      purchasing: {
        status: "scanned_complete",
        supplierName: "S&S Activewear",
        supplierPoNumber: "PO-4812",
        orderedAt: nowIso(),
        receivedAt: nowIso(),
        scanEvents: [
          {
            scanId: "scan-st4812-1",
            sku: "DTG-HOODIE-BB",
            quantity: 44,
            location: "Dispatch lane",
            scannedAt: nowIso(),
            scannedBy: "kai",
          },
        ],
      },
      production: {
        stage: "dispatched",
        dispatchBlocked: false,
      },
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
      urgency: "normal",
      assignedDepartment: "dispatch",
      owner: "kai",
    }),
  ];
}

function ensureMemorySeedData() {
  if (memorySeeded) {
    return;
  }

  if (!demoDataEnabled) {
    memorySeeded = true;
    return;
  }

  const seedOrders = buildSeedOrders();
  seedOrders.forEach((order) => {
    orderStore.set(order.internalOrderId, clone(order));
  });
  memorySeeded = true;
}

function getPgPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return undefined;
  }

  if (!globalForPg.__stashOpsPgPool) {
    globalForPg.__stashOpsPgPool = new Pool({ connectionString });
  }

  return globalForPg.__stashOpsPgPool;
}

async function initializePg() {
  const pool = getPgPool();
  if (!pool) {
    return;
  }

  await pool.query(`
    create table if not exists unified_order_snapshots (
      internal_order_id text primary key,
      record jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create index if not exists idx_unified_order_snapshots_updated_at
      on unified_order_snapshots(updated_at desc);
  `);

  await pool.query(`
    create index if not exists idx_unified_order_snapshots_shopify
      on unified_order_snapshots ((record #>> '{externalReferences,shopifyOrderId}'));
  `);

  await pool.query(`
    create index if not exists idx_unified_order_snapshots_deco
      on unified_order_snapshots ((record #>> '{externalReferences,decoOrderId}'));
  `);

  await pool.query(`
    create index if not exists idx_unified_order_snapshots_gmail
      on unified_order_snapshots ((record #>> '{externalReferences,gmailThreadId}'));
  `);

  await pool.query(`
    create index if not exists idx_unified_order_snapshots_stage
      on unified_order_snapshots ((record #>> '{production,stage}'));
  `);

  await pool.query(`
    create index if not exists idx_unified_order_snapshots_approval
      on unified_order_snapshots ((record #>> '{approval,status}'));
  `);

  await pool.query(`
    create index if not exists idx_unified_order_snapshots_stock
      on unified_order_snapshots ((record #>> '{stock,status}'));
  `);

  await pool.query(`
    create index if not exists idx_unified_order_snapshots_owner
      on unified_order_snapshots ((record ->> 'owner'));
  `);

  await pool.query(`
    create table if not exists unified_idempotency_keys (
      idempotency_key text primary key,
      processed_at timestamptz not null default now()
    );
  `);

  const countResult = await pool.query<{ count: string }>(
    "select count(*)::text as count from unified_order_snapshots",
  );
  const total = Number(countResult.rows[0]?.count ?? "0");

  if (total > 0) {
    return;
  }

  if (!demoDataEnabled) {
    return;
  }

  const seedOrders = buildSeedOrders();
  for (const order of seedOrders) {
    await pool.query(
      `
      insert into unified_order_snapshots (internal_order_id, record, created_at, updated_at)
      values ($1, $2::jsonb, now(), now())
      on conflict (internal_order_id) do nothing
      `,
      [order.internalOrderId, JSON.stringify(order)],
    );
  }
}

async function ensurePgReady() {
  if (mode !== "postgres") {
    return;
  }

  if (!globalForPg.__stashOpsPgInitPromise) {
    globalForPg.__stashOpsPgInitPromise = initializePg().catch((error) => {
      globalForPg.__stashOpsPgInitPromise = undefined;
      throw error;
    });
  }

  await globalForPg.__stashOpsPgInitPromise;
}

function applyOrderFilters(records: UnifiedOrderRecord[], filters?: OrderFilters) {
  let filtered = records;

  if (filters?.stage) {
    filtered = filtered.filter((order) => order.production.stage === filters.stage);
  }
  if (filters?.approval) {
    filtered = filtered.filter((order) => order.approval.status === filters.approval);
  }
  if (filters?.stock) {
    filtered = filtered.filter((order) => order.stock.status === filters.stock);
  }
  if (filters?.owner) {
    filtered = filtered.filter((order) => order.owner === filters.owner);
  }

  return filtered;
}

function computeNextOrderId(records: UnifiedOrderRecord[]) {
  const maxSuffix = records.reduce((max, order) => {
    const suffix = Number(order.internalOrderId.replace(/\D/g, ""));
    if (!Number.isFinite(suffix)) {
      return max;
    }
    return Math.max(max, suffix);
  }, 4899);

  return `ST-${String(maxSuffix + 1).padStart(4, "0")}`;
}

async function listPgOrders(filters?: OrderFilters) {
  const pool = getPgPool();
  if (!pool) {
    return [];
  }

  await ensurePgReady();

  const clauses: string[] = [];
  const values: string[] = [];

  if (filters?.stage) {
    values.push(filters.stage);
    clauses.push(`record #>> '{production,stage}' = $${values.length}`);
  }
  if (filters?.approval) {
    values.push(filters.approval);
    clauses.push(`record #>> '{approval,status}' = $${values.length}`);
  }
  if (filters?.stock) {
    values.push(filters.stock);
    clauses.push(`record #>> '{stock,status}' = $${values.length}`);
  }
  if (filters?.owner) {
    values.push(filters.owner);
    clauses.push(`record ->> 'owner' = $${values.length}`);
  }

  const whereClause = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";

  const result = await pool.query<{ record: UnifiedOrderRecord }>(
    `
    select record
    from unified_order_snapshots
    ${whereClause}
    order by updated_at desc
    `,
    values,
  );

  return result.rows.map((row) => clone(row.record));
}

async function getPgOrderByInternalId(orderId: string) {
  const pool = getPgPool();
  if (!pool) {
    return undefined;
  }

  await ensurePgReady();

  const result = await pool.query<{ record: UnifiedOrderRecord }>(
    `
    select record
    from unified_order_snapshots
    where internal_order_id = $1
    limit 1
    `,
    [orderId],
  );

  const record = result.rows[0]?.record;
  return record ? clone(record) : undefined;
}

async function getPgOrderByRef(
  type: "shopify" | "deco" | "gmail",
  value: string,
) {
  const pool = getPgPool();
  if (!pool) {
    return undefined;
  }

  await ensurePgReady();

  const path =
    type === "shopify"
      ? "{externalReferences,shopifyOrderId}"
      : type === "deco"
        ? "{externalReferences,decoOrderId}"
        : "{externalReferences,gmailThreadId}";

  const result = await pool.query<{ record: UnifiedOrderRecord }>(
    `
    select record
    from unified_order_snapshots
    where record #>> '${path}' = $1
    order by updated_at desc
    limit 1
    `,
    [value],
  );

  const record = result.rows[0]?.record;
  return record ? clone(record) : undefined;
}

export function getUnifiedOrderStorageMode(): RepositoryMode {
  return mode;
}

export async function generateInternalOrderId() {
  if (mode === "postgres") {
    const pool = getPgPool();
    if (!pool) {
      return `ST-${String(4900).padStart(4, "0")}`;
    }

    await ensurePgReady();
    const result = await pool.query<{ max_suffix: string | number }>(
      `
      select coalesce(
        max(
          nullif(regexp_replace(internal_order_id, '[^0-9]', '', 'g'), '')::int
        ),
        4899
      ) as max_suffix
      from unified_order_snapshots
      `,
    );

    const maxSuffix = Number(result.rows[0]?.max_suffix ?? 4899);
    return `ST-${String(maxSuffix + 1).padStart(4, "0")}`;
  }

  ensureMemorySeedData();
  return computeNextOrderId(Array.from(orderStore.values()));
}

export async function listUnifiedOrders(filters?: OrderFilters) {
  let records: UnifiedOrderRecord[];

  if (mode === "postgres") {
    records = await listPgOrders(filters);
  } else {
    ensureMemorySeedData();
    records = Array.from(orderStore.values());
  }

  return clone(applyOrderFilters(records, filters));
}

export async function getUnifiedOrder(orderId: string) {
  if (mode === "postgres") {
    return getPgOrderByInternalId(orderId);
  }

  ensureMemorySeedData();
  const order = orderStore.get(orderId);
  return order ? clone(order) : undefined;
}

export async function findUnifiedOrderByRefs(refs: {
  internalOrderId?: string;
  shopifyOrderId?: string;
  decoOrderId?: string;
  gmailThreadId?: string;
}) {
  if (mode === "postgres") {
    if (refs.internalOrderId) {
      const direct = await getPgOrderByInternalId(refs.internalOrderId);
      if (direct) {
        return direct;
      }
    }
    if (refs.shopifyOrderId) {
      const byShopify = await getPgOrderByRef("shopify", refs.shopifyOrderId);
      if (byShopify) {
        return byShopify;
      }
    }
    if (refs.decoOrderId) {
      const byDeco = await getPgOrderByRef("deco", refs.decoOrderId);
      if (byDeco) {
        return byDeco;
      }
    }
    if (refs.gmailThreadId) {
      const byGmail = await getPgOrderByRef("gmail", refs.gmailThreadId);
      if (byGmail) {
        return byGmail;
      }
    }
    return undefined;
  }

  ensureMemorySeedData();
  const records = Array.from(orderStore.values());

  if (refs.internalOrderId) {
    const direct = records.find((order) => order.internalOrderId === refs.internalOrderId);
    if (direct) {
      return clone(direct);
    }
  }

  for (const order of records) {
    if (refs.shopifyOrderId && order.externalReferences.shopifyOrderId === refs.shopifyOrderId) {
      return clone(order);
    }

    if (refs.decoOrderId && order.externalReferences.decoOrderId === refs.decoOrderId) {
      return clone(order);
    }

    if (refs.gmailThreadId && order.externalReferences.gmailThreadId === refs.gmailThreadId) {
      return clone(order);
    }
  }

  return undefined;
}

export async function saveUnifiedOrder(order: UnifiedOrderRecord) {
  const snapshot = clone(order);

  if (mode === "postgres") {
    const pool = getPgPool();
    if (!pool) {
      throw new Error("DATABASE_URL is set but PostgreSQL pool is unavailable.");
    }

    await ensurePgReady();
    await pool.query(
      `
      insert into unified_order_snapshots (internal_order_id, record, created_at, updated_at)
      values ($1, $2::jsonb, now(), now())
      on conflict (internal_order_id)
      do update set
        record = excluded.record,
        updated_at = now()
      `,
      [snapshot.internalOrderId, JSON.stringify(snapshot)],
    );

    return clone(snapshot);
  }

  ensureMemorySeedData();
  orderStore.set(snapshot.internalOrderId, snapshot);
  return clone(snapshot);
}

export async function createManualSeedOrder(input: ManualOrderCreateInput) {
  const now = nowIso();
  const internalOrderId = await generateInternalOrderId();

  const order: UnifiedOrderRecord = {
    internalOrderId,
    origin: "manual",
    externalReferences: {},
    customer: input.customer,
    billingAddress: input.billingAddress,
    shippingAddress: input.shippingAddress,
    lineItems: input.lineItems,
    artworkFiles: [],
    designSetup: {
      status: "not_started",
      studioView: "2d",
      productLabel: input.lineItems[0]?.productTitle ?? "Custom garment",
      garmentSku: input.lineItems[0]?.sku,
      placements: [],
    },
    approval: {
      status: "awaiting_artwork",
    },
    stock: {
      status: "stock_risk",
      shortageDetected: false,
      purchasingRequired: false,
    },
    purchasing: {
      status: "not_started",
      scanEvents: [],
    },
    production: {
      stage: "pending_review",
      dispatchBlocked: true,
    },
    communicationTimeline: [],
    activityLog: [],
    dueAt: input.dueAt,
    urgency: input.urgency ?? "normal",
    assignedDepartment: input.assignedDepartment ?? "ops",
    owner: input.owner,
    createdAt: now,
    updatedAt: now,
  };

  return clone(order);
}

export async function appendActivity(orderId: string, activity: ActivityLogEntry) {
  const order = await getUnifiedOrder(orderId);
  if (!order) {
    return undefined;
  }

  order.activityLog.push(activity);
  order.updatedAt = nowIso();
  return saveUnifiedOrder(order);
}

export async function appendCommunication(orderId: string, message: CommunicationEvent) {
  const order = await getUnifiedOrder(orderId);
  if (!order) {
    return undefined;
  }

  order.communicationTimeline.push(message);
  order.updatedAt = nowIso();
  return saveUnifiedOrder(order);
}

export async function markIdempotencyKeyProcessed(idempotencyKey: string) {
  if (mode === "postgres") {
    const pool = getPgPool();
    if (!pool) {
      return false;
    }

    await ensurePgReady();
    const result = await pool.query(
      `
      insert into unified_idempotency_keys (idempotency_key)
      values ($1)
      on conflict (idempotency_key) do nothing
      `,
      [idempotencyKey],
    );

    return result.rowCount === 1;
  }

  ensureMemorySeedData();

  if (processedIdempotencyKeys.has(idempotencyKey)) {
    return false;
  }

  processedIdempotencyKeys.add(idempotencyKey);
  return true;
}
