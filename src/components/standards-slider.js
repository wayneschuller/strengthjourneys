import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  useAthleteBio,
  getTopLiftStats,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useSession } from "next-auth/react";
import { devLog, getReadableDateString } from "@/lib/processing-utils";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useReadLocalStorage, useWindowSize } from "usehooks-ts";

export function StandardsSlider({
  liftType,
  isYearly = false,
  isMetric,
  standards,
  extraNotches = [],
}) {
  const {
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const { age, bodyWeight, sex } = useAthleteBio();
  const { width } = useWindowSize({ initializeWithValue: false });
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, { initializeWithValue: false }) ?? "Brzycki";

  if (!standards) return null;
  const originalData = standards[liftType];
  if (!originalData) return null;
  const liftTypeStandards = readableLabels(originalData);

  const unitType = isMetric ? "kg" : "lb";

  // Get all standard values for scale
  const standardValues = Object.values(originalData);
  const minLift = Math.min(...standardValues); // Usually 'physicallyActive'
  const eliteMax = originalData.elite; // Elite standard value

  // Use shared hook helper for top-lift stats (authenticated users only)
  let athleteRankingWeight = 0;
  let highestE1RM = 0;
  let strengthRating = null;
  let bestWeightTuple = null;
  let bestE1RMTuple = null;
  if (authStatus === "authenticated") {
    const topLifts = isYearly
      ? topLiftsByTypeAndRepsLast12Months?.[liftType]
      : topLiftsByTypeAndReps?.[liftType];
    const bioForDateRating =
      age && bodyWeight != null && sex != null
        ? { age, bodyWeight, sex, isMetric }
        : null;
    const stats = getTopLiftStats(
      topLifts,
      liftType,
      standards,
      e1rmFormula,
      bioForDateRating,
    );
    athleteRankingWeight = stats.bestWeight;
    highestE1RM = stats.bestE1RM;
    strengthRating = stats.strengthRating;
    bestWeightTuple = stats.bestWeightTuple;
    bestE1RMTuple = stats.bestE1RMTuple;
  }

  // Extend max beyond Elite when user's record exceeds it (so E1RM/thumb stay on bar)
  const userMax = Math.max(highestE1RM || 0, athleteRankingWeight || 0);
  const maxLift =
    userMax > eliteMax
      ? Math.ceil(userMax * 1.05) // Slightly beyond user's record
      : eliteMax;

  // Helper to calculate proportional % from minLift to maxLift
  const getPercent = (val) =>
    maxLift === minLift ? 0 : ((val - minLift) / (maxLift - minLift)) * 100;

  // Proportional thumb position
  const thumbPosition = getPercent(athleteRankingWeight);

  // Level label data
  const levelLabels = Object.keys(liftTypeStandards);

  return (
    <div className="mx-auto w-full">
      {/* Lift level labels */}
      <div className="relative mb-2 h-14 w-full">
        {levelLabels.map((level, index) => {
          // Only show 1st, 3rd, last on mobile
          if (
            width < 800 &&
            index !== 0 &&
            index !== 2 &&
            index !== levelLabels.length - 1
          )
            return null;
          const value = liftTypeStandards[level];
          const left = getPercent(value);

          // Alignment rules
          let labelStyle, labelClass;
          if (index === 0) {
            // First (flush left)
            labelStyle = { left: "0%" };
            labelClass = "absolute flex flex-col items-start text-left";
          } else if (index === levelLabels.length - 1 && maxLift === eliteMax) {
            // Last (flush right) - only when scale ends at Elite
            labelStyle = { left: "100%", transform: "translateX(-100%)" };
            labelClass = "absolute flex flex-col items-end text-right";
          } else {
            // Centered for others, or last when scale extends beyond Elite
            labelStyle = { left: `${left}%`, transform: "translateX(-50%)" };
            labelClass = "absolute flex flex-col items-center";
          }

          return (
            <span key={level} className={labelClass} style={labelStyle}>
              <div className="md:text-base">{level}</div>
              <div className="font-bold md:text-lg lg:text-xl">
                {liftTypeStandards[level]}
                {unitType}
              </div>
            </span>
          );
        })}
        {/* <div className="block md:hidden">Rating: </div> */}
      </div>
      <div className="relative w-full">
        {/* Slider bar background */}
        <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-yellow-500 via-green-300 to-green-800" />
        {/* Lifetime 1RM and E1RM notches */}
        <TooltipProvider>
          {athleteRankingWeight > 0 && (
            <Tooltip>
              <div
                className="group absolute top-0 z-20 h-full w-6 -translate-x-1/2"
                style={{ left: `${thumbPosition}%` }}
              >
                <TooltipTrigger asChild>
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium shadow bg-background/80 text-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                    1RM
                  </span>
                </TooltipTrigger>
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex">
                  <div className="w-[3px] bg-foreground/70 group-hover:bg-primary group-hover:bg-opacity-90" />
                  <div className="w-px bg-background/90 opacity-90" />
                </div>
              </div>
              <TooltipContent side="bottom" sideOffset={6} className="max-w-xs text-xs">
                {bestWeightTuple ? (
                  <div className="space-y-0.5">
                    <div className="font-semibold">Best single</div>
                    <div>
                      {bestWeightTuple.reps} rep{bestWeightTuple.reps > 1 ? "s" : ""} × {bestWeightTuple.weight}
                      {unitType}
                    </div>
                    {bestWeightTuple.date && (
                      <div className="text-muted-foreground">
                        {getReadableDateString(bestWeightTuple.date)}
                      </div>
                    )}
                  </div>
                ) : (
                  <span>Best single: {athleteRankingWeight}{unitType}</span>
                )}
              </TooltipContent>
            </Tooltip>
          )}
          {authStatus === "authenticated" &&
            highestE1RM > 0 &&
            highestE1RM > athleteRankingWeight && (
              <Tooltip>
                <div
                  className="group absolute top-0 z-30 h-full w-6 -translate-x-1/2"
                  style={{ left: `${getPercent(highestE1RM)}%` }}
                >
                  <TooltipTrigger asChild>
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium shadow bg-background/80 text-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                      E1RM
                    </span>
                  </TooltipTrigger>
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex">
                    <div className="w-[3px] bg-foreground/70 group-hover:bg-primary group-hover:bg-opacity-90" />
                    <div className="w-px bg-background/90 opacity-90" />
                  </div>
                </div>
                <TooltipContent side="bottom" sideOffset={6} className="max-w-xs text-xs">
                  {bestE1RMTuple ? (
                    <div className="space-y-0.5">
                      <div className="font-semibold">Estimated 1RM</div>
                      <div>
                        {bestE1RMTuple.reps}×{bestE1RMTuple.weight}
                        {unitType} → ~{Math.round(bestE1RMTuple.e1rm)}{unitType}
                      </div>
                      {bestE1RMTuple.date && (
                        <div className="text-muted-foreground">
                          {getReadableDateString(bestE1RMTuple.date)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span>E1RM: ~{Math.round(highestE1RM)}{unitType}</span>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
          {/* Extra notches (e.g. recent best E1RMs) */}
          {Array.isArray(extraNotches) &&
            extraNotches.map((notch) => {
              if (!notch || typeof notch.e1rm !== "number") return null;
              const left = getPercent(notch.e1rm);
              const notchUnit = notch.unitType || unitType;

              // Short label for the bar (1M / 6M / 12M), fallback to provided label
              const shortLabel =
                notch.periodKey === "1M"
                  ? "1M"
                  : notch.periodKey === "6M"
                  ? "6M"
                  : notch.periodKey === "12M"
                    ? "1Y"
                    : notch.label;

              return (
                <Tooltip key={notch.periodKey || notch.label || left}>
                  <div
                    className="group absolute top-0 z-10 h-full w-6 -translate-x-1/2"
                    style={{ left: `${left}%` }}
                  >
                    <TooltipTrigger asChild>
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium shadow bg-background/80 text-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                        {shortLabel}
                      </span>
                    </TooltipTrigger>
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 flex">
                      <div className="w-[3px] bg-foreground/70 group-hover:bg-primary group-hover:bg-opacity-90" />
                      <div className="w-px bg-background/90 opacity-90" />
                    </div>
                  </div>
                  <TooltipContent side="bottom" sideOffset={6} className="max-w-xs text-xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold">{notch.label}</div>
                      <div>
                        ~{Math.round(notch.e1rm)}
                        {notchUnit} estimated 1RM
                        {bodyWeight > 0 && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({(notch.e1rm / bodyWeight).toFixed(2)}xBW)
                          </span>
                        )}
                      </div>
                      {typeof notch.reps === "number" &&
                        typeof notch.weight === "number" && (
                          <div className="text-muted-foreground">
                            Set: {notch.reps}×{notch.weight}
                            {notchUnit}
                          </div>
                        )}
                      {notch.date && (
                        <div className="text-muted-foreground">
                          {getReadableDateString(notch.date)}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
        </TooltipProvider>
      </div>
      {authStatus === "authenticated" && strengthRating && (
        <div className="mt-2 text-sm font-medium text-muted-foreground">
          {liftType} strength level:{" "}
          {strengthRating === "Elite" && userMax > eliteMax ? (
            <>
              {STRENGTH_LEVEL_EMOJI.Elite} Beyond Elite
            </>
          ) : (
            <>
              {STRENGTH_LEVEL_EMOJI[strengthRating] ?? ""} {strengthRating}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to convert the object member names to more readable English labels
const readableLabels = (data) => {
  const labelMap = {
    physicallyActive: "Physically Active",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    elite: "Elite",
  };

  const newData = {};

  for (const [key, value] of Object.entries(data)) {
    const newKey = labelMap[key] || key; // Fallback to original key if not in labelMap
    newData[newKey] = value;
  }

  return newData;
};
