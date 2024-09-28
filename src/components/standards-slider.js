import { useAthleteBioData } from "@/lib/use-athlete-biodata";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useSession } from "next-auth/react";
import { devLog } from "@/lib/processing-utils";
import { cn } from "@/lib/utils";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { useAutoAnimate } from "@formkit/auto-animate/react";

export function StandardsSlider({ liftType, isYearly = false }) {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  const {
    age,
    setAge,
    isMetric,
    setIsMetric,
    sex,
    setSex,
    bodyWeight,
    setBodyWeight,
    standards,
    toggleIsMetric,
  } = useAthleteBioData();
  const [parent] = useAutoAnimate();

  if (!standards) return null;
  const originalData = standards[liftType];
  if (!originalData) return null;
  const liftTypeStandards = convertLabels(originalData);
  // devLog(liftTypeStandards);

  const unitType = isMetric ? "kg" : "lb";
  const maxLift = originalData.elite; // Max value of slider

  let best = 0;
  if (topLiftsByTypeAndReps && authStatus === "authenticated") {
    if (isYearly) {
      best = topLiftsByTypeAndRepsLast12Months[liftType][0][0].weight;
    } else {
      best = topLiftsByTypeAndReps[liftType][0][0].weight;
    }
  }
  // devLog(best);

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
          value={[best]}
          max={maxLift}
          disabled // Make it non-interactive
          className="relative flex w-full touch-none select-none items-center pb-10"
        >
          {/* Static gradient background */}
          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gradient-to-r from-yellow-500 via-green-300 to-green-800">
            <SliderPrimitive.Range className="absolute h-full opacity-0" />{" "}
          </SliderPrimitive.Track>

          {/* Thumb for the best PR */}
          <SliderPrimitive.Thumb className="relative block">
            {/* Rotated diamond inside thumb */}
            <div className="h-4 w-4 rotate-45 bg-primary"></div>
            {/* PR value below thumb without rotation */}
            {best > 0 && (
              <span className="absolute -left-3 top-5 w-max font-bold">
                {best}
                {unitType}
              </span>
            )}
          </SliderPrimitive.Thumb>
        </SliderPrimitive.Root>
        <div className="absolute top-0 w-full">
          {/* 0.5x multiplier */}
          <div
            className="absolute h-3 w-1 bg-gray-400 opacity-50"
            style={{ left: `${((0.5 * bodyWeight) / maxLift) * 100}%` }}
          ></div>
          {/* 1x multiplier */}
          <div
            className="absolute h-3 w-1 bg-gray-400 opacity-50"
            style={{ left: `${((1 * bodyWeight) / maxLift) * 100}%` }}
          ></div>
          {/* 1.5x multiplier */}
          <div
            className="absolute h-3 w-1 bg-gray-400 opacity-50"
            style={{ left: `${((1.5 * bodyWeight) / maxLift) * 100}%` }}
          ></div>
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
