/**
 * Shared client transport for preview-history imports.
 * Compresses large JSON payloads with gzip when the browser supports it, while
 * falling back to plain JSON for older environments.
 */

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

export async function postImportHistory(payload) {
  const jsonString = JSON.stringify(payload);
  const gzippedBody = await gzipJsonString(jsonString);

  if (gzippedBody) {
    // Large history imports repeat the same keys thousands of times, so gzip
    // dramatically reduces the request body before it hits Vercel/Next limits.
    return fetch("/api/sheet/import-history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
      },
      body: gzippedBody,
    });
  }

  return fetch("/api/sheet/import-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonString,
  });
}
