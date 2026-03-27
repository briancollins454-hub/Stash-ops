"use client";

import { useState, useEffect } from "react";
import { Decorator } from "@/components/decorator/decorator";
import type { DesignerProductDetail, DesignConfig } from "@/components/decorator/types";
import type { ProductionBatchDetail } from "@/lib/types";

interface Props {
  batch: ProductionBatchDetail;
}

export function BatchDecoratorButton({ batch }: Props) {
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState<DesignConfig[]>([]);
  const [productDetail, setProductDetail] = useState<DesignerProductDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If we have a recognized product code, load its details including visuals
    if (batch.normalizedProduct && batch.normalizedProduct !== "Unknown") {
      setLoading(true);
      fetch(`/api/decorator/products/${encodeURIComponent(batch.normalizedProduct)}`)
        .then((res) => {
          if (!res.ok) throw new Error("Not found");
          return res.json();
        })
        .then((data) => {
          setProductDetail(data);
        })
        .catch(() => {
          // Keep it null so we construct the fallback dynamically on open
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [batch.normalizedProduct]);

  // Construct a fallback mapped product detail from the batch info if actual product fails to load
  const fallbackProductDetail: DesignerProductDetail = {
    productName: batch.displayTitle,
    productCode: batch.normalizedProduct || "BATCH-CUSTOM",
    supplier: "Batch Provider",
    brand: batch.accountName,
    colors: batch.colour ? [{ id: 1, name: batch.colour }] : [{ id: 1, name: "Default" }],
    sizes: batch.items.map((item, i) => ({ id: i + 1, code: item.size })),
    images: []
  };

  const finalProductDetail = productDetail || fallbackProductDetail;

  const handleApply = (newDesigns: DesignConfig[]) => {
    setDesigns(newDesigns);
    setOpen(false);
    // Here you would typically save the designs to the backend API for the batch
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={loading}
        className="inline-block rounded-md px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "#6366f1", color: "#fff" }}
      >
        {loading ? "Loading..." : designs.length > 0 ? `Edit Placements (${designs.length})` : "Open Decorator"}
      </button>

      {open && (
        <Decorator
          open={open}
          onClose={() => setOpen(false)}
          onApply={handleApply}
          productDetail={finalProductDetail}
          selectedColorId={finalProductDetail.colors.find(c => c.name.toLowerCase() === batch.colour?.toLowerCase() || c.name === batch.colour)?.id || 1}
          initialDesigns={designs}
          accountId={batch.accountId}
        />
      )}
    </>
  );
}
