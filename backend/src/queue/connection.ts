import type { ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";
import { logger } from "../lib/logger";

function buildBullConnectionOptions(redisUrl: string): ConnectionOptions {
  const parsed = new URL(redisUrl);
  const isTls = parsed.protocol === "rediss:";

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : isTls ? 6380 : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: isTls ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export const bullConnection = buildBullConnectionOptions(env.REDIS_URL);

export const redisHealthClient = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redisHealthClient.on("error", (error) => {
  logger.error({ err: error }, "Redis connection error");
});
