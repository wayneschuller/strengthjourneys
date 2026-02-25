import { Flame } from "lucide-react";
import { useMemo, useState } from "react";

import { STREAK_ENCOURAGMENTS } from "@/lib/home-dashboard/inspiration-card-copy";
import { calculateStreakFromDates } from "@/lib/home-dashboard/inspiration-card-metrics";
import { InspirationCard } from "./inspiration-card";

export function ConsistencyStreakCard({ allSessionDates, animationDelay = 0 }) {
  const { currentStreak, bestStreak, sessionsThisWeek } = useMemo(
    () =>
      allSessionDates.length
        ? calculateStreakFromDates(allSessionDates)
        : { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 },
    [allSessionDates],
  );

  const sessionsNeededThisWeek = Math.max(0, 3 - (sessionsThisWeek ?? 0));

  const [encouragementMessage] = useState(() =>
    STREAK_ENCOURAGMENTS[
      Math.floor(Math.random() * STREAK_ENCOURAGMENTS.length)
    ],
  );

  return (
    <InspirationCard
      accent="orange"
      icon={Flame}
      description="Weekly consistency"
      title={`${currentStreak} week${currentStreak === 1 ? "" : "s"} in a row`}
      footer={
        <span>
          {`Best: ${bestStreak}wk`}
          {sessionsNeededThisWeek > 0
            ? ` · ${sessionsNeededThisWeek} more this week`
            : sessionsThisWeek >= 3
              ? ` · ${sessionsThisWeek} this week. ${encouragementMessage}`
              : ""}
        </span>
      }
      animationDelay={animationDelay}
    />
  );
}
