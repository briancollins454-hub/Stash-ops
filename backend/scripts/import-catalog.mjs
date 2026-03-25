#!/usr/bin/env node
/**
 * Import Ralawise CSV catalog into the Stash Ops backend.
 * Reads the CSV locally, chunks it, and sends each chunk via POST /v1/catalog/import.
 *
 * Usage: node scripts/import-catalog.mjs /path/to/CustomerDataFull.csv
 */

import { readFileSync } from "fs";
import { basename } from "path";

const API_BASE = "https://stash-api-production-7f18.up.railway.app/api";
const CHUNK_ROWS = 5000; // rows per chunk

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: node scripts/import-catalog.mjs <path-to-csv>");
  process.exit(1);
}

console.log(`Reading ${basename(csvPath)}...`);
const raw = readFileSync(csvPath, "utf-8");
const lines = raw.split("\n");
const header = lines[0];
const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);
console.log(`Total data rows: ${dataLines.length}`);

const totalChunks = Math.ceil(dataLines.length / CHUNK_ROWS);
console.log(`Sending in ${totalChunks} chunks of ${CHUNK_ROWS} rows each...\n`);

let totalProducts = 0;
let totalColours = 0;

for (let i = 0; i < totalChunks; i++) {
  const start = i * CHUNK_ROWS;
  const end = Math.min(start + CHUNK_ROWS, dataLines.length);
  const chunkLines = dataLines.slice(start, end);
  const csvChunk = header + "\n" + chunkLines.join("\n");

  const label = `Chunk ${i + 1}/${totalChunks} (rows ${start + 1}-${end})`;
  process.stdout.write(`${label} ... `);

  try {
    const res = await fetch(`${API_BASE}/v1/catalog/import`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: csvChunk,
    });

    if (!res.ok) {
      const text = await res.text();
      console.log(`FAILED (${res.status}): ${text.slice(0, 200)}`);
      continue;
    }

    const json = await res.json();
    if (json.ok) {
      totalProducts += json.productsUpserted || 0;
      totalColours += json.coloursUpserted || 0;
      console.log(`OK — ${json.productsUpserted} products, ${json.coloursUpserted} colours`);
    } else {
      console.log(`ERROR: ${JSON.stringify(json).slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`NETWORK ERROR: ${err.message}`);
  }
}

console.log(`\nDone! Total: ${totalProducts} products, ${totalColours} colours upserted.`);

// Verify
try {
  const stats = await fetch(`${API_BASE}/v1/catalog/stats`);
  const s = await stats.json();
  console.log(`Catalog stats: ${s.products} products, ${s.colours} colours`);
} catch (e) {
  console.log("Could not fetch stats:", e.message);
}
