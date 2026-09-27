/** @format */
// Strength-level bar: shows where a lifter's E1RM sits on the
// physically-active → elite spectrum for a given lift, with tier dividers,
// a tooltip showing the next tier, and a link to the per-lift strength page.
//
// Reusable wherever a lift's current E1RM is visible (log page, analyzer,
// progress-guide, future AI coaching).

import Link from "next/link";
import {
  getStrengthRatingForE1RM,
  STRENGTH_LEVEL_EMOJI,
  getStandardForLiftDate,
} from "@/hooks/use-athlete-biodata";
import { NEXT_TIER } from "@/lib/celebration";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

const LIFT_STRENGTH_SLUGS = {
  "Back Squat": "squat",
  "Bench Press": "bench-press",
  Deadlift: "deadlift",
  "Strict Press": "strict-press",
};

export function StrengthBar({
  liftType,
  e1rmValue,
  standards,
  age,
  sessionDate,
  bodyWeight,
  sex,
  isMetric,
}) {
  const standard =
    sessionDate && age && bodyWeight != null && sex != null
      ? getStandardForLiftDate(
          age,
          sessionDate,
          bodyWeight,
          sex,
          liftType,
          isMetric ?? false,
        )
      : standards?.[liftType];

  if (!standard?.elite || !e1rmValue) return null;

  const rating = getStrengthRatingForE1RM(e1rmValue, standard);
  if (!rating) return null;

  const emoji = STRENGTH_LEVEL_EMOJI[rating] ?? "";
  const { physicallyActive, elite } = standard;
  const range = elite - physicallyActive;
  const pct =
    range > 0
      ? Math.min(
          98,
          Math.max(2, ((e1rmValue - physicallyActive) / range) * 100),
        )
      : 50;

  const nextTierInfo = NEXT_TIER[rating];
  const nextTierValue = nextTierInfo ? standard[nextTierInfo.key] : null;
  const diff = nextTierValue ? Math.ceil(nextTierValue - e1rmValue) : null;
  const unit = isMetric ? "kg" : "lb";

  // Tier divider positions
  const tiers = [standard.beginner, standard.intermediate, standard.advanced]
    .map((val) => ((val - physicallyActive) / range) * 100)
    .filter((p) => p > 0 && p < 100);

  const strengthHref = LIFT_STRENGTH_SLUGS[liftType]
    ? `/strength-levels/${LIFT_STRENGTH_SLUGS[liftType]}`
    : "/strength-levels";

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Link
          href={strengthHref}
          className="text-muted-foreground hover:text-foreground shrink-0 text-[10px] font-medium transition-colors"
        >
          {emoji} {rating}
        </Link>
        <div className="relative flex-1">
          <div
            className="h-2 w-full rounded-full"
            style={{
              background:
                "linear-gradient(to right, #EAB308, #86EFAC, #166534)",
            }}
          />
          {tiers.map((p, i) => (
            <div
              key={i}
              className="absolute top-0 h-2 w-px"
              style={{
                left: `${p}%`,
                backgroundColor: "var(--background)",
                opacity: 0.7,
              }}
            />
          ))}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="bg-foreground ring-background absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm ring-1 transition-[left] duration-300"
                style={{ left: `${pct}%` }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-semibold">{liftType}</p>
              <p>
                {emoji} {rating} · E1RM {Math.round(e1rmValue)}
                {unit}
              </p>
              {nextTierInfo && diff > 0 ? (
                <p className="text-muted-foreground">
                  {STRENGTH_LEVEL_EMOJI[nextTierInfo.name] ?? ""}{" "}
                  {nextTierInfo.name} — {diff}
                  {unit} away
                </p>
              ) : nextTierInfo && diff <= 0 ? (
                <p className="text-muted-foreground">
                  {STRENGTH_LEVEL_EMOJI[nextTierInfo.name] ?? ""}{" "}
                  {nextTierInfo.name} — you&apos;re there!
                </p>
              ) : (
                <p className="text-muted-foreground">Top of the chart!</p>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
