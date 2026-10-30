// Draws a 1080x1920 story card of the strength shape on a 2D canvas, in the
// active theme's colours and typeface: the archetype as the title, the shape
// as captured from whichever view is on screen, its labels re-set at full
// resolution, the headline, and the site name. Drawing the type ourselves (rather than
// screenshotting the DOM) keeps it crisp and keeps the glow on the text.

import { RECAP_EXPORT_WIDTH } from "@/lib/recap-share-image";

const CARD_WIDTH = RECAP_EXPORT_WIDTH;
const CARD_HEIGHT = 1920;
const VISUAL_TOP = 470;
const VISUAL_INSET = 70;

// Set in the theme's own typeface, read from the page at export time.
function themeFont() {
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

async function loadFonts(font) {
  if (!document.fonts?.load) return;
  await Promise.all([
    document.fonts.load(`700 92px ${font}`),
    document.fonts.load(`400 40px ${font}`),
  ]).catch(() => {});
}

// Fade the captured canvas into the card background at its edges, the way the
// on-screen mask does, so the square never shows a seam.
function feathered(source, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(source, 0, 0, width, height);
  context.globalCompositeOperation = "destination-in";
  const radius = Math.min(width, height) / 2;
  const mask = context.createRadialGradient(
    width / 2,
    height / 2,
    radius * 0.72,
    width / 2,
    height / 2,
    radius,
  );
  mask.addColorStop(0, "rgba(0,0,0,1)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = mask;
  context.fillRect(0, 0, width, height);
  return canvas;
}

function wrapLines(context, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * @param {Object} options
 * @param {{ canvas: HTMLCanvasElement, width: number, height: number, labels: Array }} options.capture
 * @param {{ bg: string, text: string, muted: string, glow: string|null }} options.theme
 * @param {string} options.title - The archetype, e.g. "The All-Rounder".
 * @param {string} options.headline - e.g. "Stronger than 79% of athletes aged 40 to 49".
 * @returns {Promise<Blob>}
 */
export async function renderStoryCardBlob({ capture, theme, title, headline }) {
  const font = themeFont();
  await loadFonts(font);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext("2d");
  context.textAlign = "center";
  context.textBaseline = "middle";

  context.fillStyle = theme.bg;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  if (theme.glow) {
    const halo = context.createRadialGradient(540, 980, 0, 540, 980, 900);
    halo.addColorStop(0, `${theme.glow}2e`);
    halo.addColorStop(1, `${theme.glow}00`);
    context.fillStyle = halo;
    context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  const withGlow = (draw, blur = 36) => {
    if (theme.glow) {
      context.shadowColor = theme.glow;
      context.shadowBlur = blur;
    }
    draw();
    context.shadowBlur = 0;
    context.shadowColor = "transparent";
  };

  context.fillStyle = theme.muted;
  context.font = `400 36px ${font}`;
  context.fillText("My strength profile", CARD_WIDTH / 2, 240);
  context.fillStyle = theme.text;
  context.font = `700 92px ${font}`;
  withGlow(() => context.fillText(title, CARD_WIDTH / 2, 330));

  // Inset from the card edges so the outermost labels keep some air.
  const visualWidth = CARD_WIDTH - VISUAL_INSET * 2;
  const scale = visualWidth / capture.width;
  const visualHeight = capture.height * scale;
  context.drawImage(
    theme.glow
      ? feathered(capture.canvas, visualWidth, visualHeight)
      : capture.canvas,
    VISUAL_INSET,
    VISUAL_TOP,
    visualWidth,
    visualHeight,
  );

  for (const label of capture.labels) {
    const x = VISUAL_INSET + label.x * scale;
    const y = VISUAL_TOP + label.y * scale;
    context.globalAlpha = label.opacity ?? 1;
    if (label.kind === "center") {
      context.fillStyle = theme.text;
      context.font = `700 104px ${font}`;
      context.fillText(label.value, x, y - 14);
      context.fillStyle = theme.muted;
      context.font = `400 30px ${font}`;
      context.fillText(label.label, x, y + 52);
    } else {
      context.fillStyle = theme.muted;
      context.font = `400 30px ${font}`;
      context.fillText(label.label, x, y - 24);
      context.fillStyle = theme.text;
      context.font = `700 46px ${font}`;
      withGlow(() => context.fillText(label.value, x, y + 20), 24);
    }
  }
  context.globalAlpha = 1;

  context.fillStyle = theme.text;
  context.font = `400 50px ${font}`;
  const lines = wrapLines(context, headline, 980);
  lines.forEach((line, index) => {
    context.fillText(line, CARD_WIDTH / 2, 1640 + index * 66);
  });

  context.fillStyle = theme.muted;
  context.font = `400 34px ${font}`;
  context.fillText("strengthjourneys.xyz", CARD_WIDTH / 2, 1830);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Card export failed")),
      "image/png",
    );
  });
}
