/**
 * Shared client transport for preview-history imports.
 * Compresses large JSON payloads with gzip when the browser supports it, while
 * falling back to plain JSON for older environments.
 */
import { gaTrackImportProcess } from "@/lib/analytics";

async function gzipJsonString(jsonString) {
  if (
    typeof window === "undefined" ||
    typeof window.CompressionStream !== "function"
  ) {
    return null;
  }

  const compressedStream = new Blob([jsonString])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return await new Response(compressedStream).arrayBuffer();
}

export async function postImportHistory(payload, { source = "unknown" } = {}) {
  const jsonString = JSON.stringify(payload);
  const payloadBytes = jsonString.length;
  const gzippedBody = await gzipJsonString(jsonString);
  const compressedBytes = gzippedBody?.byteLength ?? null;
  const startedAt = Date.now();

  gaTrackImportProcess({
    phase: "start",
    source,
    entryCount: Array.isArray(payload?.entries) ? payload.entries.length : 0,
    payloadBytes,
    compressedBytes,
  });

  const response = gzippedBody
    ? // Large history imports repeat the same keys thousands of times, so gzip
      // dramatically reduces the request body before it hits Vercel/Next limits.
      await fetch("/api/sheet/import-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Encoding": "gzip",
        },
        body: gzippedBody,
      })
    : await fetch("/api/sheet/import-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonString,
    });

  gaTrackImportProcess({
    phase: response.ok ? "success" : "failed",
    source,
    entryCount: Array.isArray(payload?.entries) ? payload.entries.length : 0,
    payloadBytes,
    compressedBytes,
    durationMs: Date.now() - startedAt,
    result: response.ok ? "ok" : "error",
    errorCode: response.ok ? undefined : String(response.status),
  });

  return response;
}
