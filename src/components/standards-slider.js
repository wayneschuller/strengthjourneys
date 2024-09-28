import { useAthleteBioData } from "@/lib/use-athlete-biodata";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useSession } from "next-auth/react";
import { devLog } from "@/lib/processing-utils";
import * as SliderPrimitive from "@radix-ui/react-slider";

export function StandardsSlider({ liftType }) {
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

  if (!standards) return null;
  const originalData = standards[liftType];
  if (!originalData) return null;
  const liftTypeStandards = convertLabels(originalData);
  devLog(liftTypeStandards);

  const unitType = isMetric ? "kg" : "lb";
  const maxLift = originalData.elite; // Max value of slider

  let best = undefined;
  let yearlyBest = undefined;
  if (topLiftsByTypeAndReps && authStatus === "authenticated") {
    best = topLiftsByTypeAndReps[liftType][0][0];
    yearlyBest = topLiftsByTypeAndRepsLast12Months[liftType][0][0];
  }
  devLog(best);

  // Convert object keys to an array for rendering labels
  const levelLabels = Object.keys(liftTypeStandards);

  return (
    <div className="mx-auto w-full">
      {/* Lift level labels */}
      <div className="mb-2 flex justify-between text-sm">
        {levelLabels.map((level) => (
          <span key={level} className="hidden md:block">
            <div className="md:text-base">{level}</div>
            <div className="md:text-lg">
              {liftTypeStandards[level]}
              {unitType}
            </div>
          </span>
        ))}
        <div className="block md:hidden">Rating: </div>
      </div>

      <SliderPrimitive.Root
        // value={[best?.weight, yearlyBest?.weight]}
        value={
          yearlyBest?.weight === best?.weight
            ? [best?.weight] // Only one thumb if they are the same
            : [best?.weight, yearlyBest?.weight] // Two thumbs if they differ
        }
        max={maxLift}
        disabled // Make it non-interactive
        className="relative flex w-full touch-none select-none items-center pb-5"
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
          <span className="absolute -left-3 top-6 w-max">
            {best?.weight}
            {unitType}
          </span>
        </SliderPrimitive.Thumb>

        {/* Thumb for the PR in the last 12 months */}
        <SliderPrimitive.Thumb className="relative block">
          {/* Different style or color for distinction */}
          <div className="h-4 w-4 rounded-full bg-primary"></div>
          {/* PR value below thumb without rotation */}
          <span className="absolute -left-3 top-6 w-max">
            {yearlyBest?.weight}
            {unitType}
          </span>
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Root>
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
