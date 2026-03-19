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
      return "border-[#f97366]/35 bg-[#f97366]/14 text-[#ffd1c8]";
    case "Approval":
      return "border-[#e3c96e]/35 bg-[#e3c96e]/14 text-[#f6e8bc]";
    case "Queued":
      return "border-[#8ea0c8]/28 bg-[#8ea0c8]/12 text-[#d7e3ff]";
    case "Printing":
      return "border-[#0ea5a0]/35 bg-[#0ea5a0]/22 text-[#b9fff5]";
    case "Shipping":
      return "border-[#3b82f6]/35 bg-[#3b82f6]/16 text-[#d6e8ff]";
    default:
      return "border-white/20 bg-white/[0.08] text-white/80";
  }
}

export function approvalTone(status: Approval["status"]) {
  switch (status) {
    case "Needs proof":
      return "border-[#f97366]/35 bg-[#f97366]/14 text-[#ffd1c8]";
    case "Awaiting client":
      return "border-[#e3c96e]/35 bg-[#e3c96e]/14 text-[#f6e8bc]";
    case "Approved":
      return "border-[#0ea5a0]/35 bg-[#0ea5a0]/18 text-[#b9fff5]";
  }
}

export function priorityTone(priority: InboxThread["priority"]) {
  return priority === "High"
    ? "border-[#f97366]/35 bg-[#f97366]/14 text-[#ffd1c8]"
    : "border-white/20 bg-white/10 text-white/75";
}

export function healthTone(health: IntegrationHealth["health"]) {
  switch (health) {
    case "Healthy":
      return "border-[#0ea5a0]/35 bg-[#0ea5a0]/18 text-[#b9fff5]";
    case "Lagging":
      return "border-[#e3c96e]/35 bg-[#e3c96e]/14 text-[#f6e8bc]";
    case "Action needed":
      return "border-[#f97366]/35 bg-[#f97366]/14 text-[#ffd1c8]";
  }
}

export function accountingTone(status: AccountingRecord["qboStatus"]) {
  switch (status) {
    case "Posted":
      return "border-[#0ea5a0]/35 bg-[#0ea5a0]/18 text-[#b9fff5]";
    case "Ready":
      return "border-[#e3c96e]/35 bg-[#e3c96e]/14 text-[#f6e8bc]";
    case "Mismatch":
      return "border-[#f97366]/35 bg-[#f97366]/14 text-[#ffd1c8]";
  }
}

export function productionTone(stage: ProductionJob["stage"]) {
  switch (stage) {
    case "Preflight":
      return "border-[#f97366]/35 bg-[#f97366]/14 text-[#ffd1c8]";
    case "Waiting on stock":
      return "border-[#e3c96e]/35 bg-[#e3c96e]/14 text-[#f6e8bc]";
    case "Ready for print":
      return "border-[#0ea5a0]/35 bg-[#0ea5a0]/18 text-[#b9fff5]";
    case "On press":
      return "border-[#3b82f6]/35 bg-[#3b82f6]/16 text-[#d6e8ff]";
    case "Packing":
      return "border-white/18 bg-white/10 text-white/78";
  }
}
