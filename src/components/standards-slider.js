import { useAthleteBioData } from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useSession } from "next-auth/react";
import { devLog } from "@/lib/processing-utils";
import { cn } from "@/lib/utils";
import { useReadLocalStorage, useWindowSize } from "usehooks-ts";
import { estimateE1RM } from "@/lib/estimate-e1rm";

export function StandardsSlider({
  liftType,
  isYearly = false,
  isMetric,
  standards,
}) {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const { width } = useWindowSize({ initializeWithValue: false });
  const e1rmFormula =
    useReadLocalStorage("formula", { initializeWithValue: false }) ?? "Brzycki";

  if (!standards) return null;
  const originalData = standards[liftType];
  if (!originalData) return null;
  const liftTypeStandards = readableLabels(originalData);
  // devLog(liftTypeStandards);
  // devLog(standards[`Back Squat`].beginner);

  // devLog(topLiftsByTypeAndReps);

  const unitType = isMetric ? "kg" : "lb";

  // Get all standard values for scale
  const standardValues = Object.values(originalData);
  const minLift = Math.min(...standardValues); // Usually 'physicallyActive'
  const maxLift = originalData.elite; // Max value of slider

  // If we have data find their records
  let athleteRankingWeight = 0;
  let highestE1RM = 0;

  if (authStatus === "authenticated") {
    let topLifts = topLiftsByTypeAndReps?.[liftType];
    if (isYearly) {
      topLifts = topLiftsByTypeAndRepsLast12Months?.[liftType];
    }

    if (Array.isArray(topLifts)) {
      for (let repsIdx = 0; repsIdx < topLifts.length; repsIdx++) {
        const topSet = topLifts[repsIdx]?.[0]; // the best lift for this rep count
        if (!topSet) continue;

        const reps = repsIdx + 1;
        const weight = topSet.weight || 0;

        if (weight > athleteRankingWeight) athleteRankingWeight = weight;

        const e1rm = estimateE1RM(reps, weight, e1rmFormula);
        if (e1rm > highestE1RM) highestE1RM = e1rm;
      }
    }
  }

  // devLog( `${liftType} Best: ${athleteRankingWeight}, best e1rm: ${highestE1RM}`);

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
          } else if (index === levelLabels.length - 1) {
            // Last (flush right)
            labelStyle = { left: "100%", transform: "translateX(-100%)" };
            labelClass = "absolute flex flex-col items-end text-right";
          } else {
            // Centered for others
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
        {/* Proportional thumb */}
        <div
          className="absolute -top-1 bg-primary transition-all duration-1000 ease-in"
          style={{ left: `${thumbPosition}%`, transform: "translateX(-50%)" }}
        >
          <div className="h-4 w-4 rotate-45"></div>
          {athleteRankingWeight > 0 && (
            <span
              className="absolute left-1/2 top-5 w-max font-bold"
              style={{ transform: "translateX(-50%)" }}
            >
              {athleteRankingWeight}
              {unitType}
            </span>
          )}
        </div>
        {authStatus === "authenticated" &&
          highestE1RM > 0 &&
          highestE1RM > athleteRankingWeight && (
            <div
              className="pointer-events-none absolute top-0 z-30 h-full border-l-4 border-gray-400 opacity-50 dark:border-gray-200"
              style={{
                left: `${getPercent(highestE1RM)}%`,
                transform: "translateX(-1px)",
              }}
            >
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-1 text-xs text-muted shadow dark:bg-white dark:text-gray-500">
                E1RM
              </span>
            </div>
          )}
      </div>
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
