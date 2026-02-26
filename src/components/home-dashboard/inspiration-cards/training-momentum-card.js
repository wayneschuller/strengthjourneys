import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { calculateSessionMomentumFromDates } from "@/lib/home-dashboard/inspiration-card-metrics";
import { InspirationCard } from "./inspiration-card";

const ENCOURAGEMENTS = {
  baseline: [
    "Every block starts with a few sessions.",
    "A baseline today gives you something to build next block.",
    "This is the start of your next rhythm.",
  ],
  steady: [
    "Consistency across blocks is real momentum.",
    "Steady training keeps progress moving.",
    "Holding the line counts as momentum.",
  ],
  up: [
    "Nice work. Keep the rhythm going.",
    "Strong block. Stack another one.",
    "Momentum looks good. Protect the routine.",
  ],
  down: [
    "A lighter block is still part of the process.",
    "Reset the rhythm with one solid session.",
    "Small dips happen. The next block is the rebound.",
  ],
  matched: [
    "Repeatable training is a strength.",
    "You matched the work. That is consistency.",
    "Same output, same discipline. Keep rolling.",
  ],
};

export function TrainingMomentumCard({ allSessionDates = [], animationDelay = 0 }) {
  const { recentSessions, previousSessions, sessionDelta, percentageChange, windowDays } = useMemo(
    () =>
      allSessionDates.length
        ? calculateSessionMomentumFromDates(allSessionDates)
        : {
            recentSessions: 0,
            previousSessions: 0,
            sessionDelta: 0,
            percentageChange: 0,
            windowDays: 90,
          },
    [allSessionDates],
  );

  const hasPreviousBaseline = previousSessions > 0;
  const isWithinTenPercent = hasPreviousBaseline && Math.abs(percentageChange) <= 10;

  let trendText = null;
  let trendIcon = null;
  let trendTone = "text-muted-foreground";

  if (hasPreviousBaseline && isWithinTenPercent) {
    trendText = "steady";
    trendTone = "text-emerald-600";
  } else if (sessionDelta > 0) {
    trendText = `+${sessionDelta}`;
    trendIcon = <TrendingUp className="mr-0.5 h-3 w-3" />;
    trendTone = "text-emerald-600";
  } else if (sessionDelta < 0) {
    trendText = `${sessionDelta}`;
    trendIcon = <TrendingDown className="mr-0.5 h-3 w-3" />;
    trendTone = "text-amber-600";
  } else if (recentSessions > 0 || previousSessions > 0) {
    trendText = "steady";
  }

  let verdictLine = `No prior ${windowDays}-day block yet.`;
  let mode = "baseline";

  if (hasPreviousBaseline) {
    if (isWithinTenPercent) {
      verdictLine = `Steady compared with the previous ${windowDays}-day block.`;
      mode = "steady";
    } else if (sessionDelta > 0) {
      verdictLine = `Momentum is up versus the previous ${windowDays}-day block.`;
      mode = "up";
    } else if (sessionDelta < 0) {
      verdictLine = `Slight dip versus the previous ${windowDays}-day block.`;
      mode = "down";
    } else {
      verdictLine = `Matched the previous ${windowDays}-day block exactly.`;
      mode = "matched";
    }
  } else if (recentSessions > 0) {
    verdictLine = "Building your baseline.";
    mode = "baseline";
  }

  const encouragementOptions = ENCOURAGEMENTS[mode] ?? ENCOURAGEMENTS.steady;
  const [encouragementIndex, setEncouragementIndex] = useState(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setEncouragementIndex(
        Math.floor(Math.random() * encouragementOptions.length),
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [encouragementOptions.length]);

  const encouragementLine =
    encouragementOptions[encouragementIndex % encouragementOptions.length];

  return (
    <InspirationCard
      accent="emerald"
      icon={Activity}
      description="Session Momentum"
      title={`${recentSessions} sessions in ${windowDays} days`}
      action={
        trendText ? (
          <span className={`flex items-center text-[11px] font-normal ${trendTone}`}>
            {trendIcon}
            {trendText}
          </span>
        ) : null
      }
      footer={
        <div>
          <div>{verdictLine}</div>
          <div>{encouragementLine}</div>
        </div>
      }
      footerMultiline
      animationDelay={animationDelay}
    />
  );
}
