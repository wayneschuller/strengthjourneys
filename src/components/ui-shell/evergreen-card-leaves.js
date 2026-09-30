/** @format */

import { useEffect } from "react";
import { useTheme } from "next-themes";

// Evergreen theme: each card grows a sprig of leaves in a bottom corner (drawn
// by CSS on the card's ::after, see globals.css). This picks the sprig for
// every card on the page, from a hash of the card's text and its place in the
// document, so neighbouring cards and repeated grids never line up the way a
// CSS :nth-of-type cycle would. A card keeps its sprig once it has one.

const SHAPES = [
  ["stem", 0.43],
  ["fan", 0.3],
  ["fallen", 0.2],
  ["none", 0.07],
];

function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A stream of numbers in [0, 1) from one seed (mulberry32).
function randoms(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickShape(r) {
  let total = 0;
  for (const [shape, weight] of SHAPES) {
    total += weight;
    if (r < total) return shape;
  }
  return "stem";
}

function plant(card, index) {
  const key = `${index}:${(card.textContent ?? "").trim().slice(0, 60)}`;
  const next = randoms(hashString(key));
  card.dataset.sprig = pickShape(next());
  if (next() < 0.38) card.dataset.sprigSide = "left";
  const style = card.style;
  style.setProperty("--card-sprig-tilt", `${(next() * 13 - 8).toFixed(1)}deg`);
  style.setProperty("--card-sprig-scale", (0.82 + next() * 0.33).toFixed(2));
  style.setProperty("--card-sprig-inset", `${(next() * 10).toFixed(1)}px`);
  style.setProperty("--card-sprig-delay", `-${(next() * 9).toFixed(2)}s`);
  style.setProperty("--card-sprig-period", `${(7.5 + next() * 3).toFixed(2)}s`);
}

function plantAll() {
  const cards = document.querySelectorAll(".blueprint-card");
  cards.forEach((card, index) => {
    if (!card.dataset.sprig) plant(card, index);
  });
}

/** Renders nothing; assigns card sprigs while an Evergreen theme is active. */
export function EvergreenCardLeaves() {
  const { theme, resolvedTheme } = useTheme();
  const active = (theme ?? resolvedTheme ?? "").startsWith("evergreen");

  useEffect(() => {
    if (!active) return;
    plantAll();
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        plantAll();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [active]);

  return null;
}
