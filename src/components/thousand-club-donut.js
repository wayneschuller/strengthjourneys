/**
 * Shared 1000lb club progress donut.
 * Keeps the lb-primary visual used by the calculator page reusable anywhere
 * we want to show squat + bench + deadlift total progress toward 1000lb.
 */
import { useId } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

export function ThousandDonut({
  total,
  target = 1000,
  containerRef,
  isAdjusting = false,
  prefersReducedMotion = false,
  className,
  compact = false,
  href,
}) {
  const gradientId = `thousand-donut-progress-${useId().replace(/:/g, "")}`;
  const capped = Math.min(total, target);
  const remainder = Math.max(0, target - total);
  const data = [
    { name: "Progress", value: capped },
    { name: "Remainder", value: remainder },
  ];
  const percent = Math.min(100, Math.round((total / target) * 100));
  const inClub = total >= target;

  const progressGradient = inClub
    ? { start: "#34D399", end: "#059669" }
    : { start: "#FBBF24", end: "#D97706" };
  const remainderColor = "#1F2937";

  const content = (
    <motion.div
      ref={containerRef}
      className={cn(
        "relative mx-auto my-6 h-[220px] w-full max-w-md xl:h-[320px] xl:max-w-lg",
        className,
      )}
      animate={
        prefersReducedMotion
          ? undefined
          : isAdjusting
            ? {
                scale: 1.03,
                rotate: 0.6,
                filter: "drop-shadow(0 10px 18px rgba(16,185,129,0.24))",
              }
            : {
                scale: 1,
                rotate: 0,
                filter: "drop-shadow(0 0px 0px rgba(0,0,0,0))",
              }
      }
      whileHover={
        prefersReducedMotion
          ? undefined
          : {
              scale: 1.04,
              rotate: -0.6,
              filter: "drop-shadow(0 12px 20px rgba(16,185,129,0.26))",
            }
      }
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 18,
        mass: 0.7,
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={progressGradient.start} />
              <stop offset="100%" stopColor={progressGradient.end} />
            </linearGradient>
          </defs>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="62%"
            outerRadius="90%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={!prefersReducedMotion && !isAdjusting}
            animationDuration={220}
            animationEasing="ease-out"
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === 0 ? `url(#${gradientId})` : remainderColor}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          className="text-center tabular-nums"
          animate={
            prefersReducedMotion
              ? undefined
              : isAdjusting
                ? { scale: 1.06 }
                : { scale: 1 }
          }
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
            mass: 0.6,
          }}
        >
          {inClub ? (
            <>
              <div
                className={cn(
                  "font-bold text-green-500",
                  compact ? "text-[1.45rem] leading-none" : "text-3xl xl:text-4xl",
                )}
              >
                {total}
                <span className={cn(compact ? "ml-1 text-base" : "ml-1 text-[0.75em]")}>
                  lbs
                </span>
              </div>
              <div
                className={cn(
                  "font-semibold text-green-400",
                  compact ? "mt-1 text-[10px] leading-tight" : "text-sm xl:text-base",
                )}
              >
                1000lb Club!
              </div>
            </>
          ) : (
            <>
              <div
                className={cn(
                  "font-bold leading-none",
                  compact ? "text-[1.45rem]" : "text-2xl xl:text-4xl",
                )}
              >
                {total}
                <span className={cn(compact ? "ml-1 text-base" : "ml-1 text-[0.75em]")}>
                  lbs
                </span>
              </div>
              <div
                className={cn(
                  "text-muted-foreground",
                  compact ? "mt-1 text-[10px] leading-tight" : "text-xs xl:text-sm",
                )}
              >
                of {target}
              </div>
              <div
                className={cn(
                  "text-muted-foreground",
                  compact ? "mt-1 text-sm font-medium leading-none" : "text-sm xl:text-lg",
                )}
              >
                {percent}%
              </div>
            </>
          )}
        </motion.div>
      </div>
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block" aria-label="Open the 1000lb Club calculator">
        {content}
      </Link>
    );
  }

  return content;
}
