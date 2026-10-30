// The WebGL strength shape: a transparent shader canvas with HTML labels
// riding on top, coloured from the active theme.
//
// Everything that moves is driven from one requestAnimationFrame loop held in
// refs, never React state, so the animation costs no re-renders. The loop
// springs each vertex toward its target (the shape blooms out from the centre
// on arrival and bends when a value changes), sways the camera gently around
// the front view, and moves each label to where its vertex projects through
// that same camera. Drag turns it by hand; let go and it drifts, then settles
// back to face the front. Reduced motion holds the camera still and snaps the
// shape into place.

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import {
  HEXAGON_AXES,
  TIER_RINGS,
  axisPoint,
  formatAxisValue,
  getCamera,
  projectPoint,
  radiusForPercentile,
} from "@/components/strength-hexagon/hexagon-model";
import { createHexagonRenderer } from "@/components/strength-hexagon/hexagon-gl";
import { HOLOGRAM_FRAGMENT } from "@/components/strength-hexagon/hexagon-shaders";
import { cn } from "@/lib/utils";

const CAMERA = { pitch: 0.82, distance: 2.45, targetY: 0.14 };
const NARROW_DISTANCE = 3.05;
const LABEL_RADIUS = 1.24;
const SPRING_STIFFNESS = 70;
const SPRING_DAMPING = 11;
const SWAY = 0.3;
const TAU = Math.PI * 2;
// Keep the drawing buffer near two megapixels however large the page draws it.
const MAX_PIXELS = 2_000_000;

export const StrengthHexagonWebGL = forwardRef(function StrengthHexagonWebGL(
  { values, colors, className, onUnsupported },
  ref,
) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const labelRefs = useRef([]);
  const valuesRef = useRef(values);
  const colorsRef = useRef(colors);
  const sizeRef = useRef({ width: 0, height: 0 });
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    valuesRef.current = values;
    colorsRef.current = colors;
  }, [values, colors]);

  useImperativeHandle(ref, () => ({
    // Snapshot for the image export: the canvas plus each label as drawn now.
    capture() {
      const { width, height } = sizeRef.current;
      const labels = HEXAGON_AXES.map((axis, index) => {
        const element = labelRefs.current[index];
        return {
          label: axis.label,
          value: formatAxisValue(valuesRef.current[index], axis),
          x: Number(element?.dataset.x ?? 0),
          y: Number(element?.dataset.y ?? 0),
          opacity: Number(element?.style.opacity || 1),
        };
      });
      return { canvas: canvasRef.current, width, height, labels };
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const renderer = createHexagonRenderer(canvas, HOLOGRAM_FRAGMENT);
    if (!renderer) {
      setUnsupported(true);
      onUnsupported?.();
      return undefined;
    }

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Vertices start near the centre and spring out to their targets.
    const radii = HEXAGON_AXES.map(() => (reduceMotion ? null : 0.02));
    const velocities = HEXAGON_AXES.map(() => 0);
    const motion = {
      userYaw: 0,
      spinVelocity: 0,
      dragging: false,
      lastX: 0,
      lastMoveTime: 0,
      visible: true,
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const area = Math.max(1, rect.width * rect.height);
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(MAX_PIXELS / area),
      );
      sizeRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      motion.visible = entry.isIntersecting;
    });
    intersectionObserver.observe(container);

    const onPointerDown = (event) => {
      motion.dragging = true;
      motion.lastX = event.clientX;
      motion.lastMoveTime = performance.now();
      motion.spinVelocity = 0;
      canvas.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (!motion.dragging) return;
      const now = performance.now();
      const delta = (event.clientX - motion.lastX) * 0.009;
      const elapsed = Math.max((now - motion.lastMoveTime) / 1000, 1 / 240);
      motion.userYaw -= delta;
      motion.spinVelocity = -delta / elapsed;
      motion.lastX = event.clientX;
      motion.lastMoveTime = now;
    };
    const onPointerUp = () => {
      motion.dragging = false;
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    const start = performance.now();
    let previous = start;
    let frame = 0;

    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - previous) / 1000, 1 / 20);
      previous = now;
      const { width, height } = sizeRef.current;
      if (!motion.visible || document.hidden || width === 0) return;

      const time = (now - start) / 1000;
      const targets = valuesRef.current.map(radiusForPercentile);
      targets.forEach((target, index) => {
        if (radii[index] == null) {
          radii[index] = target;
          return;
        }
        const force = (target - radii[index]) * SPRING_STIFFNESS;
        velocities[index] += (force - velocities[index] * SPRING_DAMPING) * dt;
        radii[index] += velocities[index] * dt;
      });

      // After a drag the shape coasts, then eases back to the nearest front view.
      if (!motion.dragging) {
        motion.userYaw += motion.spinVelocity * dt;
        motion.spinVelocity *= Math.exp(-dt * 2.5);
        if (Math.abs(motion.spinVelocity) < 0.08) {
          const front = Math.round(motion.userYaw / TAU) * TAU;
          motion.userYaw +=
            (front - motion.userYaw) * (1 - Math.exp(-dt * 1.2));
        }
      }
      const sway = reduceMotion ? 0 : SWAY * Math.sin(time * 0.17);
      // On a narrow screen the camera stands further back, leaving the labels
      // room around the shape instead of sitting on its corners.
      const distance = width < 520 ? NARROW_DISTANCE : CAMERA.distance;
      const camera = getCamera({
        yaw: motion.userYaw + sway,
        ...CAMERA,
        distance,
      });

      const verts = radii.flatMap((radius, index) =>
        axisPoint(index, Math.max(radius, 0.01)),
      );
      const tested = valuesRef.current.map((value) => (value == null ? 0 : 1));
      const vals = valuesRef.current.map((value) => (value ?? 0) / 100);
      const average =
        vals.reduce((sum, value) => sum + value, 0) / Math.max(1, vals.length);
      const prismHeight = 0.16 + 0.22 * average;
      const palette = colorsRef.current;

      renderer.draw(canvas.width, canvas.height, {
        uRes: [canvas.width, canvas.height],
        uTime: time,
        uCamPos: camera.pos,
        uCamFwd: camera.fwd,
        uCamRight: camera.right,
        uCamUp: camera.up,
        uFocal: camera.focal,
        uVerts: { type: "vec2[]", data: new Float32Array(verts) },
        uVals: { type: "float[]", data: new Float32Array(vals) },
        uTested: { type: "float[]", data: new Float32Array(tested) },
        uRings: {
          type: "float[]",
          data: new Float32Array(TIER_RINGS.map((ring) => ring.radius)),
        },
        uCore: palette.core,
        uEdge: palette.edge,
        uAccent: palette.accent,
        uLine: palette.line,
        uSpark: palette.spark,
        uLight: palette.isDark ? 0 : 1,
        uHeight: prismHeight,
        uSweep: reduceMotion ? 0 : 1,
      });

      HEXAGON_AXES.forEach((axis, index) => {
        const element = labelRefs.current[index];
        if (!element) return;
        const [x, z] = axisPoint(index, LABEL_RADIUS);
        const projected = projectPoint(
          [x, prismHeight + 0.04, z],
          camera,
          width,
          height,
        );
        if (!projected) return;
        // Labels on the far side recede, the near ones come forward.
        const nearness = Math.min(
          1,
          Math.max(0, (distance + 0.6 - projected.depth) / 1.2),
        );
        // Keep labels inside the frame even when a vertex swings to the edge.
        const labelX = Math.min(width - 48, Math.max(48, projected.x));
        const labelY = Math.min(height - 26, Math.max(26, projected.y));
        element.dataset.x = labelX.toFixed(1);
        element.dataset.y = labelY.toFixed(1);
        element.style.opacity = (0.55 + 0.45 * nearness).toFixed(3);
        element.style.transform = `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${(0.9 + 0.12 * nearness).toFixed(3)})`;
        element.style.zIndex = nearness > 0.5 ? "2" : "1";
      });
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
    };
  }, [onUnsupported]);

  if (unsupported) return null;

  return (
    <div
      ref={containerRef}
      className={cn("relative aspect-square w-full select-none", className)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab touch-pan-y [mask-image:radial-gradient(circle_closest-side,#000_78%,transparent_100%)] active:cursor-grabbing"
        aria-label="Strength shape"
        role="img"
      />
      {HEXAGON_AXES.map((axis, index) => {
        const value = values[index];
        return (
          <div
            key={axis.key}
            ref={(element) => {
              labelRefs.current[index] = element;
            }}
            className="pointer-events-none absolute top-0 left-0 flex flex-col items-center text-center leading-none whitespace-nowrap will-change-transform"
            style={{ opacity: 0 }}
          >
            <span className="text-muted-foreground text-xs sm:text-sm">
              {axis.label}
            </span>
            <span
              className={cn(
                "mt-1 font-semibold tabular-nums",
                value == null
                  ? "text-muted-foreground text-sm sm:text-base"
                  : "text-foreground text-xl sm:text-2xl",
              )}
              style={{
                textShadow:
                  value != null && colors.isDark
                    ? `0 0 14px ${colors.css.core}`
                    : "none",
              }}
            >
              {formatAxisValue(value, axis)}
            </span>
          </div>
        );
      })}
    </div>
  );
});
