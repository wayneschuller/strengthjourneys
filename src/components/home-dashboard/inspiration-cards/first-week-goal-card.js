import { Target } from "lucide-react";
import { useMemo } from "react";

import { calculateStreakFromDates } from "@/lib/home-dashboard/inspiration-card-metrics";
import { InspirationCard } from "@/components/home-dashboard/inspiration-cards/inspiration-card";

export function FirstWeekGoalCard({
  allSessionDates = [],
  sessionCount = 0,
  animationDelay = 0,
}) {
  const { sessionsThisWeek } = useMemo(
    () =>
      allSessionDates.length
        ? calculateStreakFromDates(allSessionDates)
        : { sessionsThisWeek: 0 },
    [allSessionDates],
  );

  const weeklyGoal = 3;
  const sessionsRemaining = Math.max(0, weeklyGoal - (sessionsThisWeek ?? 0));
  const title =
    sessionsRemaining > 0
      ? `${weeklyGoal - sessionsRemaining}/${weeklyGoal} sessions this week`
      : `${sessionsThisWeek}/${weeklyGoal} sessions this week`;

  const footer =
    sessionsRemaining > 0
      ? `One honest workout at a time. ${sessionsRemaining} more this week.`
      : `Weekly target cleared. Keep technique crisp and log the next one too.`;

  return (
    <InspirationCard
      accent="emerald"
      icon={Target}
      description="First Week Goal"
      title={title}
      footer={
        <span>
          {sessionCount.toLocaleString()} session
          {sessionCount === 1 ? "" : "s"} logged so far. {footer}
        </span>
      }
      footerMultiline
      animationDelay={animationDelay}
    />
  );
}
