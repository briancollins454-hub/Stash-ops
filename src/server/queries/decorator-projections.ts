import type {
  DecoratorLayer,
  DecoratorProduct,
  DecoratorTemplate,
} from "@/lib/types";
import type {
  DecorationMethod,
  UnifiedOrderRecord,
} from "@/server/core/order-types";
import { listUnifiedOrders } from "@/server/repositories/unified-order-repository";
import { runAutoSyncIfStale } from "@/server/sync/auto-sync-engine";

function toHexColor(method: DecorationMethod) {
  if (method === "embroidery") return "#e7dac5";
  if (method === "dtf") return "#cae8f4";
  if (method === "screen_print") return "#f7debf";
  if (method === "dtg") return "#d7f0de";
  if (method === "sublimation") return "#ece4ff";
  return "#f4efe7";
}

function buildLayerFromPlacement(
  order: UnifiedOrderRecord,
  placement: UnifiedOrderRecord["designSetup"]["placements"][number],
  index: number,
): DecoratorLayer {
  const x = Math.max(0, Math.round(placement.offsetXMm / 2));
  const y = Math.max(0, Math.round(placement.offsetYMm / 2));
  const width = Math.max(48, Math.round(placement.widthMm / 2));
  const content =
    placement.stitchOrFilm ??
    `${order.customer.company ?? order.customer.name} ${placement.location}`;

  return {
    id: `${placement.placementId}-${index}`,
    name: placement.location,
    type: "logo",
    color: toHexColor(placement.method),
    x,
    y,
    width,
    rotation: 0,
    opacity: 0.94,
    content,
  };
}

function buildProductFromOrderLine(
  line: UnifiedOrderRecord["lineItems"][number],
  index: number,
): DecoratorProduct {
  return {
    id: `PD-${line.sku || `LINE-${index + 1}`}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48),
    name: line.productTitle || "Custom garment",
    brand: line.garmentReference ?? "Unknown brand",
    sku: line.sku || "UNKNOWN-SKU",
    garmentColor: line.variantTitle ?? "Mixed",
    decorationArea: {
      width: 340,
      height: 300,
    },
  };
}

export async function projectDecoratorProducts(): Promise<DecoratorProduct[]> {
  runAutoSyncIfStale();
  const orders = await listUnifiedOrders();
  const bySku = new Map<string, DecoratorProduct>();

  orders.forEach((order) => {
    order.lineItems.forEach((line, index) => {
      const key = (line.sku || line.productTitle || `line-${index}`).toLowerCase();
      if (!key || bySku.has(key)) {
        return;
      }
      bySku.set(key, buildProductFromOrderLine(line, index));
    });
  });

  return Array.from(bySku.values()).slice(0, 120);
}

export async function projectDecoratorTemplates(): Promise<DecoratorTemplate[]> {
  runAutoSyncIfStale();
  const orders = await listUnifiedOrders();

  const templates = orders
    .filter((order) => order.designSetup.placements.length > 0)
    .map((order) => ({
      id: `TMP-${order.internalOrderId.replace("ST-", "")}`,
      name: order.designSetup.productLabel || `Template ${order.internalOrderId}`,
      description:
        order.designSetup.notes ??
        `Derived from ${order.internalOrderId} (${order.customer.company ?? order.customer.name}).`,
      layers: order.designSetup.placements.map((placement, index) =>
        buildLayerFromPlacement(order, placement, index),
      ),
    }))
    .slice(0, 120);

  return templates;
}
