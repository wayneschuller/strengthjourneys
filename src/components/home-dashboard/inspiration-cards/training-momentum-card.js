import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { calculateSessionMomentumFromDates } from "@/lib/home-dashboard/inspiration-card-metrics";
import { InspirationCard } from "./inspiration-card";

const ENCOURAGEMENTS = {
  steady: [
    "Good. Keep training.",
    "Steady work is real work.",
    "This is how progress is built.",
    "Nothing fancy. Just keep going.",
    "The plan is working. Stay with it.",
    "Consistent beats dramatic.",
    "You held the line. Do it again.",
    "This is solid training.",
    "Same effort. Same results. Keep moving.",
    "Boring works. Keep it boring.",
  ],
  up: [
    "Good. Now do it again.",
    "Strong block. Keep the pace.",
    "Momentum is up. Protect it.",
    "This is what progress looks like.",
    "You are doing the work. Keep doing it.",
    "Good run. Stay on the gas.",
    "Strong training. Repeat it.",
    "You moved this block forward.",
    "Keep the bar moving.",
    "Good. Stack another block.",
  ],
  behind: [
    "You are behind, not out.",
    "Get one good session in. Then another.",
    "Do the next workout. That fixes a lot.",
    "A dip is not a collapse. Keep training.",
    "Reset and get back to work.",
    "The answer is more training, not more thinking.",
    "You can close this gap. Start now.",
    "One hard week changes the block.",
    "Keep it simple. Show up and train.",
    "Do not drift. Get back under the bar.",
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
