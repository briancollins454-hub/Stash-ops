import { createHmac, timingSafeEqual } from "node:crypto";

function toBuffer(value: string) {
  return Buffer.from(value, "utf8");
}

export function verifyShopifyWebhookHmac(rawBody: string, hmacHeader: string | null) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();

  if (!secret) {
    return {
      valid: true,
      bypassed: true,
      reason: "SHOPIFY_WEBHOOK_SECRET is not set; verification bypassed.",
    };
  }

  if (!hmacHeader) {
    return {
      valid: false,
      bypassed: false,
      reason: "Missing x-shopify-hmac-sha256 header.",
    };
  }

  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const expected = toBuffer(digest);
  const provided = toBuffer(hmacHeader);

  if (expected.length !== provided.length) {
    return {
      valid: false,
      bypassed: false,
      reason: "HMAC length mismatch.",
    };
  }

  const valid = timingSafeEqual(expected, provided);
  return {
    valid,
    bypassed: false,
    reason: valid ? undefined : "HMAC mismatch.",
  };
}
