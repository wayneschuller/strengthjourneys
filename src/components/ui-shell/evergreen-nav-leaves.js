/** @format */

// Evergreen theme: faint sprigs of leaves hanging into the nav from the window
// edge. Drawn as inline SVG rather than a background image so that, with the
// animated background on, each stem can bend at its joints and each leaf can
// flutter on its stalk (the motion lives in globals.css). Every other theme
// hides these with CSS, so the markup is the same for all themes and there is
// no hydration mismatch.

// Four leaf outlines, as control points scaled by leaf length L. Each is drawn
// from its base at (0, 0) pointing along +x; the midrib bows with the shape.
const LEAF_SHAPES = [
  // lance: the original Evergreen leaf
  { top: [0.3, -0.3, 0.75, -0.24], bottom: [0.75, 0.24, 0.3, 0.3], rib: 0 },
  // broad oval, widest near the base
  { top: [0.14, -0.42, 0.62, -0.36], bottom: [0.62, 0.36, 0.14, 0.42], rib: 0 },
  // slender willow
  { top: [0.35, -0.19, 0.8, -0.13], bottom: [0.8, 0.13, 0.35, 0.19], rib: 0 },
  // curved, tip turning up
  {
    top: [0.3, -0.34, 0.78, -0.28],
    bottom: [0.74, 0.12, 0.25, 0.24],
    rib: -0.06,
  },
];

function leafPaths(shapeIndex, length) {
  const { top, bottom, rib } = LEAF_SHAPES[shapeIndex];
  const n = (v) => (v * length).toFixed(2);
  return {
    blade: `M0 0C${n(top[0])} ${n(top[1])} ${n(top[2])} ${n(top[3])} ${n(1)} 0C${n(bottom[0])} ${n(bottom[1])} ${n(bottom[2])} ${n(bottom[3])} 0 0Z`,
    rib: `M${n(0.08)} 0Q${n(0.5)} ${n(rib)} ${n(0.85)} 0`,
  };
}

// Small integer hash so each leaf gets a stable size, shape and timing, the
// same on the server and in every browser.
function hash(seed) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function cubicPoint([p0, p1, p2, p3], t) {
  const u = 1 - t;
  return [0, 1].map(
    (i) =>
      u * u * u * p0[i] +
      3 * u * u * t * p1[i] +
      3 * u * t * t * p2[i] +
      t * t * t * p3[i],
  );
}

// The part of a cubic between t0 and t1, as a cubic of its own.
function cubicSlice(curve, t0, t1) {
  const lerp = (a, b, t) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
  const splitAt = ([p0, p1, p2, p3], t) => {
    const a = lerp(p0, p1, t);
    const b = lerp(p1, p2, t);
    const c = lerp(p2, p3, t);
    const d = lerp(a, b, t);
    const e = lerp(b, c, t);
    const f = lerp(d, e, t);
    return [
      [p0, a, d, f],
      [f, e, c, p3],
    ];
  };
  const [, tail] = splitAt(curve, t0);
  const [head] = splitAt(tail, t0 >= 1 ? 0 : (t1 - t0) / (1 - t0));
  return head;
}

function nearestT(curve, [x, y]) {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i <= 200; i++) {
    const [px, py] = cubicPoint(curve, i / 200);
    const distance = (px - x) ** 2 + (py - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i / 200;
    }
  }
  return best;
}

const curvePath = (c) =>
  `M${c[0].join(" ")}C${c[1].join(" ")} ${c[2].join(" ")} ${c[3].join(" ")}`;

// Stem curves and leaf placements, [x, y, angle, length], in each sprig's own
// viewBox. `joints` are where the stem bends; each segment nests inside the
// previous one so the bend adds up toward the tip.
const CORNER = {
  viewBox: "0 0 190 84",
  branches: [
    {
      curve: [
        [-4, -4],
        [40, 14],
        [95, 20],
        [168, 22],
      ],
      joints: [0.3, 0.58, 0.8],
      leaves: [
        [20.9, 4.6, 61.1, 23.9],
        [38.8, 9.2, -32.3, 22.5],
        [61.1, 13.5, 54.3, 20.9],
        [83.3, 16.6, -38.3, 19.3],
        [107, 18.9, 49.7, 17.8],
        [130.3, 20.5, -41.8, 16.4],
        [168, 22, 1.6, 15.6],
      ],
    },
    {
      curve: [
        [-4, -4],
        [14, 22],
        [24, 44],
        [30, 70],
      ],
      joints: [0.4, 0.72],
      leaves: [
        [10.1, 18.5, 105.9, 17.3],
        [17.5, 33, 20.4, 15.5],
        [23.4, 47.5, 115.2, 13.7],
        [30, 70, 77, 12],
      ],
    },
  ],
};

// The mid-nav twig hangs from its top-right corner, leaves pointing left.
const TWIG = {
  viewBox: "0 0 80 40",
  branches: [
    {
      curve: [
        [84, -4],
        [60, 8],
        [35, 12],
        [10, 13],
      ],
      joints: [0.5],
      leaves: [
        [58.5, 5.9, 119.1, 15.2],
        [36.2, 10.6, 216.5, 12.7],
        [10, 13, 177.7, 10.8],
      ],
    },
  ],
};

function buildBranch(branch, branchIndex, seedBase) {
  const { curve, joints } = branch;
  const bounds = [0, ...joints, 1];
  const segments = bounds.slice(0, -1).map((t0, i) => ({
    origin: cubicPoint(curve, t0),
    path: curvePath(cubicSlice(curve, t0, bounds[i + 1])),
    leaves: [],
  }));

  branch.leaves.forEach(([x, y, angle, length], leafIndex) => {
    const seed = seedBase + branchIndex * 37 + leafIndex * 7;
    const t = nearestT(curve, [x, y]);
    const segmentIndex = Math.max(
      0,
      bounds.findIndex((b, i) => i > 0 && t <= b) - 1,
    );
    // Sizes vary by about 12% either way; smaller leaves flutter more.
    const scale = 0.88 + hash(seed) * 0.24;
    segments[segmentIndex].leaves.push({
      x,
      y,
      angle: angle + (hash(seed + 1) - 0.5) * 10,
      ...leafPaths(
        Math.floor(hash(seed + 2) * LEAF_SHAPES.length),
        length * scale,
      ),
      flutter: {
        "--leaf-amp": `${(3.4 - scale * 1.4).toFixed(2)}deg`,
        animationDuration: `${(2.6 + hash(seed + 3) * 1.9).toFixed(2)}s`,
        animationDelay: `-${(hash(seed + 4) * 4).toFixed(2)}s`,
      },
    });
  });

  return segments;
}

function Segment({ segments, index }) {
  const segment = segments[index];
  if (!segment) return null;
  const [ox, oy] = segment.origin;

  return (
    <g
      className="evergreen-stem"
      style={{
        transformOrigin: `${ox.toFixed(2)}px ${oy.toFixed(2)}px`,
        "--joint": index === 0 ? 0.4 : 0.25,
      }}
    >
      <path
        d={segment.path}
        fill="none"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {segment.leaves.map((leaf, i) => (
        <g
          key={i}
          transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.angle.toFixed(1)})`}
        >
          <g className="evergreen-leaf" style={leaf.flutter}>
            <path d={leaf.blade} stroke="none" />
            <path
              d={leaf.rib}
              className="evergreen-rib"
              fill="none"
              strokeWidth="0.8"
            />
          </g>
        </g>
      ))}
      <Segment segments={segments} index={index + 1} />
    </g>
  );
}

function buildSprig(sprig, seedBase) {
  return {
    viewBox: sprig.viewBox,
    branches: sprig.branches.map((branch, i) =>
      buildBranch(branch, i, seedBase),
    ),
  };
}

// Built once at load; the geometry never changes.
const LEFT_CORNER = buildSprig(CORNER, 1);
const RIGHT_CORNER = buildSprig(CORNER, 101);
const NAV_TWIG = buildSprig(TWIG, 201);
const GAP_TWIG = buildSprig(TWIG, 301);

function Sprig({ sprig, className }) {
  return (
    <svg
      viewBox={sprig.viewBox}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {sprig.branches.map((segments, i) => (
        <Segment key={i} segments={segments} index={0} />
      ))}
    </svg>
  );
}

/**
 * The two corner sprigs and the tablet-width twig, placed inside the nav.
 * Hidden unless an Evergreen theme is active.
 */
export function EvergreenNavLeaves() {
  return (
    <>
      <Sprig
        sprig={LEFT_CORNER}
        className="evergreen-sprig evergreen-sprig-left"
      />
      <div className="evergreen-sprig-right-mirror">
        <Sprig
          sprig={RIGHT_CORNER}
          className="evergreen-sprig evergreen-sprig-right"
        />
      </div>
      <Sprig
        sprig={NAV_TWIG}
        className="evergreen-sprig evergreen-twig evergreen-twig-nav"
      />
    </>
  );
}

/** The twig that hangs in the gap between the nav links and the buttons. */
export function EvergreenGapTwig() {
  return (
    <Sprig
      sprig={GAP_TWIG}
      className="evergreen-sprig evergreen-twig evergreen-twig-gap"
    />
  );
}
