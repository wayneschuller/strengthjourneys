/**
 * Shared client transport for preview-history imports.
 * Compresses large JSON payloads with gzip when the browser supports it, while
 * falling back to plain JSON for older environments.
 */
import { gaTrackImportProcess } from "@/lib/analytics";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";

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

export async function postImportHistory(
  payload,
  {
    source = "unknown",
    formatId,
    formatName,
    importSummary,
    trackImportRitual = true,
  } = {},
) {
  if (formatId) payload.formatId = formatId;
  if (formatName) payload.formatName = formatName;
  if (importSummary) payload.importSummary = importSummary;
  if (!trackImportRitual) payload.trackImportRitual = false;
  const jsonString = JSON.stringify(payload);
  const payloadBytes = jsonString.length;
  const gzippedBody = await gzipJsonString(jsonString);
  const compressedBytes = gzippedBody?.byteLength ?? null;
  const startedAt = Date.now();

  gaTrackImportProcess({
    phase: "start",
    source,
    formatId,
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
    formatId,
    entryCount: Array.isArray(payload?.entries) ? payload.entries.length : 0,
    payloadBytes,
    compressedBytes,
    durationMs: Date.now() - startedAt,
    result: response.ok ? "ok" : "error",
    errorCode: response.ok ? undefined : String(response.status),
  });

  if (response.ok && typeof window !== "undefined") {
    response
      .clone()
      .json()
      .then((result) => {
        if (!result?.importProfile) return;
        localStorage.setItem(
          LOCAL_STORAGE_KEYS.IMPORT_PROFILE,
          JSON.stringify(result.importProfile),
        );
        window.dispatchEvent(
          new CustomEvent("sj-import-profile-updated", {
            detail: result.importProfile,
          }),
        );
      })
      .catch(() => {
        // Import success must not depend on caching convenience metadata.
      });
  }

  return response;
}
