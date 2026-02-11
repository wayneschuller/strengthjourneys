"use client";

import Link from "next/link";
import { useLiftColors } from "@/hooks/use-lift-colors";

export const bigFourURLs = {
  "Back Squat": "/barbell-squat-insights",
  "Bench Press": "/barbell-bench-press-insights",
  Deadlift: "/barbell-deadlift-insights",
  "Strict Press": "/barbell-strict-press-insights",
};

export const LiftTypeIndicator = ({ liftType, className = "" }) => {
  const { getColor } = useLiftColors();
  const color = getColor(liftType);

  // Content to be rendered (color square and lift type text)
  const content = (
    <div className={`flex flex-row items-center ${className}`.trim()}>
      <div
        className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <div className="font-bold">{liftType}</div>
    </div>
  );

  // Conditionally wrap content in a Link for big four lifts
  return bigFourURLs[liftType] ? (
    <Link href={bigFourURLs[liftType]} className="underline transition-opacity hover:opacity-70">
      {content}
    </Link>
  ) : (
    content
  );
};
