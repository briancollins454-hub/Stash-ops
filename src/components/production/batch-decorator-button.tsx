"use client";

import { useState } from "react";
import { Decorator } from "@/components/decorator/decorator";
import type { DesignerProductDetail, DesignConfig } from "@/components/decorator/types";
import type { ProductionBatchDetail } from "@/lib/types";

interface Props {
  batch: ProductionBatchDetail;
}

export function BatchDecoratorButton({ batch }: Props) {
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState<DesignConfig[]>([]);

  // Construct a dummy or mapped product detail from the batch info
  const productDetail: DesignerProductDetail = {
    productName: batch.displayTitle,
    productCode: batch.normalizedProduct || "BATCH-CUSTOM",
    supplier: "Batch Provider",
    brand: batch.accountName,
    colors: batch.colour ? [{ id: 1, name: batch.colour }] : [{ id: 1, name: "Default" }],
    sizes: batch.items.map((item, i) => ({ id: i + 1, code: item.size })),
    images: [] // You might want to pull actual images if available in your batch data
  };

  const handleApply = (newDesigns: DesignConfig[]) => {
    setDesigns(newDesigns);
    setOpen(false);
    // Here you would typically save the designs to the backend API for the batch
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-block rounded-md px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: "#6366f1", color: "#fff" }}
      >
        {designs.length > 0 ? `Edit Placements (${designs.length})` : "Open Decorator"}
      </button>

      {open && (
        <Decorator
          open={open}
          onClose={() => setOpen(false)}
          onApply={handleApply}
          productDetail={productDetail}
          selectedColorId={1}
          initialDesigns={designs}
          accountId={batch.accountId}
        />
      )}
    </>
  );
}
