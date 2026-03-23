"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DesignerModal, type DesignConfig } from "./designer-modal";

// ── Types ──

type Account = {
  id: string;
  name: string;
  key: string;
  type: string;
  decoCustomerId?: string | null;
  defaultDecorationMethod?: string | null;
  aliases: { aliasRaw: string }[];
};

type DecoProduct = {
  decoProductId?: string;
  name: string;
  sku: string;
  category: string;
  price?: number;
  sizes?: string;
  colors?: string;
};

type DecoProductDetail = {
  productId: number;
  productCode: string;
  productName: string;
  supplier: string;
  brand: string;
  category: string;
  colors: Array<{ id: number; name: string }>;
  sizes: Array<{ id: number; name: string; code: string }>;
  skus: Array<{
    sizeId: number;
    colorId: number;
    price: number;
    cost: number;
    sku: string;
    dnSkuId: string;
  }>;
  images?: Array<{
    url: string;
    color?: string;
    type: "front" | "back" | "side" | "gallery";
  }>;
};

type InventoryItem = {
  decoProductId?: string;
  sku: string;
  name: string;
  onHand: number;
  available: number;
  onOrder: number;
};

type LineItem = {
  id: string;
  sku: string;
  productTitle: string;
  variantTitle: string;
  quantity: number;
  decorationMethod: string;
  placement: string;
  placements: string[];
  unitPrice: string;
  decoProductId?: string;
  // Rich product detail (fetched from Deco API)
  productDetail?: DecoProductDetail;
  productDetailLoading?: boolean;
  selectedColorId?: number;
  sizeQuantities?: Record<number, number>; // sizeId → quantity
  designs?: DesignConfig[];
};

const DECORATION_METHODS = [
  { key: "dtf", label: "DTF Transfer" },
  { key: "embroidery", label: "Embroidery" },
  { key: "dtg", label: "DTG Print" },
  { key: "screen_print", label: "Screen Print" },
  { key: "sublimation", label: "Sublimation" },
  { key: "vinyl", label: "Vinyl / HTV" },
  { key: "other", label: "Other" },
];

const STEPS = ["Customer", "Products", "Review"] as const;
type Step = (typeof STEPS)[number];

const PLACEMENTS = [
  { key: "front", label: "Front", icon: "👕" },
  { key: "back", label: "Back", icon: "🔙" },
  { key: "left_chest", label: "Left Chest", icon: "◀" },
  { key: "right_chest", label: "Right Chest", icon: "▶" },
  { key: "left_sleeve", label: "Left Sleeve", icon: "🦾" },
  { key: "right_sleeve", label: "Right Sleeve", icon: "💪" },
  { key: "collar", label: "Collar", icon: "⬆" },
  { key: "hem", label: "Hem", icon: "↕" },
  { key: "pocket", label: "Pocket", icon: "🪪" },
] as const;

function emptyLine(): LineItem {
  return {
    id: crypto.randomUUID(),
    sku: "",
    productTitle: "",
    variantTitle: "",
    quantity: 1,
    decorationMethod: "dtf",
    placement: "front",
    placements: ["front"],
    unitPrice: "",
    decoProductId: undefined,
    selectedColorId: undefined,
    sizeQuantities: undefined,
  };
}

// ── Debounce hook ──

function useDebounce(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

// ── Main Component ──

export default function QuoteBuilderPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("Customer");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ jobId: string; internalJobId: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Customer state ──
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  // ── Address ──
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPostcode, setAddrPostcode] = useState("");
  const [addrCountry, setAddrCountry] = useState("GB");

  // ── Note & due date ──
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState("");

  // ── Line items ──
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);

  // ── Products catalog ──
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<DecoProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState<string | null>(null);

  // ── Inventory cache ──
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // ── Designer modal ──
  const [designerLineId, setDesignerLineId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Account search ──
  const debouncedAccountSearch = useDebounce(accountSearch, 300);

  const fetchAccounts = useCallback(async (q: string) => {
    setAccountsLoading(true);
    try {
      const res = await fetch(`/api/quotes/accounts?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { items?: Account[] };
      setAccounts(data.items ?? []);
    } catch {
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedAccountSearch.length >= 1) {
      fetchAccounts(debouncedAccountSearch);
    } else {
      fetchAccounts("");
    }
  }, [debouncedAccountSearch, fetchAccounts]);

  // ── Product search ──
  const debouncedProductSearch = useDebounce(productSearch, 300);

  const fetchProducts = useCallback(async (q: string) => {
    setProductsLoading(true);
    try {
      const res = await fetch(`/api/quotes/products?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { items?: DecoProduct[] };
      setProducts(data.items ?? []);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(debouncedProductSearch);
  }, [debouncedProductSearch, fetchProducts]);

  // ── Inventory fetch ──
  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const res = await fetch("/api/quotes/inventory");
      const data = (await res.json()) as { items?: InventoryItem[] };
      setInventory(data.items ?? []);
    } catch {
      setInventory([]);
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === "Products") {
      fetchInventory();
    }
  }, [step, fetchInventory]);

  // ── Click outside dropdown ──
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAccountDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Helpers ──

  function selectAccount(acct: Account) {
    setSelectedAccount(acct);
    setCustomerName(acct.name);
    setCustomerCompany(acct.name);
    setAccountSearch(acct.name);
    setShowAccountDropdown(false);
    if (acct.defaultDecorationMethod) {
      setLineItems((items) =>
        items.map((item) => ({ ...item, decorationMethod: acct.defaultDecorationMethod! })),
      );
    }
    // Auto-fill contact info from linked DecoCustomer
    if (acct.decoCustomerId) {
      fetch(`/api/quotes/customers?decoCustomerId=${encodeURIComponent(acct.decoCustomerId)}`)
        .then((res) => res.json())
        .then((data: { items?: Array<{ email?: string; phone?: string; company?: string; address1?: string; address2?: string; city?: string; state?: string; postcode?: string; country?: string }> }) => {
          const c = data.items?.[0];
          if (!c) return;
          if (c.email) setCustomerEmail(c.email);
          if (c.phone) setCustomerPhone(c.phone);
          if (c.company) setCustomerCompany(c.company);
          if (c.address1) setAddrLine1(c.address1);
          if (c.address2) setAddrLine2(c.address2);
          if (c.city) setAddrCity(c.city);
          if (c.state) setAddrState(c.state);
          if (c.postcode) setAddrPostcode(c.postcode);
          if (c.country) setAddrCountry(c.country);
        })
        .catch(() => { /* ignore fetch errors – fields stay empty */ });
    }
  }

  function clearAccount() {
    setSelectedAccount(null);
    setAccountSearch("");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCustomerCompany("");
    setAddrLine1("");
    setAddrLine2("");
    setAddrCity("");
    setAddrState("");
    setAddrPostcode("");
    setAddrCountry("GB");
  }

  function updateLineItem(id: string, patch: Partial<LineItem>) {
    setLineItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeLineItem(id: string) {
    setLineItems((items) => {
      const filtered = items.filter((item) => item.id !== id);
      return filtered.length === 0 ? [emptyLine()] : filtered;
    });
  }

  function addLineItem() {
    setLineItems((items) => [...items, emptyLine()]);
  }

  function pickProduct(lineId: string, product: DecoProduct) {
    updateLineItem(lineId, {
      sku: product.sku,
      productTitle: product.name,
      decoProductId: product.decoProductId,
      unitPrice: product.price ? String(product.price) : "",
      productDetailLoading: true,
    });
    setShowProductPicker(null);
    setProductSearch("");

    // Fetch rich product detail (colors, sizes, per-SKU pricing)
    if (product.decoProductId) {
      fetch(`/api/quotes/products/${encodeURIComponent(product.decoProductId)}`)
        .then((res) => res.json())
        .then((detail: DecoProductDetail & { error?: string }) => {
          if (detail.error || !detail.colors) {
            updateLineItem(lineId, { productDetailLoading: false });
            return;
          }
          const firstColor = detail.colors[0];
          // Find price from first available SKU
          const firstSku = detail.skus[0];
          const initSizeQtys: Record<number, number> = {};
          for (const sz of detail.sizes) {
            if (sz.code !== "MS") initSizeQtys[sz.id] = 0;
          }
          updateLineItem(lineId, {
            productDetail: detail,
            productDetailLoading: false,
            selectedColorId: firstColor?.id,
            sizeQuantities: initSizeQtys,
            unitPrice: firstSku?.price ? String(firstSku.price) : "",
            variantTitle: firstColor?.name ?? "",
          });
        })
        .catch(() => {
          updateLineItem(lineId, { productDetailLoading: false });
        });
    }
  }

  function getInventoryForSku(sku: string): InventoryItem | undefined {
    if (!sku) return undefined;
    return inventory.find((i) => i.sku.toLowerCase() === sku.toLowerCase());
  }

  /** Get per-SKU price for a given color and size from product detail */
  function getSkuPrice(detail: DecoProductDetail, colorId: number, sizeId: number): number | undefined {
    const sku = detail.skus.find((s) => s.colorId === colorId && s.sizeId === sizeId);
    return sku?.price;
  }

  /** Calculate total quantity from sizes grid */
  function calcSizeQuantitiesTotal(sizeQtys: Record<number, number> | undefined): number {
    if (!sizeQtys) return 0;
    return Object.values(sizeQtys).reduce((sum, q) => sum + q, 0);
  }

  /** Toggle a placement on/off for a line item */
  function togglePlacement(lineId: string, placementKey: string) {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== lineId) return item;
        const current = item.placements ?? [item.placement];
        const next = current.includes(placementKey)
          ? current.filter((p) => p !== placementKey)
          : [...current, placementKey];
        const result = next.length > 0 ? next : ["front"];
        return { ...item, placements: result, placement: result[0] };
      }),
    );
  }

  /** Apply designs from the Designer modal to a line item */
  function applyDesigns(lineId: string, designs: DesignConfig[]) {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== lineId) return item;
        const placements = designs.map((d) => d.placement);
        const primaryMethod = designs[0]?.decorationMethod || item.decorationMethod;
        return {
          ...item,
          designs,
          placements: placements.length > 0 ? placements : item.placements,
          placement: placements[0] ?? item.placement,
          decorationMethod: primaryMethod,
        };
      }),
    );
    setDesignerLineId(null);
  }

  /** Select a color for a line item and update unit price from SKU data */
  function selectColor(lineId: string, colorId: number) {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== lineId || !item.productDetail) return item;
        const color = item.productDetail.colors.find((c) => c.id === colorId);
        // Find price for this color (use first available size)
        const sku = item.productDetail.skus.find((s) => s.colorId === colorId);
        return {
          ...item,
          selectedColorId: colorId,
          variantTitle: color?.name ?? "",
          unitPrice: sku?.price ? String(sku.price) : item.unitPrice,
        };
      }),
    );
  }

  /** Update size quantity and recalculate total */
  function updateSizeQty(lineId: string, sizeId: number, qty: number) {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== lineId) return item;
        const newSizeQtys = { ...(item.sizeQuantities ?? {}), [sizeId]: Math.max(0, qty) };
        const totalQty = Object.values(newSizeQtys).reduce((sum, q) => sum + q, 0);
        return { ...item, sizeQuantities: newSizeQtys, quantity: Math.max(1, totalQty) };
      }),
    );
  }

  function calcLineTotal(item: LineItem): number {
    const price = parseFloat(item.unitPrice);
    if (!Number.isFinite(price)) return 0;
    return price * item.quantity;
  }

  function calcGrandTotal(): number {
    return lineItems.reduce((sum, item) => sum + calcLineTotal(item), 0);
  }

  function canProceedFromCustomer(): boolean {
    return customerName.trim().length >= 1;
  }

  function canProceedFromProducts(): boolean {
    return lineItems.some((item) => item.productTitle.trim().length >= 1 && item.quantity >= 1);
  }

  // ── Submit ──

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerCompany: customerCompany.trim() || undefined,
      accountId: selectedAccount?.id,
      shippingAddress: addrLine1.trim()
        ? {
            line1: addrLine1.trim(),
            line2: addrLine2.trim() || undefined,
            city: addrCity.trim() || undefined,
            state: addrState.trim() || undefined,
            postcode: addrPostcode.trim() || undefined,
            country: addrCountry.trim() || "GB",
          }
        : undefined,
      note: note.trim() || undefined,
      dueAt: dueAt || undefined,
      lineItems: lineItems
        .filter((item) => item.productTitle.trim())
        .map((item) => {
          // Build variant title with size breakdown
          let variant = item.variantTitle.trim();
          if (item.sizeQuantities && item.productDetail) {
            const sizeBreakdown = item.productDetail.sizes
              .filter((s) => s.code !== "MS" && (item.sizeQuantities?.[s.id] ?? 0) > 0)
              .map((s) => `${s.code}×${item.sizeQuantities![s.id]}`)
              .join(", ");
            if (sizeBreakdown) {
              variant = variant ? `${variant} (${sizeBreakdown})` : sizeBreakdown;
            }
          }
          return {
            sku: item.sku.trim() || undefined,
            productTitle: item.productTitle.trim(),
            variantTitle: variant || undefined,
            quantity: item.quantity,
            decorationMethod: item.decorationMethod || undefined,
            placement: (item.placements ?? [item.placement]).join(", ") || undefined,
            unitPricePounds: item.unitPrice ? parseFloat(item.unitPrice) : undefined,
            decoProductId: item.decoProductId,
          };
        }),
    };

    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        jobId?: string;
        internalJobId?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setSubmitError(data.error ?? "Failed to create quote.");
        return;
      }
      setResult({ jobId: data.jobId!, internalJobId: data.internalJobId! });
    } catch {
      setSubmitError("Network error creating quote.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success view ──

  if (result) {
    return (
      <div className="space-y-6">
        <div className="surface p-8 text-center space-y-4">
          <div className="text-4xl">✓</div>
          <h2 className="text-xl font-semibold" style={{ color: "var(--success)" }}>
            Quote Created
          </h2>
          <p style={{ color: "var(--text-secondary)" }}>
            Job <span className="font-mono font-semibold">{result.internalJobId}</span> has been
            created.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              className="btn btn--primary"
              onClick={() => router.push(`/jobs/${result.jobId}`)}
            >
              View Job
            </button>
            <button
              className="btn"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onClick={() => {
                setResult(null);
                setStep("Customer");
                setCustomerName("");
                setCustomerEmail("");
                setCustomerPhone("");
                setCustomerCompany("");
                setSelectedAccount(null);
                setAccountSearch("");
                setAddrLine1("");
                setAddrLine2("");
                setAddrCity("");
                setAddrState("");
                setAddrPostcode("");
                setNote("");
                setDueAt("");
                setLineItems([emptyLine()]);
              }}
            >
              New Quote
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Stepper ──

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className="h-px w-8"
                style={{
                  background: i <= stepIndex ? "var(--accent)" : "var(--border)",
                }}
              />
            )}
            <button
              onClick={() => {
                if (i < stepIndex) setStep(s);
              }}
              disabled={i > stepIndex}
              className="flex items-center gap-2 text-sm font-medium transition-colors"
              style={{
                color: i === stepIndex ? "var(--accent-light)" : i < stepIndex ? "var(--text-primary)" : "var(--text-tertiary)",
                cursor: i <= stepIndex ? "pointer" : "default",
              }}
            >
              <span
                className="flex items-center justify-center rounded-full text-xs font-bold"
                style={{
                  width: 24,
                  height: 24,
                  background: i <= stepIndex ? "var(--accent)" : "rgba(255,255,255,0.06)",
                  color: i <= stepIndex ? "white" : "var(--text-tertiary)",
                }}
              >
                {i < stepIndex ? "✓" : i + 1}
              </span>
              {s}
            </button>
          </div>
        ))}
      </div>

      {/* ═══════ Step 1: Customer ═══════ */}
      {step === "Customer" && (
        <div className="space-y-4">
          {/* Account search */}
          <div className="surface p-5 space-y-4">
            <h3 className="eyebrow">Select Account</h3>
            <div className="relative" ref={dropdownRef}>
              {selectedAccount ? (
                <div className="flex items-center gap-3">
                  <div
                    className="pill"
                    style={{
                      background: "var(--accent-soft)",
                      color: "var(--accent-light)",
                      border: "1px solid rgba(99,102,241,0.2)",
                    }}
                  >
                    {selectedAccount.name}
                    {selectedAccount.type !== "CLIENT" && (
                      <span className="opacity-60 ml-1">({selectedAccount.type})</span>
                    )}
                  </div>
                  <button
                    onClick={clearAccount}
                    className="text-xs transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={accountSearch}
                    onChange={(e) => {
                      setAccountSearch(e.target.value);
                      setShowAccountDropdown(true);
                    }}
                    onFocus={() => setShowAccountDropdown(true)}
                    placeholder="Search accounts by name..."
                    className="input w-full"
                  />
                  {showAccountDropdown && (
                    <div
                      className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-xl border"
                      style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}
                    >
                      {accountsLoading ? (
                        <div className="p-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                          Searching...
                        </div>
                      ) : accounts.length === 0 ? (
                        <div className="p-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                          No accounts found. Enter customer details manually below.
                        </div>
                      ) : (
                        accounts.map((acct) => (
                          <button
                            key={acct.id}
                            onClick={() => selectAccount(acct)}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors flex items-center justify-between"
                          >
                            <div>
                              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                {acct.name}
                              </div>
                              {acct.aliases.length > 0 && (
                                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                                  {acct.aliases
                                    .slice(0, 3)
                                    .map((a) => a.aliasRaw)
                                    .join(", ")}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="pill pill--ghost text-[10px]">{acct.type}</span>
                              {acct.decoCustomerId && (
                                <span className="pill pill--ghost text-[10px]">Deco</span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Customer details */}
          <div className="surface p-5 space-y-4">
            <h3 className="eyebrow">Customer Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                  Name *
                </label>
                <input
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name"
                  className="input w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="input w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone number"
                  className="input w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                  Company
                </label>
                <input
                  value={customerCompany}
                  onChange={(e) => setCustomerCompany(e.target.value)}
                  placeholder="Company / school / club name"
                  className="input w-full"
                />
              </div>
            </div>
          </div>

          {/* Shipping address */}
          <div className="surface p-5 space-y-4">
            <h3 className="eyebrow">Shipping Address</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={addrLine1}
                onChange={(e) => setAddrLine1(e.target.value)}
                placeholder="Address line 1"
                className="input w-full sm:col-span-2"
              />
              <input
                value={addrLine2}
                onChange={(e) => setAddrLine2(e.target.value)}
                placeholder="Address line 2"
                className="input w-full sm:col-span-2"
              />
              <input
                value={addrCity}
                onChange={(e) => setAddrCity(e.target.value)}
                placeholder="City"
                className="input w-full"
              />
              <input
                value={addrState}
                onChange={(e) => setAddrState(e.target.value)}
                placeholder="County / State"
                className="input w-full"
              />
              <input
                value={addrPostcode}
                onChange={(e) => setAddrPostcode(e.target.value)}
                placeholder="Postcode"
                className="input w-full"
              />
              <select
                value={addrCountry}
                onChange={(e) => setAddrCountry(e.target.value)}
                className="input w-full"
              >
                <option value="GB">United Kingdom</option>
                <option value="IE">Ireland</option>
                <option value="US">United States</option>
                <option value="AU">Australia</option>
                <option value="NZ">New Zealand</option>
              </select>
            </div>
          </div>

          {/* Note & due date */}
          <div className="surface p-5 space-y-4">
            <h3 className="eyebrow">Notes &amp; Due Date</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Order notes..."
                rows={3}
                className="input w-full sm:col-span-2 resize-y"
              />
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              className="btn btn--primary"
              disabled={!canProceedFromCustomer()}
              onClick={() => setStep("Products")}
            >
              Next: Add Products →
            </button>
          </div>
        </div>
      )}

      {/* ═══════ Step 2: Products & line items ═══════ */}
      {step === "Products" && (
        <div className="space-y-4">
          {/* Inventory status bar */}
          <div className="surface p-3 flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              {inventoryLoading
                ? "Loading inventory..."
                : `${inventory.length} inventory items loaded`}
            </span>
            <button
              onClick={fetchInventory}
              className="text-xs font-medium"
              style={{ color: "var(--accent-light)" }}
            >
              Refresh
            </button>
          </div>

          {/* Line items */}
          {lineItems.map((item, idx) => {
            const inv = getInventoryForSku(item.sku);
            const detail = item.productDetail;
            const sizeTotalQty = calcSizeQuantitiesTotal(item.sizeQuantities);
            return (
              <div key={item.id} className="surface p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="eyebrow">Item {idx + 1}</h3>
                  {lineItems.length > 1 && (
                    <button
                      onClick={() => removeLineItem(item.id)}
                      className="text-xs"
                      style={{ color: "var(--danger)" }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Product search / manual entry */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2 space-y-1 relative">
                    <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                      Product
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={item.productTitle}
                        onChange={(e) => {
                          updateLineItem(item.id, { productTitle: e.target.value });
                          if (e.target.value.trim().length >= 2) {
                            setShowProductPicker(item.id);
                            setProductSearch(e.target.value.trim());
                          }
                        }}
                        placeholder="Product name or code..."
                        className="input w-full"
                      />
                      <button
                        onClick={() => {
                          setShowProductPicker(showProductPicker === item.id ? null : item.id);
                          setProductSearch("");
                        }}
                        className="btn text-xs shrink-0"
                        style={{
                          border: "1px solid var(--border)",
                          color: "var(--accent-light)",
                          fontSize: "0.75rem",
                        }}
                      >
                        Browse
                      </button>
                    </div>

                    {/* Product picker dropdown */}
                    {showProductPicker === item.id && (
                      <div
                        className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-xl border"
                        style={{ background: "var(--bg-raised)", borderColor: "var(--border)" }}
                      >
                        <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
                          <input
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="Search Deco products..."
                            className="input w-full"
                            autoFocus
                          />
                        </div>
                        {productsLoading ? (
                          <div className="p-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                            Loading products...
                          </div>
                        ) : products.length === 0 ? (
                          <div className="p-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                            No products found.
                          </div>
                        ) : (
                          products.map((prod) => {
                            const prodInv = inventory.find(
                              (i) => i.sku.toLowerCase() === (prod.sku ?? "").toLowerCase(),
                            );
                            return (
                              <button
                                key={prod.decoProductId ?? prod.sku}
                                onClick={() => pickProduct(item.id, prod)}
                                className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b"
                                style={{ borderColor: "var(--border)" }}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                      {prod.name}
                                    </div>
                                    <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                                      {prod.sku}
                                      {prod.category ? ` · ${prod.category}` : ""}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    {prod.price != null && (
                                      <span style={{ color: "var(--text-secondary)" }}>
                                        £{prod.price.toFixed(2)}
                                      </span>
                                    )}
                                    {prodInv ? (
                                      <span
                                        className="pill text-[10px]"
                                        style={{
                                          background:
                                            prodInv.available > 0
                                              ? "var(--success-soft)"
                                              : "var(--danger-soft)",
                                          color:
                                            prodInv.available > 0
                                              ? "var(--success)"
                                              : "var(--danger)",
                                        }}
                                      >
                                        {prodInv.available} avail
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                      SKU
                    </label>
                    <input
                      value={item.sku}
                      onChange={(e) => updateLineItem(item.id, { sku: e.target.value })}
                      placeholder="SKU"
                      className="input w-full font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                      Variant
                    </label>
                    <input
                      value={item.variantTitle}
                      onChange={(e) => updateLineItem(item.id, { variantTitle: e.target.value })}
                      placeholder="Size / colour"
                      className="input w-full"
                      readOnly={!!detail}
                    />
                  </div>
                </div>

                {/* Loading product detail */}
                {item.productDetailLoading && (
                  <div className="flex items-center gap-2 text-xs py-2" style={{ color: "var(--text-tertiary)" }}>
                    <span className="animate-spin">⟳</span> Loading product details from Deco...
                  </div>
                )}

                {/* ── Rich Product Card (when detail is loaded) ── */}
                {detail && (
                  <div className="space-y-4 border rounded-xl p-4" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
                    {/* Product header with image */}
                    <div className="flex items-start gap-4">
                      {/* Product image */}
                      {(() => {
                        const selectedColor = detail.colors.find((c) => c.id === item.selectedColorId);
                        const colorImage = selectedColor
                          ? detail.images?.find(
                              (img) =>
                                img.type === "front" &&
                                img.color?.toLowerCase() === selectedColor.name.toLowerCase(),
                            )
                          : undefined;
                        const displayImage = colorImage ?? detail.images?.[0];

                        return displayImage ? (
                          <div
                            className="shrink-0 rounded-lg overflow-hidden border"
                            style={{ borderColor: "var(--border)", width: 96, height: 96, background: "#fff" }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={displayImage.url}
                              alt={detail.productName}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div
                            className="shrink-0 flex items-center justify-center rounded-lg border"
                            style={{ borderColor: "var(--border)", width: 96, height: 96, background: "rgba(255,255,255,0.05)" }}
                          >
                            <span className="text-3xl">
                              {detail.category?.toLowerCase().includes("polo") ? "👕" :
                               detail.category?.toLowerCase().includes("hoodie") || detail.category?.toLowerCase().includes("sweat") ? "🧥" :
                               detail.category?.toLowerCase().includes("cap") || detail.category?.toLowerCase().includes("hat") ? "🧢" :
                               detail.category?.toLowerCase().includes("bag") ? "👜" :
                               detail.category?.toLowerCase().includes("jacket") ? "🧥" :
                               detail.category?.toLowerCase().includes("trouser") || detail.category?.toLowerCase().includes("pant") ? "👖" :
                               "👕"}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Product info */}
                      <div className="flex-1 flex items-start justify-between min-w-0">
                        <div>
                          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {detail.productName}
                          </div>
                          <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                            {detail.productCode} · {detail.supplier}{detail.brand ? ` / ${detail.brand}` : ""} · {detail.category}
                          </div>
                          {/* Image thumbnail strip */}
                          {(detail.images?.length ?? 0) > 1 && (
                            <div className="flex gap-1.5 mt-2">
                              {detail.images!.slice(0, 6).map((img, imgIdx) => (
                                <div
                                  key={imgIdx}
                                  className="rounded border overflow-hidden"
                                  style={{ width: 36, height: 36, borderColor: "var(--border)", background: "#fff" }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={img.url}
                                    alt={img.color ?? `view ${imgIdx + 1}`}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              ))}
                              {(detail.images?.length ?? 0) > 6 && (
                                <div
                                  className="rounded border flex items-center justify-center text-[9px]"
                                  style={{ width: 36, height: 36, borderColor: "var(--border)", color: "var(--text-tertiary)" }}
                                >
                                  +{detail.images!.length - 6}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-semibold font-mono" style={{ color: "var(--accent-light)" }}>
                            £{parseFloat(item.unitPrice || "0").toFixed(2)}
                          </div>
                          <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>per unit</div>
                        </div>
                      </div>
                    </div>

                    {/* Colour selector */}
                    {detail.colors.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                          Colour ({detail.colors.length} available)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {detail.colors.map((color) => {
                            const isActive = item.selectedColorId === color.id;
                            const colorPrice = getSkuPrice(detail, color.id, detail.sizes[0]?.id ?? 0);
                            return (
                              <button
                                key={color.id}
                                onClick={() => selectColor(item.id, color.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                                style={{
                                  borderColor: isActive ? "var(--accent)" : "var(--border)",
                                  background: isActive ? "var(--accent-soft)" : "transparent",
                                  color: isActive ? "var(--accent-light)" : "var(--text-secondary)",
                                  boxShadow: isActive ? "0 0 0 1px var(--accent)" : "none",
                                }}
                              >
                                <span
                                  className="inline-block w-3 h-3 rounded-full mr-1.5 border align-middle"
                                  style={{
                                    borderColor: "var(--border)",
                                    background: color.name.toLowerCase() === "black" ? "#111" :
                                      color.name.toLowerCase() === "white" ? "#f8f8f8" :
                                      color.name.toLowerCase() === "navy" ? "#1a237e" :
                                      color.name.toLowerCase() === "red" ? "#c62828" :
                                      color.name.toLowerCase() === "royal" || color.name.toLowerCase() === "royal blue" ? "#1565c0" :
                                      color.name.toLowerCase() === "grey" || color.name.toLowerCase() === "gray" ? "#9e9e9e" :
                                      color.name.toLowerCase() === "bottle" || color.name.toLowerCase() === "bottle green" ? "#1b5e20" :
                                      color.name.toLowerCase() === "green" ? "#2e7d32" :
                                      color.name.toLowerCase() === "yellow" ? "#f9a825" :
                                      color.name.toLowerCase() === "orange" ? "#e65100" :
                                      color.name.toLowerCase() === "pink" ? "#ec407a" :
                                      color.name.toLowerCase() === "purple" ? "#7b1fa2" :
                                      color.name.toLowerCase() === "sky" || color.name.toLowerCase() === "sky blue" ? "#4fc3f7" :
                                      color.name.toLowerCase() === "burgundy" || color.name.toLowerCase() === "maroon" ? "#880e4f" :
                                      color.name.toLowerCase() === "charcoal" ? "#424242" :
                                      "var(--border)",
                                  }}
                                />
                                {color.name}
                                {colorPrice != null && (
                                  <span className="ml-1 opacity-60">£{colorPrice.toFixed(2)}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Size / Quantity Grid */}
                    {detail.sizes.length > 0 && item.sizeQuantities && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                            Size Breakdown
                          </label>
                          <span className="text-xs font-mono" style={{ color: sizeTotalQty > 0 ? "var(--accent-light)" : "var(--text-tertiary)" }}>
                            Total: {sizeTotalQty}
                          </span>
                        </div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(detail.sizes.filter(s => s.code !== "MS").length, 8)}, 1fr)` }}>
                          {detail.sizes
                            .filter((s) => s.code !== "MS")
                            .map((size) => {
                              const qty = item.sizeQuantities?.[size.id] ?? 0;
                              const skuPrice = item.selectedColorId
                                ? getSkuPrice(detail, item.selectedColorId, size.id)
                                : undefined;
                              return (
                                <div key={size.id} className="text-center space-y-1">
                                  <div className="text-[10px] font-bold" style={{ color: "var(--text-tertiary)" }}>
                                    {size.code}
                                  </div>
                                  <input
                                    type="number"
                                    min={0}
                                    value={qty}
                                    onChange={(e) => updateSizeQty(item.id, size.id, parseInt(e.target.value) || 0)}
                                    className="input w-full text-center text-sm font-mono"
                                    style={{ padding: "4px 2px" }}
                                  />
                                  {skuPrice != null && (
                                    <div className="text-[9px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                                      £{skuPrice.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Decoration Placement (visual multi-select) */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                        Decoration Placements (select all that apply)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {PLACEMENTS.map((p) => {
                          const isActive = (item.placements ?? [item.placement]).includes(p.key);
                          return (
                            <button
                              key={p.key}
                              onClick={() => togglePlacement(item.id, p.key)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border"
                              style={{
                                borderColor: isActive ? "var(--accent)" : "var(--border)",
                                background: isActive ? "var(--accent-soft)" : "transparent",
                                color: isActive ? "var(--accent-light)" : "var(--text-secondary)",
                              }}
                            >
                              <span className="text-base">{p.icon}</span>
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Designer button + design summary */}
                    <div className="space-y-3">
                      <button
                        onClick={() => setDesignerLineId(item.id)}
                        className="btn text-sm w-full flex items-center justify-center gap-2 py-2.5"
                        style={{
                          border: `1px solid ${item.designs?.length ? "var(--accent)" : "var(--border)"}`,
                          color: item.designs?.length ? "var(--accent-light)" : "var(--text-secondary)",
                          background: item.designs?.length ? "var(--accent-soft)" : "transparent",
                        }}
                      >
                        🎨 {item.designs?.length
                          ? `Designer (${item.designs.length} placement${item.designs.length > 1 ? "s" : ""} configured)`
                          : "Open Designer — Upload Artwork & Configure Designs"}
                      </button>
                      {item.designs && item.designs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {item.designs.map((d, dIdx) => (
                            <div
                              key={dIdx}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                              style={{
                                background: "var(--accent-soft)",
                                color: "var(--accent-light)",
                                border: "1px solid rgba(99,102,241,0.3)",
                              }}
                            >
                              <span>{PLACEMENTS.find((p) => p.key === d.placement)?.icon ?? "📍"}</span>
                              {PLACEMENTS.find((p) => p.key === d.placement)?.label ?? d.placement}
                              {d.decorationMethod && (
                                <span className="opacity-70">
                                  · {DECORATION_METHODS.find((m) => m.key === d.decorationMethod)?.label ?? d.decorationMethod}
                                </span>
                              )}
                              {d.artworkName && (
                                <span className="opacity-60">· 📎 {d.artworkName}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Fallback: simple fields when no product detail */}
                {!detail && !item.productDetailLoading && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                        Qty *
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                        }
                        className="input w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                        Unit Price (£)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(item.id, { unitPrice: e.target.value })}
                        placeholder="0.00"
                        className="input w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                        Decoration
                      </label>
                      <select
                        value={item.decorationMethod}
                        onChange={(e) => updateLineItem(item.id, { decorationMethod: e.target.value })}
                        className="input w-full"
                      >
                        {DECORATION_METHODS.map((m) => (
                          <option
                            key={m.key}
                            value={m.key}
                            className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                          >
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                        Placement
                      </label>
                      <select
                        value={item.placement}
                        onChange={(e) => updateLineItem(item.id, { placement: e.target.value })}
                        className="input w-full"
                      >
                        <option value="front">Front</option>
                        <option value="back">Back</option>
                        <option value="left_chest">Left Chest</option>
                        <option value="right_chest">Right Chest</option>
                        <option value="left_sleeve">Left Sleeve</option>
                        <option value="right_sleeve">Right Sleeve</option>
                        <option value="collar">Collar</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                        Line Total
                      </label>
                      <div className="input w-full flex items-center font-mono text-sm" style={{ color: "var(--text-secondary)" }}>
                        £{calcLineTotal(item).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                {/* When detail loaded: show summary row with decoration, qty, total */}
                {detail && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                        Decoration
                      </label>
                      <select
                        value={item.decorationMethod}
                        onChange={(e) => updateLineItem(item.id, { decorationMethod: e.target.value })}
                        className="input w-full"
                      >
                        {DECORATION_METHODS.map((m) => (
                          <option
                            key={m.key}
                            value={m.key}
                            className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                          >
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                        Unit Price (£)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(item.id, { unitPrice: e.target.value })}
                        placeholder="0.00"
                        className="input w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                        Total Qty
                      </label>
                      <div className="input w-full flex items-center font-mono text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        {item.quantity}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                        Line Total
                      </label>
                      <div className="input w-full flex items-center font-mono text-sm font-bold" style={{ color: "var(--accent-light)" }}>
                        £{calcLineTotal(item).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Inventory info */}
                {inv && (
                  <div
                    className="flex items-center gap-4 text-xs px-3 py-2 rounded-lg"
                    style={{
                      background: inv.available >= item.quantity ? "var(--success-soft)" : "var(--warning-soft)",
                      color: inv.available >= item.quantity ? "var(--success)" : "var(--warning)",
                    }}
                  >
                    <span>Available: {inv.available}</span>
                    <span>On Hand: {inv.onHand}</span>
                    <span>On Order: {inv.onOrder}</span>
                    {inv.available < item.quantity && <span className="font-semibold">⚠ Low stock</span>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add item + total */}
          <div className="flex items-center justify-between">
            <button
              onClick={addLineItem}
              className="btn text-sm"
              style={{ border: "1px solid var(--border)", color: "var(--accent-light)" }}
            >
              + Add Item
            </button>
            <div className="text-right">
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Total
              </div>
              <div className="text-lg font-semibold font-mono">£{calcGrandTotal().toFixed(2)}</div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              className="btn"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onClick={() => setStep("Customer")}
            >
              ← Back
            </button>
            <button
              className="btn btn--primary"
              disabled={!canProceedFromProducts()}
              onClick={() => setStep("Review")}
            >
              Next: Review →
            </button>
          </div>
        </div>
      )}

      {/* ═══════ Step 3: Review & Submit ═══════ */}
      {step === "Review" && (
        <div className="space-y-4">
          {/* Customer summary */}
          <div className="surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="eyebrow">Customer</h3>
              <button
                onClick={() => setStep("Customer")}
                className="text-xs"
                style={{ color: "var(--accent-light)" }}
              >
                Edit
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <div>
                <span style={{ color: "var(--text-tertiary)" }}>Name: </span>
                <span>{customerName}</span>
              </div>
              {customerEmail && (
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>Email: </span>
                  <span>{customerEmail}</span>
                </div>
              )}
              {customerCompany && (
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>Company: </span>
                  <span>{customerCompany}</span>
                </div>
              )}
              {selectedAccount && (
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>Account: </span>
                  <span className="pill pill--ghost text-[10px]">{selectedAccount.name}</span>
                </div>
              )}
              {addrLine1 && (
                <div className="sm:col-span-2">
                  <span style={{ color: "var(--text-tertiary)" }}>Ship to: </span>
                  <span>
                    {[addrLine1, addrLine2, addrCity, addrState, addrPostcode]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}
              {dueAt && (
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>Due: </span>
                  <span>{dueAt}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line items summary */}
          <div className="surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="eyebrow">Line Items ({lineItems.filter((i) => i.productTitle).length})</h3>
              <button
                onClick={() => setStep("Products")}
                className="text-xs"
                style={{ color: "var(--accent-light)" }}
              >
                Edit
              </button>
            </div>
            <div className="space-y-2">
              {lineItems
                .filter((i) => i.productTitle.trim())
                .map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {idx + 1}. {item.productTitle}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {item.sku && `${item.sku} · `}
                        {item.variantTitle && `${item.variantTitle} · `}
                        {DECORATION_METHODS.find((m) => m.key === item.decorationMethod)?.label ??
                          item.decorationMethod}
                        {(item.placements ?? [item.placement]).length > 0 && (
                          <> · {(item.placements ?? [item.placement]).map((p) =>
                            PLACEMENTS.find((pl) => pl.key === p)?.label ?? p
                          ).join(", ")}</>
                        )}
                        {item.sizeQuantities && Object.values(item.sizeQuantities).some((q) => q > 0) && item.productDetail && (
                          <> · Sizes: {item.productDetail.sizes
                            .filter((s) => s.code !== "MS" && (item.sizeQuantities?.[s.id] ?? 0) > 0)
                            .map((s) => `${s.code}×${item.sizeQuantities![s.id]}`)
                            .join(", ")}</>
                        )}
                      </div>
                      {item.designs && item.designs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.designs.map((d, dIdx) => (
                            <span
                              key={dIdx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                              style={{
                                background: "var(--accent-soft)",
                                color: "var(--accent-light)",
                              }}
                            >
                              {PLACEMENTS.find((p) => p.key === d.placement)?.label ?? d.placement}
                              {d.decorationMethod && ` · ${DECORATION_METHODS.find((m) => m.key === d.decorationMethod)?.label ?? d.decorationMethod}`}
                              {d.artworkName && " · 📎"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono">
                        {item.quantity} × £{parseFloat(item.unitPrice || "0").toFixed(2)}
                      </div>
                      <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                        £{calcLineTotal(item).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <div className="flex justify-end pt-2">
              <div className="text-right">
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  Grand Total
                </div>
                <div className="text-xl font-semibold font-mono">£{calcGrandTotal().toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {note && (
            <div className="surface p-5 space-y-2">
              <h3 className="eyebrow">Notes</h3>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                {note}
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between">
            <button
              className="btn"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              onClick={() => setStep("Products")}
            >
              ← Back
            </button>
            <button
              className="btn btn--primary px-6"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Creating..." : "Create Quote"}
            </button>
          </div>

          {submitError && (
            <div className="text-sm p-3 rounded-lg" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
              {submitError}
            </div>
          )}
        </div>
      )}

      {/* ═══════ Designer Modal ═══════ */}
      {designerLineId && (() => {
        const designItem = lineItems.find((i) => i.id === designerLineId);
        if (!designItem?.productDetail) return null;
        return (
          <DesignerModal
            open={true}
            onClose={() => setDesignerLineId(null)}
            onApply={(designs) => applyDesigns(designerLineId, designs)}
            productDetail={designItem.productDetail}
            selectedColorId={designItem.selectedColorId}
            initialDesigns={designItem.designs}
          />
        );
      })()}
    </div>
  );
}
