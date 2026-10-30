// The editorial strength hexagon: a print-magazine take on the same six
// scores. A rose of six wedges, one per axis, sits on a polar grid of the tier
// rings, with the hexagon itself drawn as a fine ink line through the wedge
// tips. Motion is quiet: the wedges spring out on arrival, a sheen passes
// over them, and the outer dotted ring turns very slowly.
//
// All text lives in HTML over the SVG rather than inside it, so the story card
// export can rasterise the SVG shapes and set the type itself with the same
// fonts the page uses.

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import {
  HEXAGON_AXES,
  TIER_RINGS,
  axisAngle,
  formatAxisValue,
  overallPercentile,
  radiusForPercentile,
  strongestAxis,
} from "@/components/strength-hexagon/hexagon-model";
import { cn } from "@/lib/utils";

export const EDITORIAL_THEME = {
  bg: "#f3eee3",
  ink: "#1d1a16",
  muted: "#6f675b",
};

const SIZE = 600;
const CENTER = SIZE / 2;
const OUTER = 212;
const INNER = 22;
const HALF_SECTOR = Math.PI / HEXAGON_AXES.length;
const WEDGE_HALF_ANGLE = HALF_SECTOR - 0.03;

function polar(angle, radius) {
  return [CENTER + Math.sin(angle) * radius, CENTER - Math.cos(angle) * radius];
}

function wedgePath(index, radius) {
  const angle = axisAngle(index);
  const from = angle - WEDGE_HALF_ANGLE;
  const to = angle + WEDGE_HALF_ANGLE;
  const [ix1, iy1] = polar(from, INNER);
  const [ox1, oy1] = polar(from, radius);
  const [ox2, oy2] = polar(to, radius);
  const [ix2, iy2] = polar(to, INNER);
  return [
    `M ${ix1} ${iy1}`,
    `L ${ox1} ${oy1}`,
    `A ${radius} ${radius} 0 0 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${INNER} ${INNER} 0 0 0 ${ix1} ${iy1}`,
    "Z",
  ].join(" ");
}

// Springs a list of percentiles toward their targets, null meaning untested.
// The spring state outlives a change of target, so dragging a slider bends
// the shape instead of regrowing it from the centre.
function useSpringValues(values) {
  const [animated, setAnimated] = useState(() => values.map(() => 0));
  const targetsRef = useRef(values);
  const springRef = useRef(null);

  useEffect(() => {
    targetsRef.current = values;
    if (!springRef.current) {
      springRef.current = {
        current: values.map(() => 0),
        velocity: values.map(() => 0),
        frame: 0,
        reduceMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches,
      };
    }
    const spring = springRef.current;
    if (spring.reduceMotion) {
      spring.current = targetsRef.current.map((value) => value ?? 0);
      setAnimated(spring.current);
      return undefined;
    }
    if (spring.frame) return undefined;

    let previous = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - previous) / 1000, 1 / 20);
      previous = now;
      let moving = false;
      targetsRef.current.forEach((target, index) => {
        const goal = target ?? 0;
        spring.velocity[index] +=
          ((goal - spring.current[index]) * 60 -
            spring.velocity[index] * 10.5) *
          dt;
        spring.current[index] += spring.velocity[index] * dt;
        if (
          Math.abs(goal - spring.current[index]) > 0.05 ||
          Math.abs(spring.velocity[index]) > 0.05
        )
          moving = true;
      });
      setAnimated([...spring.current]);
      spring.frame = moving ? requestAnimationFrame(tick) : 0;
    };
    spring.frame = requestAnimationFrame(tick);
    return undefined;
  }, [values]);

  useEffect(
    () => () => {
      if (springRef.current?.frame) {
        cancelAnimationFrame(springRef.current.frame);
        springRef.current.frame = 0;
      }
    },
    [],
  );

  return animated;
}

export const StrengthHexagonEditorial = forwardRef(
  function StrengthHexagonEditorial({ values, palette, className }, ref) {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const id = useId().replace(/:/g, "");
    const animated = useSpringValues(values);
    const overall = overallPercentile(values);
    const strongest = strongestAxis(values);
    const css = palette.css;

    const radii = animated.map((value, index) =>
      values[index] == null
        ? TIER_RINGS[0].radius * OUTER
        : Math.max(radiusForPercentile(value) * OUTER, INNER + 4),
    );

    const labels = HEXAGON_AXES.map((axis, index) => {
      const [x, y] = polar(axisAngle(index), OUTER * 1.2);
      return { axis, index, x, y };
    });

    useImperativeHandle(ref, () => ({
      async capture() {
        const rect = containerRef.current.getBoundingClientRect();
        const scale = rect.width / SIZE;
        const markup = new XMLSerializer().serializeToString(svgRef.current);
        const image = new Image();
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = SIZE * 2;
        canvas.height = SIZE * 2;
        const context = canvas.getContext("2d");
        context.fillStyle = EDITORIAL_THEME.bg;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return {
          canvas,
          width: rect.width,
          height: rect.height,
          labels: [
            ...labels.map(({ axis, index, x, y }) => ({
              label: axis.label,
              value: formatAxisValue(values[index], axis),
              x: x * scale,
              y: y * scale,
              opacity: values[index] == null ? 0.55 : 1,
            })),
            ...(overall == null
              ? []
              : [
                  {
                    kind: "center",
                    label: "overall",
                    value: String(overall),
                    x: CENTER * scale,
                    y: CENTER * scale,
                    opacity: 1,
                  },
                ]),
          ],
        };
      },
    }));

    const tips = radii.map((radius, index) => polar(axisAngle(index), radius));

    return (
      <div
        ref={containerRef}
        className={cn("relative aspect-square w-full select-none", className)}
      >
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label="Strength hexagon"
        >
          <defs>
            <radialGradient
              id={`${id}-fill`}
              cx={CENTER}
              cy={CENTER}
              r={OUTER}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor={css.accent} stopOpacity="0.95" />
              <stop offset="0.55" stopColor={css.core} stopOpacity="0.92" />
              <stop offset="1" stopColor={css.edge} stopOpacity="0.95" />
            </radialGradient>
            <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <pattern
              id={`${id}-hatch`}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke={EDITORIAL_THEME.ink}
                strokeOpacity="0.28"
                strokeWidth="1.2"
              />
            </pattern>
            <filter
              id={`${id}-glow`}
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <clipPath id={`${id}-wedges`}>
              {radii.map((radius, index) =>
                values[index] == null ? null : (
                  <path key={index} d={wedgePath(index, radius)} />
                ),
              )}
            </clipPath>
          </defs>

          {/* Polar grid: the tier rings and the spokes between wedges */}
          {TIER_RINGS.map((ring, index) => (
            <circle
              key={ring.label}
              cx={CENTER}
              cy={CENTER}
              r={ring.radius * OUTER}
              fill="none"
              stroke={EDITORIAL_THEME.ink}
              strokeOpacity={0.12 + index * 0.05}
              strokeWidth={index === TIER_RINGS.length - 1 ? 1.2 : 0.8}
              strokeDasharray={index % 2 === 0 ? "2 4" : undefined}
            />
          ))}

          {HEXAGON_AXES.map((axis, index) => {
            const [x, y] = polar(axisAngle(index) + HALF_SECTOR, OUTER);
            return (
              <line
                key={axis.key}
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
                stroke={EDITORIAL_THEME.ink}
                strokeOpacity="0.1"
                strokeWidth="0.8"
              />
            );
          })}
          <g
            className="motion-safe:animate-[spin_140s_linear_infinite]"
            style={{ transformBox: "view-box", transformOrigin: "50% 50%" }}
          >
            <circle
              cx={CENTER}
              cy={CENTER}
              r={OUTER * 1.07}
              fill="none"
              stroke={EDITORIAL_THEME.ink}
              strokeOpacity="0.55"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray="0.1 7"
            />
          </g>

          {/* Soft glow under the wedges */}
          <g filter={`url(#${id}-glow)`} opacity="0.45">
            {radii.map((radius, index) =>
              values[index] == null ? null : (
                <path
                  key={index}
                  d={wedgePath(index, radius)}
                  fill={css.core}
                />
              ),
            )}
          </g>

          {/* The wedges */}
          {radii.map((radius, index) => (
            <path
              key={index}
              d={wedgePath(index, radius)}
              fill={
                values[index] == null ? `url(#${id}-hatch)` : `url(#${id}-fill)`
              }
              stroke={EDITORIAL_THEME.ink}
              strokeOpacity={values[index] == null ? 0.35 : 0.85}
              strokeWidth="1"
              strokeDasharray={values[index] == null ? "3 3" : undefined}
            />
          ))}

          {/* A sheen passing over the coloured wedges */}
          <g clipPath={`url(#${id}-wedges)`}>
            <g
              className="motion-safe:animate-[spin_9s_linear_infinite]"
              style={{ transformBox: "view-box", transformOrigin: "50% 50%" }}
            >
              <rect
                x={CENTER}
                y={CENTER - 14}
                width={OUTER * 1.1}
                height="28"
                fill={`url(#${id}-sheen)`}
                opacity="0.55"
              />
            </g>
          </g>

          {/* The hexagon itself, in ink through the wedge tips */}
          <polygon
            points={tips.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke={EDITORIAL_THEME.ink}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {tips.map(([x, y], index) => (
            <g key={index}>
              <circle
                cx={x}
                cy={y}
                r={values[index] == null ? 2.5 : 4}
                fill={
                  values[index] == null
                    ? EDITORIAL_THEME.bg
                    : EDITORIAL_THEME.ink
                }
                stroke={EDITORIAL_THEME.ink}
                strokeWidth="1.2"
              />
              {strongest?.axis === HEXAGON_AXES[index] && (
                <circle
                  cx={x}
                  cy={y}
                  r="10"
                  fill="none"
                  stroke={EDITORIAL_THEME.ink}
                  strokeWidth="1"
                  className="motion-safe:animate-pulse"
                />
              )}
            </g>
          ))}

          <circle
            cx={CENTER}
            cy={CENTER}
            r={INNER + 34}
            fill={EDITORIAL_THEME.bg}
            stroke={EDITORIAL_THEME.ink}
            strokeOpacity="0.8"
            strokeWidth="1"
          />
        </svg>

        {/* Tier names along the gaps either side of the top axis */}
        {TIER_RINGS.map((ring, index) => {
          const [x, y] = polar(
            index % 2 === 0 ? HALF_SECTOR : -HALF_SECTOR,
            ring.radius * OUTER,
          );
          return (
            <span
              key={ring.label}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[9px] italic sm:text-[11px]"
              style={{
                left: `${(x / SIZE) * 100}%`,
                top: `${(y / SIZE) * 100}%`,
                color: EDITORIAL_THEME.muted,
                fontFamily: "'Fraunces Variable', Georgia, serif",
                background: EDITORIAL_THEME.bg,
                padding: "0 3px",
              }}
            >
              {ring.label}
            </span>
          );
        })}

        {overall != null && (
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center leading-none"
            style={{ color: EDITORIAL_THEME.ink }}
          >
            <span
              className="text-3xl font-semibold sm:text-4xl"
              style={{ fontFamily: "'Fraunces Variable', Georgia, serif" }}
            >
              {overall}
            </span>
            <span
              className="mt-1 text-[10px] sm:text-xs"
              style={{
                color: EDITORIAL_THEME.muted,
                fontFamily: "'IBM Plex Sans Condensed', sans-serif",
              }}
            >
              overall
            </span>
          </div>
        )}

        {labels.map(({ axis, index, x, y }) => {
          const value = values[index];
          const isStrongest = strongest?.axis === axis && value >= 50;
          return (
            <div
              key={axis.key}
              className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center leading-none whitespace-nowrap"
              style={{
                left: `${(x / SIZE) * 100}%`,
                top: `${(y / SIZE) * 100}%`,
                color: EDITORIAL_THEME.ink,
                opacity: value == null ? 0.6 : 1,
              }}
            >
              <span
                className="text-[11px] tracking-wide sm:text-xs"
                style={{
                  color: EDITORIAL_THEME.muted,
                  fontFamily: "'IBM Plex Sans Condensed', sans-serif",
                }}
              >
                {axis.label}
              </span>
              <span
                className={cn(
                  "mt-0.5 font-semibold",
                  value == null ? "text-sm" : "text-lg sm:text-xl",
                )}
                style={{ fontFamily: "'Fraunces Variable', Georgia, serif" }}
              >
                {formatAxisValue(value, axis)}
              </span>
              {isStrongest && (
                <span
                  className="mt-1 rounded-full px-1.5 py-0.5 text-[10px] text-white"
                  style={{
                    background: EDITORIAL_THEME.ink,
                    fontFamily: "'IBM Plex Sans Condensed', sans-serif",
                  }}
                >
                  Top {Math.max(1, 100 - Math.round(value))}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  },
);
