import type {
  AccountingRecord,
  Approval,
  InboxThread,
  IntegrationHealth,
  Order,
  ProductionJob,
} from "@/lib/types";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function orderTone(status: Order["status"]) {
  switch (status) {
    case "Artwork":
      return "border-[#ef4444]/25 bg-[#ef4444]/10 text-[#fca5a5]";
    case "Approval":
      return "border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#fcd34d]";
    case "Stock":
      return "border-[#a78bfa]/25 bg-[#a78bfa]/10 text-[#c4b5fd]";
    case "Queued":
      return "border-[#64748b]/25 bg-[#64748b]/10 text-[#94a3b8]";
    case "Printing":
      return "border-[#10b981]/25 bg-[#10b981]/10 text-[#6ee7b7]";
    case "Complete":
      return "border-[#6366f1]/25 bg-[#6366f1]/10 text-[#a5b4fc]";
    case "On hold":
      return "border-[#f97316]/25 bg-[#f97316]/10 text-[#fdba74]";
    case "Cancelled":
      return "border-[#475569]/20 bg-[#475569]/8 text-[#64748b]";
    default:
      return "border-[#64748b]/20 bg-[#64748b]/8 text-[#94a3b8]";
  }
}

export function approvalTone(status: Approval["status"]) {
  switch (status) {
    case "Needs proof":
      return "border-[#ef4444]/25 bg-[#ef4444]/10 text-[#fca5a5]";
    case "Awaiting client":
      return "border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#fcd34d]";
    case "Approved":
      return "border-[#10b981]/25 bg-[#10b981]/10 text-[#6ee7b7]";
  }
}

export function priorityTone(priority: InboxThread["priority"]) {
  return priority === "High"
    ? "border-[#ef4444]/25 bg-[#ef4444]/10 text-[#fca5a5]"
    : "border-[#64748b]/20 bg-[#64748b]/8 text-[#94a3b8]";
}

export function healthTone(health: IntegrationHealth["health"]) {
  switch (health) {
    case "Healthy":
      return "border-[#10b981]/25 bg-[#10b981]/10 text-[#6ee7b7]";
    case "Lagging":
      return "border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#fcd34d]";
    case "Action needed":
      return "border-[#ef4444]/25 bg-[#ef4444]/10 text-[#fca5a5]";
  }
}

export function accountingTone(status: AccountingRecord["qboStatus"]) {
  switch (status) {
    case "Posted":
      return "border-[#10b981]/25 bg-[#10b981]/10 text-[#6ee7b7]";
    case "Ready":
      return "border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#fcd34d]";
    case "Mismatch":
      return "border-[#ef4444]/25 bg-[#ef4444]/10 text-[#fca5a5]";
  }
}

export function productionTone(stage: ProductionJob["stage"]) {
  switch (stage) {
    case "Preflight":
      return "border-[#ef4444]/25 bg-[#ef4444]/10 text-[#fca5a5]";
    case "Waiting on stock":
      return "border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#fcd34d]";
    case "Ready for print":
      return "border-[#10b981]/25 bg-[#10b981]/10 text-[#6ee7b7]";
    case "On press":
      return "border-[#6366f1]/25 bg-[#6366f1]/10 text-[#a5b4fc]";
    case "Packing":
      return "border-[#64748b]/20 bg-[#64748b]/8 text-[#94a3b8]";
  }
}
