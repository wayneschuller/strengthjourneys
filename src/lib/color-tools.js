/** @format */
// color-tools.js
// Wayne Schuller, wayne@schuller.id.au
// Licenced under https://www.gnu.org/licenses/gpl-3.0.html

/**
 * Brighten a hex color by scaling each RGB channel by `factor` (clamped to 255).
 * Used when a theme's base lift color needs a lighter variant for dark-mode strokes
 * or hover states without defining a second palette.
 *
 * @param {string} hex - Hex color, with or without leading `#` (e.g. "#1e40af" or "1e40af").
 * @param {number} [factor=1.2] - Channel multiplier. >1 brightens, <1 darkens.
 * @returns {string} Hex string with leading `#`.
 */
export function brightenHexColor(hex, factor = 1.2) {
  // Remove # if present
  hex = hex.replace("#", "");

  // Convert hex to RGB
  let r = parseInt(hex.slice(0, 2), 16);
  let g = parseInt(hex.slice(2, 4), 16);
  let b = parseInt(hex.slice(4, 6), 16);

  // Brighten the color
  r = Math.min(255, Math.floor(r * factor));
  g = Math.min(255, Math.floor(g * factor));
  b = Math.min(255, Math.floor(b * factor));

  // Convert back to hex
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Increase saturation of a hex color via HSL round-trip, scaling S by `factor`.
 * Used when a theme color reads muted against chart backgrounds and needs
 * more visual pop without shifting hue or lightness.
 *
 * @param {string} hex - Hex color, with or without leading `#`.
 * @param {number} [factor=1.2] - Saturation multiplier (clamped to 1.0).
 * @returns {string} Hex string with leading `#`.
 */
export function saturateHexColor(hex, factor = 1.2) {
  // Remove # if present
  hex = hex.replace("#", "");
  // Convert hex to RGB
  let r = parseInt(hex.slice(0, 2), 16) / 255;
  let g = parseInt(hex.slice(2, 4), 16) / 255;
  let b = parseInt(hex.slice(4, 6), 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Increase saturation
  s = Math.min(1, s * factor);

  // Convert HSL back to RGB
  let r1, g1, b1;
  if (s === 0) {
    r1 = g1 = b1 = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r1 = hue2rgb(p, q, h + 1 / 3);
    g1 = hue2rgb(p, q, h);
    b1 = hue2rgb(p, q, h - 1 / 3);
  }

  // Convert back to hex
  return `#${Math.round(r1 * 255)
    .toString(16)
    .padStart(2, "0")}${Math.round(g1 * 255)
    .toString(16)
    .padStart(2, "0")}${Math.round(b1 * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

/**
 * Convert a hex color (#rgb or #rrggbb) to an `rgba(...)` string with the given alpha.
 * Needed wherever CSS demands transparency (glows, overlays, box-shadow tints) —
 * falls back to transparent black on malformed input rather than throwing.
 *
 * @param {string} hexColor - Hex color with leading `#`. Accepts 3 or 6 digit forms.
 * @param {number} alpha - Alpha 0..1 (not validated — pass valid CSS alpha).
 * @returns {string} CSS `rgba(r, g, b, a)` string.
 */
export function hexToRgba(hexColor, alpha) {
  if (typeof hexColor !== "string" || !hexColor.startsWith("#")) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  let hex = hexColor.slice(1);
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (hex.length !== 6) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
