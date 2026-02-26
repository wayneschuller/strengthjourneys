import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { calculateSessionMomentumFromDates } from "@/lib/home-dashboard/inspiration-card-metrics";
import { InspirationCard } from "./inspiration-card";

const ENCOURAGEMENTS = {
  steady: [
    "Consistency across blocks is real momentum.",
    "Steady training keeps progress moving.",
    "Holding the line counts as momentum.",
    "This is what sustainable training looks like.",
    "A steady block keeps the long game moving.",
    "Consistency is doing more work than it feels like.",
    "You are keeping the rhythm alive.",
    "Steady blocks are how progress compounds.",
    "Nothing flashy needed. Just keep showing up.",
    "This is solid work. Keep it rolling.",
  ],
  up: [
    "Nice work. Keep the rhythm going.",
    "Strong block. Stack another one.",
    "Momentum looks good. Protect the routine.",
    "Great block. Keep the bar moving.",
    "You are building real momentum right now.",
    "Strong progress. Keep showing up for it.",
    "This block moved well. Stay with it.",
    "Good work. Another steady week keeps it going.",
    "You are trending the right way. Keep pressing.",
    "Excellent block. Keep the routine simple and repeatable.",
  ],
  behind: [
    "You are still in range. A few good sessions can close the gap.",
    "Keep training. This block can still finish strong.",
    "Stay with it. A small push now changes the block quickly.",
    "A lighter block is still part of the process.",
    "Reset the rhythm with one solid session.",
    "Small dips happen. The next block is the rebound.",
    "You are not far off. Keep the next session simple and solid.",
    "This is still recoverable. String together a few sessions.",
    "One good week can change the feel of the whole block.",
    "Keep going. Momentum often comes back faster than expected.",
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
  const STEADY_THRESHOLD_PERCENT = 15;
  const isWithinSteadyRange =
    hasPreviousBaseline && Math.abs(percentageChange) <= STEADY_THRESHOLD_PERCENT;
  const isUp = hasPreviousBaseline && percentageChange > STEADY_THRESHOLD_PERCENT;
  const isBehind =
    hasPreviousBaseline && percentageChange < -STEADY_THRESHOLD_PERCENT;

  let trendText = null;
  let trendIcon = null;
  let trendTone = "text-muted-foreground";

  if (hasPreviousBaseline && isWithinSteadyRange) {
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
  let encouragementMode = "steady";

  if (hasPreviousBaseline) {
    if (isWithinSteadyRange) {
      verdictLine = `Steady compared with the previous ${windowDays}-day block.`;
      encouragementMode = "steady";
    } else if (isUp || sessionDelta > 0) {
      verdictLine = `Momentum is up versus the previous ${windowDays}-day block.`;
      encouragementMode = "up";
    } else if (isBehind || sessionDelta < 0) {
      verdictLine = `Slight dip versus the previous ${windowDays}-day block.`;
      encouragementMode = "behind";
    }
  } else if (recentSessions > 0) {
    verdictLine = "Building your baseline.";
    encouragementMode = "up";
  }

  const encouragementOptions =
    ENCOURAGEMENTS[encouragementMode] ?? ENCOURAGEMENTS.steady;
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
