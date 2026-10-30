// The strength hexagon: the big four lifts and pull-ups, each scored 0 to 100
// as a percentile, drawn as one shape (a pentagon while there are five axes;
// the module keeps the hexagon name from the original six-axis design). This module holds what every renderer
// shares, so the WebGL views, their HTML labels, the editorial SVG and the
// story card export all agree on where a vertex sits and what it means:
// the axes, the radius mapping, the tier rings, the camera, the palettes,
// the lab's preset athletes and the archetype name a shape earns.

import { MODELED_UNIVERSE_PROFILES } from "@/lib/strength-circles/strength-percentile-data";

// Clockwise from the top of the shape when seen from the front: the big four
// in the app's usual order, then pull-ups for bodyweight strength. The
// renderers take their axis count from this list, so adding an axis here is
// all it takes to draw a different polygon.
export const HEXAGON_AXES = [
  { key: "squat", label: "Squat", lift: "Back Squat", addPrompt: "Add squat" },
  {
    key: "bench",
    label: "Bench",
    lift: "Bench Press",
    addPrompt: "Add bench",
  },
  {
    key: "deadlift",
    label: "Deadlift",
    lift: "Deadlift",
    addPrompt: "Add deadlift",
  },
  {
    key: "press",
    label: "Press",
    lift: "Strict Press",
    addPrompt: "Add press",
  },
  {
    key: "pullups",
    label: "Pull-ups",
    lift: "Pull-up or chin-up",
    addPrompt: "Add pull-ups",
  },
];

// A 0th percentile vertex still sits a little off the centre, so a weak axis
// reads as a short spoke rather than collapsing the shape into a sliver.
export const MIN_RADIUS = 0.14;

export function radiusForPercentile(percentile) {
  if (percentile == null) return MIN_RADIUS * 0.85;
  const clamped = Math.min(100, Math.max(0, percentile));
  return MIN_RADIUS + (1 - MIN_RADIUS) * (clamped / 100);
}

// Angle of axis i on the floor plane, measured from +z toward +x.
export function axisAngle(index) {
  return (index * Math.PI * 2) / HEXAGON_AXES.length;
}

// Floor-plane position (x, z) of a vertex at radius r on axis i.
export function axisPoint(index, radius) {
  const angle = axisAngle(index);
  return [Math.sin(angle) * radius, Math.cos(angle) * radius];
}

// The rings are the General Population percentiles at the Kilgore thresholds,
// so "inside the Advanced ring" means what the How Strong Am I rings say.
const GENERAL_ANCHORS = MODELED_UNIVERSE_PROFILES["General Population"].anchors;
export const TIER_RINGS = [
  { label: "Beginner", percentile: GENERAL_ANCHORS[1] },
  { label: "Intermediate", percentile: GENERAL_ANCHORS[2] },
  { label: "Advanced", percentile: GENERAL_ANCHORS[3] },
  { label: "Elite", percentile: GENERAL_ANCHORS[4] },
].map((ring) => ({ ...ring, radius: radiusForPercentile(ring.percentile) }));

export function tierLabelForPercentile(percentile) {
  if (percentile == null) return null;
  let label = "Building";
  for (const ring of TIER_RINGS) {
    if (percentile >= ring.percentile) label = ring.label;
  }
  return label;
}

export function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

// What a label shows under an axis name: the percentile as an ordinal, or an
// invitation for an axis the athlete has not tested yet.
export function formatAxisValue(percentile, axis) {
  if (percentile == null) return axis.addPrompt;
  return ordinal(Math.round(percentile));
}

export function overallPercentile(values) {
  const tested = values.filter((value) => value != null);
  if (!tested.length) return null;
  return Math.round(tested.reduce((sum, v) => sum + v, 0) / tested.length);
}

// ─── Archetypes ─────────────────────────────────────────────────────────────
// Placeholder names for the lab. Every one is a compliment: the shape tells
// an athlete what they are great at, never what they lack.

const ARCHETYPE_BY_AXIS = {
  squat: "The Powerhouse",
  bench: "The Presser",
  deadlift: "The Puller",
  press: "The Overhead Athlete",
  pullups: "The Climber",
};

export function archetypeFor(values) {
  const tested = values
    .map((value, index) => ({ value, axis: HEXAGON_AXES[index] }))
    .filter(({ value }) => value != null);
  if (tested.length < 3) return "The Rising Athlete";

  const sorted = [...tested].sort((a, b) => b.value - a.value);
  const spread = sorted[0].value - sorted[sorted.length - 1].value;
  if (spread <= 18) return "The All-Rounder";
  return ARCHETYPE_BY_AXIS[sorted[0].axis.key];
}

export function strongestAxis(values) {
  let best = null;
  values.forEach((value, index) => {
    if (value == null) return;
    if (!best || value > best.value)
      best = { value, axis: HEXAGON_AXES[index] };
  });
  return best;
}

// ─── Camera ─────────────────────────────────────────────────────────────────
// One camera definition feeds the shader uniforms and the label projection, so
// an HTML label always lands on its glowing vertex.

export function getCamera({ yaw, pitch, distance, targetY = 0, fov = 1.7 }) {
  const cosPitch = Math.cos(pitch);
  const pos = [
    Math.sin(yaw) * cosPitch * distance,
    targetY + Math.sin(pitch) * distance,
    -Math.cos(yaw) * cosPitch * distance,
  ];
  const fwd = normalize([-pos[0], targetY - pos[1], -pos[2]]);
  const right = normalize(cross([0, 1, 0], fwd));
  const up = cross(fwd, right);
  return { pos, fwd, right, up, focal: fov };
}

// Project a world point to CSS pixels in a width x height viewport, using the
// same uv convention as the shaders: uv.y spans -1..1 over the height.
export function projectPoint(point, camera, width, height) {
  const d = [
    point[0] - camera.pos[0],
    point[1] - camera.pos[1],
    point[2] - camera.pos[2],
  ];
  const depth = dot(d, camera.fwd);
  if (depth <= 0.0001) return null;
  const u = (dot(d, camera.right) / depth) * camera.focal;
  const v = (dot(d, camera.up) / depth) * camera.focal;
  return {
    x: width / 2 + (u * height) / 2,
    y: height / 2 - (v * height) / 2,
    depth,
  };
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

// ─── Palettes ───────────────────────────────────────────────────────────────
// Named for how they look. Colours are linear-ish RGB in 0..1 for the shaders;
// `css` holds the same hues for HTML text, glows and the card export.

export const HEXAGON_PALETTES = {
  ember: {
    label: "Ember",
    core: [1.0, 0.42, 0.12],
    edge: [1.0, 0.78, 0.42],
    accent: [0.95, 0.16, 0.32],
    bg: [0.035, 0.02, 0.03],
    css: { core: "#ff6b1f", edge: "#ffc76b", accent: "#f22952", bg: "#0b0508" },
  },
  glacier: {
    label: "Glacier",
    core: [0.2, 0.7, 1.0],
    edge: [0.78, 0.95, 1.0],
    accent: [0.36, 0.34, 1.0],
    bg: [0.015, 0.03, 0.06],
    css: { core: "#33b3ff", edge: "#c7f2ff", accent: "#5c57ff", bg: "#040810" },
  },
  aurora: {
    label: "Aurora",
    core: [0.1, 0.95, 0.7],
    edge: [0.85, 1.0, 0.92],
    accent: [0.75, 0.25, 1.0],
    bg: [0.02, 0.03, 0.05],
    css: { core: "#1af2b3", edge: "#d9ffeb", accent: "#bf40ff", bg: "#05080d" },
  },
  gilded: {
    label: "Gilded",
    core: [1.0, 0.74, 0.28],
    edge: [1.0, 0.94, 0.75],
    accent: [0.85, 0.45, 0.18],
    bg: [0.04, 0.03, 0.02],
    css: { core: "#ffbd47", edge: "#fff0bf", accent: "#d9732e", bg: "#0a0805" },
  },
};

// ─── Lab presets ────────────────────────────────────────────────────────────
// Percentiles per axis in HEXAGON_AXES order; null is an untested axis.

export const HEXAGON_PRESETS = [
  { id: "all-rounder", label: "All-rounder", values: [72, 66, 76, 70, 64] },
  { id: "powerlifter", label: "Powerlifter", values: [93, 90, 96, 58, 38] },
  { id: "calisthenics", label: "Calisthenics", values: [52, 61, 55, 79, 97] },
  { id: "strongman", label: "Strongman", values: [92, 74, 97, 91, 35] },
  { id: "first-year", label: "First year", values: [44, 36, 50, 40, null] },
  { id: "elite", label: "Elite", values: [99, 97, 99, 95, 93] },
];

export const AGE_GROUPS = [
  { id: "all", label: "of all ages", phrase: "athletes" },
  { id: "20s", label: "20 to 29", phrase: "athletes aged 20 to 29" },
  { id: "30s", label: "30 to 39", phrase: "athletes aged 30 to 39" },
  { id: "40s", label: "40 to 49", phrase: "athletes aged 40 to 49" },
  { id: "50s", label: "50 to 59", phrase: "athletes aged 50 to 59" },
  { id: "60s", label: "60 and over", phrase: "athletes aged 60 and over" },
];

export function headlineFor(values, ageGroupId) {
  const overall = overallPercentile(values);
  if (overall == null) return "Add a lift to see your shape";
  const group =
    AGE_GROUPS.find((entry) => entry.id === ageGroupId) ?? AGE_GROUPS[0];
  return `Stronger than ${overall}% of ${group.phrase}`;
}
