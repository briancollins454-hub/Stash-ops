/**
 * ═══════════════════════════════════════════════════════════
 *  Embroidery Engine API Routes
 *  /v1/embroidery/*
 * ═══════════════════════════════════════════════════════════
 */

import type { FastifyInstance } from "fastify";
import {
  estimateStitchCount,
  estimateProductionTime,
  calculateThreadUsage,
  estimateCost,
  estimateNameDrops,
  generateFullEstimate,
  STITCH_PROFILES,
  UNDERLAY_PROFILES,
  FABRIC_PROFILES,
  MACHINE_PROFILES,
  type StitchType,
  type UnderlayType,
  type StitchEstimateInput,
  type ProductionTimeInput,
  type ThreadUsageInput,
  type CostEstimateInput,
  type NameDropInput,
  type FullEstimateInput,
} from "../services/embroidery-engine";
import {
  THREAD_BRANDS,
  findClosestThread,
  searchThreads,
} from "../services/thread-library";

export async function registerEmbroideryRoutes(app: FastifyInstance): Promise<void> {
  const PREFIX = "/v1/embroidery";

  /* ── Reference Data ── */

  app.get(`${PREFIX}/profiles`, async () => {
    return {
      stitchTypes: STITCH_PROFILES,
      underlayTypes: UNDERLAY_PROFILES,
      fabricTypes: FABRIC_PROFILES,
      machines: MACHINE_PROFILES,
    };
  });

  /* ── Stitch Count Estimation ── */

  app.post(`${PREFIX}/estimate-stitches`, async (req) => {
    const body = req.body as StitchEstimateInput;
    return estimateStitchCount(body);
  });

  /* ── Production Time ── */

  app.post(`${PREFIX}/estimate-time`, async (req) => {
    const body = req.body as ProductionTimeInput;
    return estimateProductionTime(body);
  });

  /* ── Thread Usage ── */

  app.post(`${PREFIX}/thread-usage`, async (req) => {
    const body = req.body as ThreadUsageInput;
    return calculateThreadUsage(body);
  });

  /* ── Cost Estimation ── */

  app.post(`${PREFIX}/estimate-cost`, async (req) => {
    const body = req.body as CostEstimateInput;
    return estimateCost(body);
  });

  /* ── Name Drop Estimation ── */

  app.post(`${PREFIX}/name-drops`, async (req) => {
    const body = req.body as NameDropInput;
    return estimateNameDrops(body);
  });

  /* ── Full Estimate Pipeline ── */

  app.post(`${PREFIX}/full-estimate`, async (req) => {
    const body = req.body as FullEstimateInput;
    return generateFullEstimate(body);
  });

  /* ── Thread Library ── */

  app.get(`${PREFIX}/threads`, async (req) => {
    const query = req.query as { brand?: string; search?: string };
    if (query.search) {
      return searchThreads(query.search, query.brand);
    }
    if (query.brand && THREAD_BRANDS[query.brand]) {
      return THREAD_BRANDS[query.brand];
    }
    return Object.keys(THREAD_BRANDS).map((k) => ({
      key: THREAD_BRANDS[k].key,
      label: THREAD_BRANDS[k].label,
      ranges: THREAD_BRANDS[k].ranges,
      colourCount: THREAD_BRANDS[k].colours.length,
    }));
  });

  app.get(`${PREFIX}/threads/match`, async (req) => {
    const query = req.query as { hex: string; brand?: string };
    if (!query.hex) {
      return { error: "hex parameter required" };
    }
    return findClosestThread(query.hex, query.brand);
  });
}
