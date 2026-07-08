/**
 * Long Game share helpers copy rendered heatmap views to the clipboard as PNGs.
 * They stay as plain async helpers so the card component continues to own UI state.
 */

import { devLog } from "@/lib/processing-utils";

async function writePngToClipboard(blobPromise) {
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blobPromise }),
  ]);
}

export async function copyElementImageToClipboard(
  node,
  ignoreElements,
  captureOptions = {},
) {
  if (!node) return;
  const html2canvas = (await import("html2canvas-pro")).default;
  const blobPromise = html2canvas(node, {
    ignoreElements,
    backgroundColor: "#ffffff",
    scale: 1,
    ...captureOptions,
  }).then(
    (canvas) => new Promise((resolve) => canvas.toBlob(resolve, "image/png")),
  );
  await writePngToClipboard(blobPromise);
}

async function renderStyledSvgToImage(svgElement) {
  const svgRect = svgElement.getBoundingClientRect();
  const cloneWithInlineSvgStyles = (sourceNode, targetNode) => {
    if (!(sourceNode instanceof Element) || !(targetNode instanceof Element))
      return;
    const sourceTag = sourceNode.tagName.toLowerCase();
    const computedStyle = window.getComputedStyle(sourceNode);

    if (sourceTag === "svg") {
      targetNode.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      if (!targetNode.getAttribute("width")) {
        targetNode.setAttribute("width", `${Math.ceil(svgRect.width)}`);
      }
      if (!targetNode.getAttribute("height")) {
        targetNode.setAttribute("height", `${Math.ceil(svgRect.height)}`);
      }
    }

    if (
      sourceTag === "rect" ||
      sourceTag === "path" ||
      sourceTag === "polygon" ||
      sourceTag === "circle" ||
      sourceTag === "ellipse" ||
      sourceTag === "line"
    ) {
      const fill = computedStyle.fill;
      if (fill && fill !== "none") targetNode.setAttribute("fill", fill);
      const stroke = computedStyle.stroke;
      if (stroke && stroke !== "none") {
        targetNode.setAttribute("stroke", stroke);
        targetNode.setAttribute("stroke-width", computedStyle.strokeWidth);
      }
      if (computedStyle.opacity && computedStyle.opacity !== "1") {
        targetNode.setAttribute("opacity", computedStyle.opacity);
      }
    }

    if (sourceTag === "text") {
      targetNode.setAttribute("fill", computedStyle.fill);
      targetNode.setAttribute("font-size", computedStyle.fontSize);
      targetNode.setAttribute("font-family", computedStyle.fontFamily);
      targetNode.setAttribute("letter-spacing", computedStyle.letterSpacing);
    }

    for (let i = 0; i < sourceNode.children.length; i += 1) {
      cloneWithInlineSvgStyles(sourceNode.children[i], targetNode.children[i]);
    }
  };

  const clonedSvg = svgElement.cloneNode(true);
  cloneWithInlineSvgStyles(svgElement, clonedSvg);

  const svgBlob = new Blob([new XMLSerializer().serializeToString(clonedSvg)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = svgUrl;
  }).finally(() => {
    URL.revokeObjectURL(svgUrl);
  });

  return { image, rect: svgRect };
}

async function drawYearRowToContext(ctx, yearNode, year, cardRect) {
  const heatmapRoot = yearNode.querySelector(".react-calendar-heatmap");
  const heatmapSvg =
    heatmapRoot?.tagName?.toLowerCase() === "svg"
      ? heatmapRoot
      : heatmapRoot?.querySelector("svg");
  if (!heatmapSvg) return false;

  const rowRect = yearNode.getBoundingClientRect();
  const { image: svgImage, rect: svgRect } =
    await renderStyledSvgToImage(heatmapSvg);

  const rowOffsetX = Math.max(0, rowRect.left - cardRect.left);
  const rowOffsetY = Math.max(0, rowRect.top - cardRect.top);

  const labelNode = yearNode.querySelector('[data-year-label="true"]');
  if (labelNode) {
    const labelRect = labelNode.getBoundingClientRect();
    const labelStyle = window.getComputedStyle(labelNode);
    ctx.fillStyle = labelStyle.color;
    ctx.font = `${labelStyle.fontWeight} ${labelStyle.fontSize} ${labelStyle.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillText(
      String(year),
      Math.max(0, labelRect.left - cardRect.left),
      Math.max(0, labelRect.top - cardRect.top),
    );
  }

  ctx.drawImage(
    svgImage,
    rowOffsetX + Math.max(0, svgRect.left - rowRect.left),
    rowOffsetY + Math.max(0, svgRect.top - rowRect.top),
    svgRect.width,
    svgRect.height,
  );

  return true;
}

function drawTextNodeToContext(ctx, node, cardRect, fallback = {}) {
  if (!node) return;
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  const text = (node.textContent || "").replace(/\s+/g, " ").trim();
  if (!text) return;

  ctx.fillStyle = fallback.color || style.color || "#111827";
  ctx.font = `${style.fontWeight || fallback.fontWeight || 400} ${style.fontSize || fallback.fontSize || "12px"} ${style.fontFamily || fallback.fontFamily || "sans-serif"}`;
  ctx.textBaseline = "top";
  ctx.fillText(
    text,
    Math.max(0, rect.left - cardRect.left),
    Math.max(0, rect.top - cardRect.top),
  );
}

export async function copyYearHeatmapImageFast(yearNode, year) {
  const fastPathStart = performance.now();
  const heatmapRoot = yearNode.querySelector(".react-calendar-heatmap");
  const heatmapSvg =
    heatmapRoot?.tagName?.toLowerCase() === "svg"
      ? heatmapRoot
      : heatmapRoot?.querySelector("svg");
  if (!heatmapSvg) {
    devLog(
      `[heatmap-copy][${year}] fast-path skipped: svg not found (root=${Boolean(heatmapRoot)})`,
    );
    return false;
  }

  const rowRect = yearNode.getBoundingClientRect();
  const svgRect = heatmapSvg.getBoundingClientRect();
  if (svgRect.width <= 0 || svgRect.height <= 0) {
    devLog(`[heatmap-copy][${year}] fast-path skipped: invalid svg bounds`);
    return false;
  }

  const { image: svgImage } = await renderStyledSvgToImage(heatmapSvg);
  devLog(
    `[heatmap-copy][${year}] fast-path inline styles: ${Math.round(performance.now() - fastPathStart)}ms`,
  );
  devLog(
    `[heatmap-copy][${year}] fast-path svg decode: ${Math.round(performance.now() - fastPathStart)}ms`,
  );

  const canvasWidth = Math.max(1, Math.ceil(rowRect.width));
  const canvasHeight = Math.max(1, Math.ceil(rowRect.height));
  const exportScale = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(canvasWidth * exportScale);
  canvas.height = Math.round(canvasHeight * exportScale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.scale(exportScale, exportScale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const labelNode = yearNode.querySelector('[data-year-label="true"]');
  if (labelNode) {
    const labelRect = labelNode.getBoundingClientRect();
    const labelStyle = window.getComputedStyle(labelNode);
    ctx.fillStyle = labelStyle.color;
    ctx.font = `${labelStyle.fontWeight} ${labelStyle.fontSize} ${labelStyle.fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillText(
      String(year),
      Math.max(0, Math.round(labelRect.left - rowRect.left)),
      Math.max(0, Math.round(labelRect.top - rowRect.top)),
    );
  }

  const svgX = Math.max(0, svgRect.left - rowRect.left);
  const svgY = Math.max(0, svgRect.top - rowRect.top);
  ctx.drawImage(svgImage, svgX, svgY, svgRect.width, svgRect.height);

  const blobPromise = new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  await writePngToClipboard(blobPromise);
  devLog(
    `[heatmap-copy][${year}] fast-path total: ${Math.round(performance.now() - fastPathStart)}ms`,
  );
  return true;
}

export async function copyFullLongGameCardImageFast({
  shareRef,
  viewMode,
  dateRanges,
  yearRowRefs,
}) {
  if (!shareRef.current) {
    devLog("[heatmap-copy][full] fast-path skipped: missing shareRef");
    return false;
  }
  if (viewMode !== "daily") {
    devLog(`[heatmap-copy][full] fast-path skipped: viewMode=${viewMode}`);
    return false;
  }
  if (!dateRanges?.length) {
    devLog("[heatmap-copy][full] fast-path skipped: no dateRanges");
    return false;
  }
  const fastStart = performance.now();
  devLog("[heatmap-copy][full] fast-path start");
  const cardNode = shareRef.current;
  const cardRect = cardNode.getBoundingClientRect();
  if (cardRect.width <= 0 || cardRect.height <= 0) {
    devLog("[heatmap-copy][full] fast-path skipped: invalid card bounds");
    return false;
  }

  // Keep full-card base at 1:1 to avoid subtle text/ring distortion from raster resampling.
  const captureScale = 1;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.round(cardRect.width * captureScale);
  exportCanvas.height = Math.round(cardRect.height * captureScale);
  const ctx = exportCanvas.getContext("2d");
  if (!ctx) {
    devLog("[heatmap-copy][full] fast-path skipped: no canvas context");
    return false;
  }
  ctx.scale(captureScale, captureScale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cardRect.width, cardRect.height);

  const headerStart = performance.now();
  const headerNode = cardNode.querySelector('[data-share-section="header"]');
  if (headerNode) {
    const titleNode = headerNode.querySelector('[data-share-title="true"]');
    const descriptionNode = headerNode.querySelector(
      '[data-share-description="true"]',
    );
    if (!titleNode) devLog("[heatmap-copy][full] header title node missing");
    if (!descriptionNode)
      devLog("[heatmap-copy][full] header description node missing");
    drawTextNodeToContext(ctx, titleNode, cardRect, {
      fontWeight: 700,
      fontSize: "28px",
      color: "#111827",
    });
    drawTextNodeToContext(ctx, descriptionNode, cardRect, {
      fontWeight: 400,
      fontSize: "12px",
      color: "#6b7280",
    });
  }
  devLog(
    `[heatmap-copy][full] header text draw: ${Math.round(performance.now() - headerStart)}ms`,
  );

  const circlesStart = performance.now();
  const consistencyNode = cardNode.querySelector(
    '[data-share-section="consistency"]',
  );
  if (consistencyNode) {
    const circleWraps = consistencyNode.querySelectorAll("svg");
    for (const svgNode of circleWraps) {
      const { image: svgImage, rect } = await renderStyledSvgToImage(svgNode);
      ctx.drawImage(
        svgImage,
        Math.max(0, rect.left - cardRect.left),
        Math.max(0, rect.top - cardRect.top),
        rect.width,
        rect.height,
      );
    }

    const labelNodes = consistencyNode.querySelectorAll("svg + span");
    for (const labelNode of labelNodes) {
      drawTextNodeToContext(ctx, labelNode, cardRect, {
        fontWeight: 400,
        fontSize: "9px",
        color: "#6b7280",
      });
    }
  }
  devLog(
    `[heatmap-copy][full] consistency draw: ${Math.round(performance.now() - circlesStart)}ms`,
  );

  for (const interval of dateRanges) {
    const year = new Date(interval.startDate).getFullYear();
    const yearNode = yearRowRefs.current[year];
    if (!yearNode) continue;
    const yearStart = performance.now();
    const rendered = await drawYearRowToContext(ctx, yearNode, year, cardRect);
    if (!rendered) {
      devLog(
        `[heatmap-copy][full] fast-path failed: year ${year} render failed`,
      );
      return false;
    }
    devLog(
      `[heatmap-copy][full] year ${year} draw: ${Math.round(performance.now() - yearStart)}ms`,
    );
  }

  const brandingStart = performance.now();
  const brandingNode = cardNode.querySelector(
    '[data-share-section="branding"]',
  );
  if (brandingNode) {
    const brandRect = brandingNode.getBoundingClientRect();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.max(0, brandRect.top - cardRect.top));
    ctx.lineTo(cardRect.width, Math.max(0, brandRect.top - cardRect.top));
    ctx.stroke();

    const brandingTextNode = brandingNode.querySelector("p");
    drawTextNodeToContext(ctx, brandingTextNode, cardRect, {
      fontWeight: 400,
      fontSize: "12px",
      color: "#6b7280",
    });
  }
  devLog(
    `[heatmap-copy][full] branding draw: ${Math.round(performance.now() - brandingStart)}ms`,
  );

  const blobPromise = new Promise((resolve) =>
    exportCanvas.toBlob(resolve, "image/png"),
  );
  await writePngToClipboard(blobPromise);
  devLog(
    `[heatmap-copy][full] fast-path total: ${Math.round(performance.now() - fastStart)}ms`,
  );
  return true;
}
