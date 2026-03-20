"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

const decorationMethods = [
  "dtf",
  "embroidery",
  "dtg",
  "screen_print",
  "sublimation",
  "other",
] as const;

type DecorationMethod = (typeof decorationMethods)[number];

type CreateOrderFormState = {
  customerName: string;
  company: string;
  email: string;
  productTitle: string;
  sku: string;
  quantity: string;
  unitPrice: string;
  decorationMethod: DecorationMethod;
  placement: string;
  city: string;
  state: string;
  postcode: string;
  dueAt: string;
  owner: string;
};

const initialState: CreateOrderFormState = {
  customerName: "",
  company: "",
  email: "",
  productTitle: "",
  sku: "",
  quantity: "24",
  unitPrice: "25",
  decorationMethod: "dtf",
  placement: "front",
  city: "",
  state: "",
  postcode: "",
  dueAt: "",
  owner: "",
};

function randomCustomerId() {
  return `CU-${Date.now().toString().slice(-6)}`;
}

export function CreateOrderForm() {
  const router = useRouter();
  const [form, setForm] = useState<CreateOrderFormState>(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreatedOrderId(null);
    setIsSaving(true);

    const quantity = Number(form.quantity);
    const unitPrice = Number(form.unitPrice);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be a number greater than 0.");
      setIsSaving(false);
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError("Unit price must be 0 or greater.");
      setIsSaving(false);
      return;
    }

    const payload = {
      customer: {
        customerId: randomCustomerId(),
        name: form.customerName.trim(),
        company: form.company.trim() || undefined,
        email: form.email.trim() || undefined,
      },
      billingAddress: {
        line1: "1 Commerce Way",
        city: form.city.trim() || "Unknown",
        state: form.state.trim() || undefined,
        postcode: form.postcode.trim() || undefined,
        country: "US",
      },
      shippingAddress: {
        line1: "1 Commerce Way",
        city: form.city.trim() || "Unknown",
        state: form.state.trim() || undefined,
        postcode: form.postcode.trim() || undefined,
        country: "US",
      },
      lineItems: [
        {
          lineId: `LI-${Date.now()}`,
          sku: form.sku.trim() || "UNKNOWN-SKU",
          productTitle: form.productTitle.trim() || "Custom item",
          quantity,
          unitPrice,
          decorationMethod: form.decorationMethod,
          decorationPlacement: form.placement.trim() || undefined,
        },
      ],
      owner: form.owner.trim() || undefined,
      dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      assignedDepartment: "ops" as const,
      urgency: "normal" as const,
    };

    try {
      const response = await fetch("/api/v1/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        error?: string;
        data?: {
          internalOrderId: string;
        };
      };

      if (!response.ok || !data.data?.internalOrderId) {
        setError(data.error ?? "Unable to create order.");
        setIsSaving(false);
        return;
      }

      setCreatedOrderId(data.data.internalOrderId);
      setForm(initialState);

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("Network error while creating order.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <input
        required
        value={form.customerName}
        onChange={(event) =>
          setForm((current) => ({ ...current, customerName: event.target.value }))
        }
        placeholder="Customer name"
        className="input"
      />
      <input
        value={form.company}
        onChange={(event) =>
          setForm((current) => ({ ...current, company: event.target.value }))
        }
        placeholder="Company"
        className="input"
      />
      <input
        type="email"
        value={form.email}
        onChange={(event) =>
          setForm((current) => ({ ...current, email: event.target.value }))
        }
        placeholder="Customer email"
        className="input"
      />
      <input
        value={form.owner}
        onChange={(event) =>
          setForm((current) => ({ ...current, owner: event.target.value }))
        }
        placeholder="Owner (optional)"
        className="input"
      />

      <input
        required
        value={form.productTitle}
        onChange={(event) =>
          setForm((current) => ({ ...current, productTitle: event.target.value }))
        }
        placeholder="Product title"
        className="input"
      />
      <input
        value={form.sku}
        onChange={(event) =>
          setForm((current) => ({ ...current, sku: event.target.value }))
        }
        placeholder="SKU"
        className="input"
      />
      <input
        required
        type="number"
        min={1}
        value={form.quantity}
        onChange={(event) =>
          setForm((current) => ({ ...current, quantity: event.target.value }))
        }
        placeholder="Qty"
        className="input"
      />
      <input
        required
        type="number"
        min={0}
        step="0.01"
        value={form.unitPrice}
        onChange={(event) =>
          setForm((current) => ({ ...current, unitPrice: event.target.value }))
        }
        placeholder="Unit price"
        className="input"
      />

      <select
        value={form.decorationMethod}
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            decorationMethod: event.target.value as DecorationMethod,
          }))
        }
        className="input"
      >
        {decorationMethods.map((method) => (
          <option
            key={method}
            value={method}
            className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
          >
            {method}
          </option>
        ))}
      </select>
      <input
        value={form.placement}
        onChange={(event) =>
          setForm((current) => ({ ...current, placement: event.target.value }))
        }
        placeholder="Placement (front, left chest...)"
        className="input"
      />
      <input
        value={form.city}
        onChange={(event) =>
          setForm((current) => ({ ...current, city: event.target.value }))
        }
        placeholder="City"
        className="input"
      />
      <input
        value={form.state}
        onChange={(event) =>
          setForm((current) => ({ ...current, state: event.target.value }))
        }
        placeholder="State"
        className="input"
      />
      <input
        value={form.postcode}
        onChange={(event) =>
          setForm((current) => ({ ...current, postcode: event.target.value }))
        }
        placeholder="Postcode"
        className="input"
      />
      <input
        type="datetime-local"
        value={form.dueAt}
        onChange={(event) =>
          setForm((current) => ({ ...current, dueAt: event.target.value }))
        }
        className="input"
      />

      <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isSaving}
          className="btn btn--primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Creating..." : "Create Order"}
        </button>
        {createdOrderId ? (
          <a
            href={`/orders/${createdOrderId}`}
            className="pill pill--ghost underline-offset-4 hover:underline"
          >
            Created {createdOrderId} - open order
          </a>
        ) : null}
        {error ? <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p> : null}
      </div>
    </form>
  );
}
