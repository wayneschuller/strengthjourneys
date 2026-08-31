// Turns a rendered recap slide into a shareable PNG.
//
// The card on screen is only ~360px wide because that is the width the 9:16
// story layout reads well at. Capturing it at a fixed scale of 2 produced a
// 720px-wide image, which Instagram and X then upscale into mush. Instead we
// derive the scale from the node's actual width so the export always lands on
// RECAP_EXPORT_WIDTH (1080px, the native width of a phone story) regardless of
// the viewport the user happens to be on.
//
// The watermark is appended to the live node for the duration of the capture
// rather than living in the card markup, so it appears in shared images without
// cluttering the on-screen recap. It is styled in source pixels and therefore
// scales with the export like everything else on the card.

// Native story width. 1080x1920 is what Instagram, TikTok, and Snapchat expect.
export const RECAP_EXPORT_WIDTH = 1080;

// html2canvas allocates a canvas of scale^2 * source pixels; past 4x that is a
// lot of memory on a phone for no visible gain.
const MAX_CAPTURE_SCALE = 4;

/**
 * Capture one recap slide element as a PNG blob at story resolution.
 *
 * @param {HTMLElement} slideEl - The `[data-recap-slide]` element to capture.
 * @param {Object} [options]
 * @param {number} [options.targetWidth=RECAP_EXPORT_WIDTH] - Desired output width in pixels.
 * @returns {Promise<Blob>} PNG blob.
 * @throws {Error} If the element cannot be rendered to a blob.
 */
export async function captureRecapSlideBlob(slideEl, options = {}) {
  const { targetWidth = RECAP_EXPORT_WIDTH } = options;
  if (!slideEl) throw new Error("No slide element to capture");

  const html2canvas = (await import("html2canvas-pro")).default;

  const sourceWidth = slideEl.offsetWidth || targetWidth;
  const scale = Math.min(
    MAX_CAPTURE_SCALE,
    Math.max(1, targetWidth / sourceWidth),
  );

  const watermarkEl = appendWatermark(slideEl);
  try {
    const canvas = await html2canvas(slideEl, {
      backgroundColor: null,
      scale,
    });
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!blob) throw new Error("Could not generate image blob");
    return blob;
  } finally {
    if (watermarkEl?.parentNode) {
      watermarkEl.parentNode.removeChild(watermarkEl);
    }
  }
}

/**
 * Filename for a downloaded or natively shared recap card.
 * @param {number|string} year
 * @param {string} slideId - Card id, e.g. "tonnage".
 * @returns {string}
 */
export function recapImageFileName(year, slideId) {
  const safeSlide = String(slideId || "card").replace(/[^a-z0-9-]/gi, "-");
  return `strength-unwrapped-${year}-${safeSlide}.png`;
}

/**
 * Trigger a browser download for a blob. Revokes the object URL afterwards so a
 * user who saves every card in the deck does not leak eight blobs.
 * @param {Blob} blob
 * @param {string} fileName
 */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the browser a tick to start the download before the URL disappears.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Whether this browser can share image files through the native share sheet.
 * Must be called on the client (after mount) — calling it during render would
 * desync server and client markup.
 * @returns {boolean}
 */
export function canNativeShareFiles() {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    const probe = new File([new Blob([""], { type: "image/png" })], "probe.png", {
      type: "image/png",
    });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

// --- Supporting functions ---

function appendWatermark(slideEl) {
  const watermarkEl = document.createElement("div");
  watermarkEl.textContent = "strengthjourneys.xyz";
  Object.assign(watermarkEl.style, {
    position: "absolute",
    right: "10px",
    bottom: "10px",
    padding: "4px 12px",
    borderRadius: "9999px",
    background: "rgba(15, 23, 42, 0.86)",
    color: "rgba(248, 250, 252, 0.98)",
    fontSize: "11px",
    fontWeight: "500",
    letterSpacing: "0.03em",
    textTransform: "none",
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    boxShadow: "0 6px 16px rgba(15, 23, 42, 0.55)",
    pointerEvents: "none",
    zIndex: "10",
  });
  slideEl.appendChild(watermarkEl);
  return watermarkEl;
}
