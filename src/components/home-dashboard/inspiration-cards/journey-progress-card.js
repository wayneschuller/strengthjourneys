import { Calendar } from "lucide-react";
import { useMemo } from "react";

import {
  calculateTotalStats,
  formatJourneyLength,
} from "@/lib/home-dashboard/inspiration-card-metrics";
import { InspirationCard } from "./inspiration-card";

export function JourneyProgressCard({ parsedData, liftTypes, animationDelay = 0 }) {
  const totalStats = useMemo(() => calculateTotalStats(liftTypes), [liftTypes]);

  return (
    <InspirationCard
      accent="primary"
      icon={Calendar}
      description="Journey Length"
      title={
        parsedData && parsedData.length > 0
          ? formatJourneyLength(parsedData[0].date)
          : "Starting your journey"
      }
      footer={
        <span>
          {totalStats.totalReps.toLocaleString()} reps ·{" "}
          {totalStats.totalSets.toLocaleString()} sets
        </span>
      }
      animationDelay={animationDelay}
    />
  );
}
