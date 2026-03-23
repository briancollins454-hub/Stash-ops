import type { FastifyInstance } from "fastify";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../lib/logger";

const execFileAsync = promisify(execFile);

const ALLOWED_EXTENSIONS = new Set(["eps", "ai", "pdf"]);
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB

export async function registerConversionRoutes(app: FastifyInstance): Promise<void> {
  app.post("/convert", async (request, reply) => {
    const { data, filename } = request.body as { data?: string; filename?: string };

    if (!data || !filename) {
      return reply.status(400).send({ ok: false, error: "Missing data or filename" });
    }

    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return reply.status(400).send({ ok: false, error: `Unsupported file type: ${ext}` });
    }

    const id = randomUUID();
    const inputPath = join(tmpdir(), `${id}.${ext}`);
    const outputPath = join(tmpdir(), `${id}.png`);

    try {
      // Strip data-URL prefix if present, then decode base64
      const base64Data = data.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length > MAX_INPUT_BYTES) {
        return reply.status(400).send({ ok: false, error: "File too large" });
      }

      await writeFile(inputPath, buffer);

      // Convert using Ghostscript (runs in SAFER sandbox mode)
      await execFileAsync("gs", [
        "-dNOPAUSE", "-dBATCH", "-dSAFER",
        "-sDEVICE=png16m",
        "-r300",
        "-dEPSCrop",
        `-sOutputFile=${outputPath}`,
        inputPath,
      ], { timeout: 30_000 });

      const pngBuffer = await readFile(outputPath);
      const pngBase64 = pngBuffer.toString("base64");

      logger.info({ filename, inputBytes: buffer.length, outputBytes: pngBuffer.length }, "File converted successfully");

      return reply.send({
        ok: true,
        previewUrl: `data:image/png;base64,${pngBase64}`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, filename }, "File conversion failed");
      return reply.status(500).send({
        ok: false,
        error: "Conversion failed",
        detail: msg,
      });
    } finally {
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
    }
  });
}
