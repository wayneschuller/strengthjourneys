import { Fragment } from "react";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  useAthleteBio,
  getTopLiftStats,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useSession } from "next-auth/react";
import { devLog, getReadableDateString } from "@/lib/processing-utils";
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

  // --- Build unified notch array & cluster nearby labels ---
  const allNotches = [];

  if (athleteRankingWeight > 0) {
    allNotches.push({
      key: "1RM",
      percent: thumbPosition,
      shortLabel: "1RM",
      zIndex: 20,
      tooltipContent: bestWeightTuple ? (
        <div className="space-y-0.5">
          <div className="font-semibold">
            Lifetime best: {bestWeightTuple.weight}{unitType}
          </div>
          <div className="text-muted-foreground">
            {bestWeightTuple.reps} × {bestWeightTuple.weight}{unitType}
            {bestWeightTuple.date && <> · {getReadableDateString(bestWeightTuple.date)}</>}
          </div>
        </div>
      ) : (
        <span>Lifetime best: {athleteRankingWeight}{unitType}</span>
      ),
    });
  }

  if (authStatus === "authenticated" && highestE1RM > 0 && highestE1RM > athleteRankingWeight) {
    allNotches.push({
      key: "E1RM",
      percent: getPercent(highestE1RM),
      shortLabel: "E1RM",
      zIndex: 30,
      tooltipContent: bestE1RMTuple ? (
        <div className="space-y-0.5">
          <div className="font-semibold">
            Lifetime best E1RM: ~{Math.round(bestE1RMTuple.e1rm)}{unitType}
          </div>
          <div className="text-muted-foreground">
            {bestE1RMTuple.reps} × {bestE1RMTuple.weight}{unitType}
            {bestE1RMTuple.date && <> · {getReadableDateString(bestE1RMTuple.date)}</>}
          </div>
        </div>
      ) : (
        <span>Lifetime best E1RM: ~{Math.round(highestE1RM)}{unitType}</span>
      ),
    });
  }

  if (Array.isArray(extraNotches)) {
    for (const notch of extraNotches) {
      if (!notch || typeof notch.e1rm !== "number") continue;
      const notchUnit = notch.unitType || unitType;
      const shortLabel =
        notch.periodKey === "1M"
          ? "1M"
          : notch.periodKey === "6M"
            ? "6M"
            : notch.periodKey === "12M"
              ? "1Y"
              : notch.label;
      allNotches.push({
        key: notch.periodKey || notch.label || `extra-${getPercent(notch.e1rm)}`,
        percent: getPercent(notch.e1rm),
        shortLabel,
        zIndex: 10,
        tooltipContent: (
          <div className="space-y-0.5">
            <div className="font-semibold">
              {notch.label} E1RM: ~{Math.round(notch.e1rm)}{notchUnit}
              {bodyWeight > 0 && (
                <span className="font-normal text-muted-foreground">
                  {" "}({(notch.e1rm / bodyWeight).toFixed(2)}×BW)
                </span>
              )}
            </div>
            <div className="text-muted-foreground">
              {typeof notch.reps === "number" && typeof notch.weight === "number" && (
                <>{notch.reps} × {notch.weight}{notchUnit}</>
              )}
              {typeof notch.reps === "number" && typeof notch.weight === "number" && notch.date && " · "}
              {notch.date && getReadableDateString(notch.date)}
            </div>
          </div>
        ),
      });
    }
  }

  // Sort by percent position and group nearby notches into clusters
  allNotches.sort((a, b) => a.percent - b.percent);
  const MERGE_THRESHOLD = 4; // percent
  const notchClusters = [];
  for (const notch of allNotches) {
    const last = notchClusters[notchClusters.length - 1];
    if (last && Math.abs(notch.percent - last[last.length - 1].percent) <= MERGE_THRESHOLD) {
      last.push(notch);
    } else {
      notchClusters.push([notch]);
    }
  }

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
          {notchClusters.map((cluster) => {
            const maxZ = Math.max(...cluster.map((n) => n.zIndex));
            const centerPercent =
              cluster.reduce((sum, n) => sum + n.percent, 0) / cluster.length;
            const mergedLabel = cluster.map((n) => n.shortLabel).join(" · ");
            const clusterKey = cluster.map((n) => n.key).join("-");
            const isMerged = cluster.length > 1;

            return (
              <Fragment key={clusterKey}>
                {/* For merged clusters, render individual lines outside the group */}
                {isMerged &&
                  cluster.map((notch) => (
                    <div
                      key={`line-${notch.key}`}
                      className="absolute top-0 h-full"
                      style={{ left: `${notch.percent}%`, zIndex: notch.zIndex }}
                    >
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2">
                        <div className="h-full w-px bg-foreground ring-1 ring-background/70" />
                      </div>
                    </div>
                  ))}
                <Tooltip>
                  <div
                    className="group absolute top-0 h-full w-6 -translate-x-1/2"
                    style={{ left: `${centerPercent}%`, zIndex: maxZ }}
                  >
                    <TooltipTrigger asChild>
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium shadow bg-background/80 text-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                        {mergedLabel}
                      </span>
                    </TooltipTrigger>
                    {/* For single notch, render line inside group for hover effect */}
                    {!isMerged && (
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2">
                        <div className="h-full w-px bg-foreground ring-1 ring-background/70 group-hover:bg-primary group-hover:ring-primary/30" />
                      </div>
                    )}
                  </div>
                  <TooltipContent side="bottom" sideOffset={6} className="max-w-xs text-xs">
                    {cluster.length === 1 ? (
                      cluster[0].tooltipContent
                    ) : (
                      <div className="space-y-2">
                        {cluster.map((notch) => (
                          <div key={notch.key}>{notch.tooltipContent}</div>
                        ))}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </Fragment>
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
