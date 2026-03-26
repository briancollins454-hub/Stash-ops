import { NextResponse } from "next/server";

/**
 * Image proxy — serves external images through our domain to avoid CORS issues
 * with Fabric.js canvas rendering (CDNs like pimber.ly don't send CORS headers).
 *
 * Usage: /api/image-proxy?url=https://cdn.example.com/image.jpg
 */

const ALLOWED_HOSTS = new Set([
  "cdn.pimber.ly",
  "www.fullcollection.com",
  "media.rfrk.com",
  "images.rfrk.com",
  "rfrk.com",
  "www.rfrk.com",
  "www.pencarrie.com",
  "cdn.pencarrie.com",
  "images.unsplash.com",
  "api.uneekclothing.com",
  "www.uneekclothing.com",
  "canterbury.com",
  "www.canterbury.com",
  "cdn.shopify.com",
  "cottonridge.co.uk",
  "www.cottonridge.co.uk",
  "marxcorporate.secure-decoration.com",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const response = await fetch(imageUrl, {
      headers: { "User-Agent": "StashOps/1.0" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: response.status });
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  }
}
