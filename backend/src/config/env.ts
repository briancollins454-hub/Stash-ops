import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  FRONTEND_ORIGIN: z.string().url().optional(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  SHOPIFY_DOMAIN: z.string().optional(),
  SHOPIFY_ACCESS_TOKEN: z.string().optional(),
  SHOPIFY_API_VERSION: z.string().default("2025-01"),
  SHOPIFY_WEBHOOK_SECRET: z.string().optional(),
  SHOPIFY_SYNC_MAX_PAGES: z.coerce.number().int().positive().default(40),
  SHOPIFY_SYNC_PAGE_SIZE: z.coerce.number().int().min(1).max(250).default(100),
});

export const env = envSchema.parse(process.env);

export function isShopifyConfigured(): boolean {
  return Boolean(env.SHOPIFY_DOMAIN && env.SHOPIFY_ACCESS_TOKEN);
}

