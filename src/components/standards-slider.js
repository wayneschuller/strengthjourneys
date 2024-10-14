import { useAthleteBioData } from "@/lib/use-athlete-biodata";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useSession } from "next-auth/react";
import { devLog } from "@/lib/processing-utils";
import { cn } from "@/lib/utils";
import * as SliderPrimitive from "@radix-ui/react-slider";

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

  if (!standards) return null;
  const originalData = standards[liftType];
  if (!originalData) return null;
  const liftTypeStandards = convertLabels(originalData);
  // devLog(liftTypeStandards);
  // devLog(standards[`Back Squat`].beginner);

  // devLog(topLiftsByTypeAndReps);

  const unitType = isMetric ? "kg" : "lb";
  const maxLift = originalData.elite; // Max value of slider

  let athleteRankingWeight = 0;
  if (authStatus === "authenticated") {
    if (isYearly) {
      athleteRankingWeight =
        topLiftsByTypeAndRepsLast12Months?.[liftType]?.[0]?.[0]?.weight;
    } else {
      athleteRankingWeight =
        topLiftsByTypeAndReps?.[liftType]?.[0]?.[0]?.weight;
    }
  }
  // devLog(best);

  // Calculate the left percentage based on current weight relative to maxLift
  const thumbPosition = (athleteRankingWeight / maxLift) * 100;

  // Convert object keys to an array for rendering labels
  const levelLabels = Object.keys(liftTypeStandards);

  return (
    <div className="mx-auto w-full">
      {/* Lift level labels */}
      <div className="mb-2 flex justify-between text-sm">
        {levelLabels.map((level, index) => (
          <span
            key={level}
            className={cn(index % 2 !== 0 ? "hidden sm:block" : "block")}
          >
            <div className="md:text-base">{level}</div>
            <div className="font-bold md:text-lg lg:text-xl">
              {liftTypeStandards[level]}
              {unitType}
            </div>
          </span>
        ))}
        {/* <div className="block md:hidden">Rating: </div> */}
      </div>
      <div className="relative w-full">
        <SliderPrimitive.Root
          value={[athleteRankingWeight]}
          max={maxLift}
          disabled // Make it non-interactive
          className="relative flex w-full touch-none select-none items-center pb-10"
        >
          {/* Static gradient background */}
          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gradient-to-r from-yellow-500 via-green-300 to-green-800">
            <SliderPrimitive.Range className="absolute h-full opacity-0" />{" "}
          </SliderPrimitive.Track>
        </SliderPrimitive.Root>

        {/* We use a custom thumb so we can animate it. */}
        <div
          className="absolute -top-1 bg-primary transition-all duration-1000 ease-in"
          style={{ left: `${thumbPosition}%` }} // Positioning based on percentage
        >
          <div className="h-4 w-4 rotate-45"></div>
          {/* PR value displayed below thumb */}
          {athleteRankingWeight > 0 && (
            <span className="absolute -left-2 top-5 w-max font-bold">
              {athleteRankingWeight}
              {unitType}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to convert the object member names to more readable English labels
const convertLabels = (data) => {
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
