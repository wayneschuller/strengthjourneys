// The strength hexagon takes its colours from the active theme, so it sits in
// every theme the way the rest of the app does. The shader needs plain RGB
// numbers, but themes write their tokens in hsl() or oklch(); painting each
// token into a 1x1 canvas and reading the pixel back converts any of them.
// Colours are read again whenever next-themes switches theme.

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const TOKENS = [
  "background",
  "foreground",
  "muted-foreground",
  "chart-1",
  "chart-2",
];

// Used for the first server render and for the moment before the theme is
// read: the default light theme's values.
const FALLBACK = buildColors({
  background: [1, 1, 1],
  foreground: [0.04, 0.04, 0.03],
  "muted-foreground": [0.47, 0.44, 0.42],
  "chart-1": [0.9, 0.46, 0.34],
  "chart-2": [0.16, 0.62, 0.55],
});

function readTokens() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const styles = getComputedStyle(document.documentElement);
  const rgb = {};
  for (const token of TOKENS) {
    const value = styles.getPropertyValue(`--${token}`).trim();
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "#808080";
    if (value) context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    rgb[token] = [r / 255, g / 255, b / 255];
  }
  return rgb;
}

function mix(a, b, t) {
  return a.map((value, index) => value + (b[index] - value) * t);
}

function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toCss(rgb) {
  return `rgb(${rgb.map((value) => Math.round(value * 255)).join(" ")})`;
}

function buildColors(rgb) {
  const isDark = luminance(rgb.background) < 0.4;
  const core = rgb["chart-1"];
  const accent = rgb["chart-2"];
  // On a dark page the lines and sparks are pale, glowing versions of the
  // chart colour. On a light page the lines are ink, close to the theme's
  // foreground, and the sparks and glows keep the chart colour itself.
  const pale = mix(core, [1, 1, 1], 0.55);
  const edge = isDark ? pale : core;
  const line = isDark ? pale : mix(rgb.foreground, core, 0.2);
  const spark = isDark ? mix(pale, [1, 1, 1], 0.5) : core;
  return {
    isDark,
    core,
    accent,
    edge,
    line,
    spark,
    css: {
      core: toCss(core),
      accent: toCss(accent),
      edge: toCss(edge),
      ink: toCss(rgb.foreground),
      muted: toCss(rgb["muted-foreground"]),
      bg: toCss(rgb.background),
    },
  };
}

export function useHexagonThemeColors() {
  const { resolvedTheme, theme } = useTheme();
  const [colors, setColors] = useState(FALLBACK);

  useEffect(() => {
    // Wait a frame so next-themes has put the new class on <html>.
    const frame = requestAnimationFrame(() =>
      setColors(buildColors(readTokens())),
    );
    return () => cancelAnimationFrame(frame);
  }, [resolvedTheme, theme]);

  return colors;
}
