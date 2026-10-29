// The WebGL strength hexagon: a shader canvas with HTML labels riding on top.
//
// Everything that moves is driven from one requestAnimationFrame loop held in
// refs, never React state, so a spinning hexagon costs no re-renders. The loop
// springs each vertex toward its target (the shape blooms out from the centre
// on arrival and wobbles a little when a value changes), orbits the camera,
// and moves each label to where its vertex projects through that same camera.
// Drag spins it by hand and lets go with inertia. Reduced motion holds the
// camera still and snaps the shape into place.

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
import {
  CRYSTAL_FRAGMENT,
  HOLOGRAM_FRAGMENT,
} from "@/components/strength-hexagon/hexagon-shaders";
import { cn } from "@/lib/utils";

const VARIANTS = {
  hologram: {
    fragment: HOLOGRAM_FRAGMENT,
    camera: { pitch: 0.82, distance: 2.45, targetY: 0.14 },
    labelRadius: 1.24,
    labelHeight: ({ prismHeight }) => prismHeight + 0.04,
    spinSpeed: 0.14,
    maxDpr: 2,
  },
  crystal: {
    fragment: CRYSTAL_FRAGMENT,
    camera: { pitch: 0.62, distance: 2.6, targetY: 0.42 },
    labelRadius: 1.3,
    labelHeight: ({ gemY }) => gemY,
    spinSpeed: 0.18,
    maxDpr: 1.75,
  },
};

const SPRING_STIFFNESS = 70;
const SPRING_DAMPING = 11;

export const StrengthHexagonWebGL = forwardRef(function StrengthHexagonWebGL(
  { variant = "hologram", values, palette, className, onUnsupported },
  ref,
) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const labelRefs = useRef([]);
  const valuesRef = useRef(values);
  const paletteRef = useRef(palette);
  const lastFrameRef = useRef({ camera: null, width: 0, height: 0 });
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    valuesRef.current = values;
    paletteRef.current = palette;
  }, [values, palette]);

  useImperativeHandle(ref, () => ({
    // Snapshot for the story card: the canvas plus each label as drawn now.
    capture() {
      const { width, height } = lastFrameRef.current;
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
    const config = VARIANTS[variant] ?? VARIANTS.hologram;
    const renderer = createHexagonRenderer(canvas, config.fragment);
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
      yaw: -0.35,
      spinVelocity: 0,
      dragging: false,
      lastX: 0,
      lastMoveTime: 0,
      visible: true,
    };

    let width = 0;
    let height = 0;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, config.maxDpr);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
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
      motion.yaw -= delta;
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

      if (!motion.dragging) {
        const idleSpin = reduceMotion ? 0 : config.spinSpeed;
        motion.yaw += (idleSpin + motion.spinVelocity) * dt;
        motion.spinVelocity *= Math.exp(-dt * 1.6);
      }

      const camera = getCamera({ yaw: motion.yaw, ...config.camera });
      const verts = radii.flatMap((radius, index) =>
        axisPoint(index, Math.max(radius, 0.01)),
      );
      const tested = valuesRef.current.map((value) => (value == null ? 0 : 1));
      const vals = valuesRef.current.map((value) => (value ?? 0) / 100);
      const average =
        vals.reduce((sum, value) => sum + value, 0) / Math.max(1, vals.length);
      const gemHalf = 0.24 + 0.12 * average;
      const gemY = 0.12 + gemHalf * 1.55 + 0.03 * Math.sin(time * 0.9);
      const prismHeight = 0.16 + 0.22 * average;
      const { core, edge, accent, bg } = paletteRef.current;

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
        uCore: core,
        uEdge: edge,
        uAccent: accent,
        uBg: bg,
        uHeight: prismHeight,
        uSweep: reduceMotion ? 0 : 1,
        uGemY: gemY,
        uGemHalf: gemHalf,
      });

      lastFrameRef.current = { camera, width, height };
      const labelY = config.labelHeight({ gemY, prismHeight });
      HEXAGON_AXES.forEach((axis, index) => {
        const element = labelRefs.current[index];
        if (!element) return;
        const [x, z] = axisPoint(index, config.labelRadius);
        const projected = projectPoint([x, labelY, z], camera, width, height);
        if (!projected) return;
        // Labels on the far side recede, the near ones come forward.
        const nearness = Math.min(
          1,
          Math.max(0, (config.camera.distance + 0.6 - projected.depth) / 1.2),
        );
        const opacity = 0.45 + 0.55 * nearness;
        // Keep labels inside the frame even when a vertex swings to the edge.
        projected.x = Math.min(width - 40, Math.max(40, projected.x));
        projected.y = Math.min(height - 22, Math.max(22, projected.y));
        element.dataset.x = projected.x.toFixed(1);
        element.dataset.y = projected.y.toFixed(1);
        element.style.opacity = opacity.toFixed(3);
        element.style.transform = `translate(-50%, -50%) translate(${projected.x}px, ${projected.y}px) scale(${(0.86 + 0.18 * nearness).toFixed(3)})`;
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
  }, [variant, onUnsupported]);

  if (unsupported) return null;

  const css = palette.css;
  return (
    <div
      ref={containerRef}
      className={cn("relative aspect-square w-full select-none", className)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab touch-pan-y active:cursor-grabbing"
        aria-label="Strength hexagon"
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
            <span
              className="text-[11px] tracking-wide text-white/70 sm:text-xs"
              style={{ fontFamily: "'IBM Plex Sans Condensed', sans-serif" }}
            >
              {axis.label}
            </span>
            <span
              className={cn(
                "mt-0.5 text-lg font-semibold sm:text-xl",
                value == null ? "text-white/45" : "text-white",
              )}
              style={{
                fontFamily: "'Fraunces Variable', Georgia, serif",
                textShadow:
                  value == null
                    ? "none"
                    : `0 0 12px ${css.core}, 0 0 28px ${css.core}66`,
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
