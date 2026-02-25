import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";

import { calculateSessionMomentumFromDates } from "@/lib/home-dashboard/inspiration-card-metrics";
import { InspirationCard } from "./inspiration-card";

export function TrainingMomentumCard({ allSessionDates, animationDelay = 0 }) {
  const { recentSessions, previousSessions, percentageChange } = useMemo(
    () =>
      allSessionDates.length
        ? calculateSessionMomentumFromDates(allSessionDates)
        : { recentSessions: 0, previousSessions: 0, percentageChange: 0 },
    [allSessionDates],
  );

  const avgPerWeek = (recentSessions * 7) / 90;
  const avgFormatted =
    avgPerWeek % 1 === 0 ? Math.round(avgPerWeek) : avgPerWeek.toFixed(1);

  return (
    <InspirationCard
      accent="emerald"
      icon={Activity}
      description="Session Momentum"
      title={`${recentSessions} sessions in 90 days`}
      action={
        percentageChange !== 0 ? (
          <span
            className={`flex items-center text-[11px] font-normal ${
              percentageChange > 0 ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {percentageChange > 0 ? (
              <TrendingUp className="mr-0.5 h-3 w-3" />
            ) : (
              <TrendingDown className="mr-0.5 h-3 w-3" />
            )}
            {Math.abs(percentageChange)}%
          </span>
        ) : null
      }
      footer={
        <span>
          Avg {avgFormatted}/wk · {previousSessions} prev 90 days
        </span>
      }
      animationDelay={animationDelay}
    />
  );
}
