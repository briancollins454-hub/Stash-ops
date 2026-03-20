"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  unitPrice: string;
  decoProductId?: string;
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

function emptyLine(): LineItem {
  return {
    id: crypto.randomUUID(),
    sku: "",
    productTitle: "",
    variantTitle: "",
    quantity: 1,
    decorationMethod: "dtf",
    placement: "front",
    unitPrice: "",
    decoProductId: undefined,
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
  }

  function clearAccount() {
    setSelectedAccount(null);
    setAccountSearch("");
    setCustomerName("");
    setCustomerCompany("");
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
    });
    setShowProductPicker(null);
    setProductSearch("");
  }

  function getInventoryForSku(sku: string): InventoryItem | undefined {
    if (!sku) return undefined;
    return inventory.find((i) => i.sku.toLowerCase() === sku.toLowerCase());
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
        .map((item) => ({
          sku: item.sku.trim() || undefined,
          productTitle: item.productTitle.trim(),
          variantTitle: item.variantTitle.trim() || undefined,
          quantity: item.quantity,
          decorationMethod: item.decorationMethod || undefined,
          placement: item.placement.trim() || undefined,
          unitPricePounds: item.unitPrice ? parseFloat(item.unitPrice) : undefined,
          decoProductId: item.decoProductId,
        })),
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
              <div className="space-y-1 sm:col-span-2">
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
            return (
              <div key={item.id} className="surface p-5 space-y-3">
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
                        onChange={(e) => updateLineItem(item.id, { productTitle: e.target.value })}
                        placeholder="Product name or search Deco catalog..."
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
                                    {prod.price !== undefined && (
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
                    />
                  </div>
                </div>

                {/* Quantity, price, decoration */}
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
                        {item.placement && ` · ${item.placement}`}
                      </div>
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
    </div>
  );
}
