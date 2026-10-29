// Draws a 1080x1920 story card of the strength hexagon on a 2D canvas: the
// archetype as the title, the hexagon as captured from whichever view is on
// screen, its labels re-set in the page fonts at full resolution, the
// headline, and the site name. Drawing the type ourselves (rather than
// screenshotting the DOM) keeps it crisp and keeps the glow on the text.

import { RECAP_EXPORT_WIDTH } from "@/lib/recap-share-image";

const CARD_WIDTH = RECAP_EXPORT_WIDTH;
const CARD_HEIGHT = 1920;
const VISUAL_TOP = 430;

const SERIF = "'Fraunces Variable', Georgia, serif";
const CONDENSED = "'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif";

async function loadFonts() {
  if (!document.fonts?.load) return;
  await Promise.all([
    document.fonts.load(`600 92px ${SERIF}`),
    document.fonts.load(`400 40px ${CONDENSED}`),
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
  await loadFonts();
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
  context.font = `400 36px ${CONDENSED}`;
  context.fillText("My strength hexagon", CARD_WIDTH / 2, 240);
  context.fillStyle = theme.text;
  context.font = `600 92px ${SERIF}`;
  withGlow(() => context.fillText(title, CARD_WIDTH / 2, 330));

  const scale = CARD_WIDTH / capture.width;
  const visualHeight = capture.height * scale;
  context.drawImage(
    theme.glow
      ? feathered(capture.canvas, CARD_WIDTH, visualHeight)
      : capture.canvas,
    0,
    VISUAL_TOP,
    CARD_WIDTH,
    visualHeight,
  );

  for (const label of capture.labels) {
    const x = label.x * scale;
    const y = VISUAL_TOP + label.y * scale;
    context.globalAlpha = label.opacity ?? 1;
    if (label.kind === "center") {
      context.fillStyle = theme.text;
      context.font = `600 104px ${SERIF}`;
      context.fillText(label.value, x, y - 14);
      context.fillStyle = theme.muted;
      context.font = `400 30px ${CONDENSED}`;
      context.fillText(label.label, x, y + 52);
    } else {
      context.fillStyle = theme.muted;
      context.font = `400 30px ${CONDENSED}`;
      context.fillText(label.label, x, y - 24);
      context.fillStyle = theme.text;
      context.font = `600 46px ${SERIF}`;
      withGlow(() => context.fillText(label.value, x, y + 20), 24);
    }
  }
  context.globalAlpha = 1;

  context.fillStyle = theme.text;
  context.font = `400 50px ${CONDENSED}`;
  const lines = wrapLines(context, headline, 980);
  lines.forEach((line, index) => {
    context.fillText(line, CARD_WIDTH / 2, 1640 + index * 66);
  });

  context.fillStyle = theme.muted;
  context.font = `400 34px ${CONDENSED}`;
  context.fillText("strengthjourneys.xyz", CARD_WIDTH / 2, 1830);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Card export failed")),
      "image/png",
    );
  });
}
