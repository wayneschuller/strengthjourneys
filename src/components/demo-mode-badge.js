import { useEffect } from "react";
import {
  motion,
  useAnimationControls,
  useReducedMotion,
} from "motion/react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_STYLES = {
  sm: {
    badge: "h-6 gap-1.5 rounded-md px-2 text-[11px]",
    icon: "h-3 w-3",
  },
  md: {
    badge: "h-7 gap-1.5 rounded-md px-2.5 text-xs",
    icon: "h-3.5 w-3.5",
  },
};

export function DemoModeBadge({
  className,
  size = "md",
  animated = true,
}) {
  const controls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();
  const styles = SIZE_STYLES[size] || SIZE_STYLES.md;

  useEffect(() => {
    if (!animated || prefersReducedMotion) return;

    let timeoutId;

    function scheduleNudge() {
      const delay = 18000 + Math.random() * 24000;
      timeoutId = window.setTimeout(() => {
        controls.start({
          scale: [1, 1.06, 0.98, 1.02, 1],
          rotate: [0, -3, 3, -1.5, 0],
          transition: { duration: 0.45, ease: "easeInOut" },
        });
        scheduleNudge();
      }, delay);
    }

    scheduleNudge();

    return () => window.clearTimeout(timeoutId);
  }, [animated, controls, prefersReducedMotion]);

  return (
    <motion.span
      animate={controls}
      className={cn(
        "relative inline-flex shrink-0 items-center overflow-hidden border border-amber-300/80 bg-amber-100 font-semibold uppercase tracking-[0.08em] text-amber-950 shadow-sm dark:border-amber-700/70 dark:bg-amber-950/70 dark:text-amber-200",
        styles.badge,
        className,
      )}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[-35%] w-[35%] bg-gradient-to-r from-transparent via-white/45 to-transparent dark:via-amber-100/15"
        animate={
          animated && !prefersReducedMotion
            ? { x: ["0%", "320%"] }
            : { x: "0%" }
        }
        transition={
          animated && !prefersReducedMotion
            ? {
                duration: 1.1,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 11,
              }
            : undefined
        }
      />
      <FlaskConical className={styles.icon} />
      <span className="relative z-10">Demo Mode</span>
    </motion.span>
  );
}
