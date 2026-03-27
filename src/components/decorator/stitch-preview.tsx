"use client";

/**
 * ═══════════════════════════════════════════════════════════
 *  Stitch Preview Renderer
 *  Canvas-based embroidery stitch simulation
 *  Renders artwork as if it were embroidered with stitch textures
 * ═══════════════════════════════════════════════════════════
 */

import { useEffect, useRef, useCallback, useState } from "react";

export type StitchRenderType = "satin" | "tatami" | "fill" | "run" | "cross";

interface StitchPreviewProps {
  imageUrl: string;
  width: number;
  height: number;
  stitchType?: StitchRenderType;
  density?: number;      // 1 (loose) to 10 (dense)
  angle?: number;        // stitch angle in degrees
  threadColour?: string; // optional override colour (hex)
  showTexture?: boolean;
  className?: string;
}

/**
 * Renders an image with embroidery stitch texture overlay
 */
export function StitchPreview({
  imageUrl,
  width,
  height,
  stitchType = "satin",
  density = 5,
  angle = 0,
  threadColour,
  showTexture = true,
  className,
}: StitchPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = width;
      canvas.height = height;

      // Draw the source image
      ctx.drawImage(img, 0, 0, width, height);

      if (!showTexture) {
        setLoaded(true);
        return;
      }

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      // Clear and redraw with stitch texture
      ctx.clearRect(0, 0, width, height);

      // Dark background to simulate fabric
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, width, height);

      // Apply stitch rendering
      switch (stitchType) {
        case "satin":
          renderSatinStitches(ctx, pixels, width, height, density, angle, threadColour);
          break;
        case "tatami":
          renderTatamiStitches(ctx, pixels, width, height, density, angle, threadColour);
          break;
        case "fill":
          renderFillStitches(ctx, pixels, width, height, density, angle, threadColour);
          break;
        case "run":
          renderRunStitches(ctx, pixels, width, height, density, threadColour);
          break;
        case "cross":
          renderCrossStitches(ctx, pixels, width, height, density, threadColour);
          break;
      }

      // Add subtle fabric texture overlay
      addFabricTexture(ctx, width, height);

      setLoaded(true);
    };
    img.onerror = () => setLoaded(true);
    img.src = imageUrl;
  }, [imageUrl, width, height, stitchType, density, angle, threadColour, showTexture]);

  useEffect(() => {
    setLoaded(false);
    render();
  }, [render]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, imageRendering: "auto" }}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
        </div>
      )}
    </div>
  );
}

/* ── Satin Stitch Rendering ── */

function renderSatinStitches(
  ctx: CanvasRenderingContext2D,
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  density: number,
  angle: number,
  overrideColour?: string
) {
  const spacing = Math.max(1, Math.round(12 - density));
  const stitchLength = Math.max(2, Math.round(8 - density * 0.5));
  const rad = (angle * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  ctx.lineCap = "round";

  for (let y = 0; y < h; y += spacing) {
    for (let x = 0; x < w; x += 1) {
      const idx = (y * w + x) * 4;
      const a = pixels[idx + 3];
      if (a < 30) continue; // skip transparent

      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      if (overrideColour) {
        ctx.strokeStyle = overrideColour;
      } else {
        // Add slight variation for thread sheen
        const sheen = Math.random() * 20 - 10;
        ctx.strokeStyle = `rgb(${clampByte(r + sheen)},${clampByte(g + sheen)},${clampByte(b + sheen)})`;
      }

      ctx.lineWidth = Math.max(0.8, spacing * 0.6);
      ctx.globalAlpha = a / 255 * 0.9;

      // Stitch line (perpendicular to angle)
      const dx = cosA * stitchLength;
      const dy = sinA * stitchLength;

      ctx.beginPath();
      ctx.moveTo(x - dx / 2, y - dy / 2);
      ctx.lineTo(x + dx / 2, y + dy / 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/* ── Tatami / Fill Stitch Rendering ── */

function renderTatamiStitches(
  ctx: CanvasRenderingContext2D,
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  density: number,
  angle: number,
  overrideColour?: string
) {
  const spacing = Math.max(1, Math.round(10 - density));
  const stitchLen = Math.max(6, Math.round(20 - density));
  const rad = (angle * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  // Tatami offset: alternate rows offset by half stitch length
  const offset = stitchLen / 2;

  ctx.lineCap = "butt";

  for (let row = 0; row < h; row += spacing) {
    const rowOffset = (Math.floor(row / spacing) % 2 === 0) ? 0 : offset;

    for (let col = 0; col < w; col += stitchLen) {
      const x = col + rowOffset;
      if (x >= w) continue;

      const cx = Math.min(w - 1, Math.round(x + stitchLen / 2));
      const cy = Math.min(h - 1, row);
      const idx = (cy * w + cx) * 4;
      const a = pixels[idx + 3];
      if (a < 30) continue;

      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      if (overrideColour) {
        ctx.strokeStyle = overrideColour;
      } else {
        const sheen = Math.random() * 15 - 7;
        ctx.strokeStyle = `rgb(${clampByte(r + sheen)},${clampByte(g + sheen)},${clampByte(b + sheen)})`;
      }

      ctx.lineWidth = Math.max(0.6, spacing * 0.55);
      ctx.globalAlpha = a / 255 * 0.85;

      const endX = Math.min(w, x + stitchLen);
      const dx1 = cosA * (endX - x);
      const dy1 = sinA * (endX - x);

      ctx.beginPath();
      ctx.moveTo(x, row);
      ctx.lineTo(x + dx1, row + dy1);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/* ── Complex Fill Stitch Rendering ── */

function renderFillStitches(
  ctx: CanvasRenderingContext2D,
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  density: number,
  angle: number,
  overrideColour?: string
) {
  const spacing = Math.max(2, Math.round(12 - density));
  const rad = (angle * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  ctx.lineCap = "round";

  // Draw long stitch lines across the design
  for (let row = -w; row < h + w; row += spacing) {
    let drawing = false;
    let startX = 0;
    let startY = 0;
    let lastR = 0, lastG = 0, lastB = 0;

    for (let t = 0; t < Math.max(w, h) * 1.5; t += 1) {
      const x = Math.round(t * cosA - row * sinA);
      const y = Math.round(t * sinA + row * cosA);

      if (x < 0 || x >= w || y < 0 || y >= h) {
        if (drawing) {
          drawStitchSegment(ctx, startX, startY, x, y, lastR, lastG, lastB, spacing, overrideColour);
          drawing = false;
        }
        continue;
      }

      const idx = (y * w + x) * 4;
      const a = pixels[idx + 3];

      if (a < 30) {
        if (drawing) {
          drawStitchSegment(ctx, startX, startY, x, y, lastR, lastG, lastB, spacing, overrideColour);
          drawing = false;
        }
        continue;
      }

      if (!drawing) {
        startX = x;
        startY = y;
        lastR = pixels[idx];
        lastG = pixels[idx + 1];
        lastB = pixels[idx + 2];
        drawing = true;
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawStitchSegment(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  r: number, g: number, b: number,
  spacing: number,
  overrideColour?: string
) {
  const sheen = Math.random() * 15 - 7;
  ctx.strokeStyle = overrideColour ?? `rgb(${clampByte(r + sheen)},${clampByte(g + sheen)},${clampByte(b + sheen)})`;
  ctx.lineWidth = Math.max(0.7, spacing * 0.5);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/* ── Run / Outline Stitch Rendering ── */

function renderRunStitches(
  ctx: CanvasRenderingContext2D,
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  density: number,
  overrideColour?: string
) {
  // Edge detection for outline stitching
  const edgeSpacing = Math.max(1, Math.round(6 - density * 0.5));
  const stitchLen = Math.max(3, Math.round(8 - density * 0.3));

  ctx.lineCap = "round";
  ctx.lineWidth = 1.2;

  for (let y = 1; y < h - 1; y += edgeSpacing) {
    for (let x = 1; x < w - 1; x += 1) {
      const idx = (y * w + x) * 4;
      const a = pixels[idx + 3];
      if (a < 30) continue;

      // Check if this is an edge pixel
      const isEdge = isEdgePixel(pixels, x, y, w, h);
      if (!isEdge) continue;

      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      ctx.strokeStyle = overrideColour ?? `rgb(${r},${g},${b})`;
      ctx.globalAlpha = 0.9;

      // Draw a small stitch dash
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + stitchLen, y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/* ── Cross Stitch Rendering ── */

function renderCrossStitches(
  ctx: CanvasRenderingContext2D,
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  density: number,
  overrideColour?: string
) {
  const cellSize = Math.max(3, Math.round(14 - density));

  ctx.lineCap = "round";

  for (let y = 0; y < h; y += cellSize) {
    for (let x = 0; x < w; x += cellSize) {
      // Sample centre of cell
      const cx = Math.min(w - 1, x + Math.floor(cellSize / 2));
      const cy = Math.min(h - 1, y + Math.floor(cellSize / 2));
      const idx = (cy * w + cx) * 4;
      const a = pixels[idx + 3];
      if (a < 30) continue;

      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      if (overrideColour) {
        ctx.strokeStyle = overrideColour;
      } else {
        const sheen = Math.random() * 20 - 10;
        ctx.strokeStyle = `rgb(${clampByte(r + sheen)},${clampByte(g + sheen)},${clampByte(b + sheen)})`;
      }

      ctx.lineWidth = Math.max(0.8, cellSize * 0.15);
      ctx.globalAlpha = a / 255 * 0.9;

      const pad = cellSize * 0.1;

      // Draw X
      ctx.beginPath();
      ctx.moveTo(x + pad, y + pad);
      ctx.lineTo(x + cellSize - pad, y + cellSize - pad);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + cellSize - pad, y + pad);
      ctx.lineTo(x + pad, y + cellSize - pad);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/* ── Fabric Texture Overlay ── */

function addFabricTexture(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Subtle noise overlay for fabric grain
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = "#ffffff";
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (Math.random() > 0.5) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/* ── Helpers ── */

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function isEdgePixel(pixels: Uint8ClampedArray, x: number, y: number, w: number, h: number): boolean {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) return true;
    const nIdx = (ny * w + nx) * 4;
    if (pixels[nIdx + 3] < 30) return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════
   Stitch Preview Thumbnail — quick preview at small size
   ═══════════════════════════════════════════════════════════ */

interface StitchThumbnailProps {
  imageUrl: string;
  size?: number;
  stitchType?: StitchRenderType;
  onClick?: () => void;
  className?: string;
}

export function StitchThumbnail({
  imageUrl,
  size = 80,
  stitchType = "satin",
  onClick,
  className,
}: StitchThumbnailProps) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer overflow-hidden rounded-md border border-white/10 transition-all hover:border-blue-400/50 ${className ?? ""}`}
    >
      <StitchPreview
        imageUrl={imageUrl}
        width={size}
        height={size}
        stitchType={stitchType}
        density={4}
        showTexture={true}
      />
    </div>
  );
}
