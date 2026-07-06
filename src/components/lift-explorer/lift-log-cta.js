/**
 * Motivational log CTA for Lift Explorer.
 * Uses the selected lift's latest logged date so the button feels tied to the
 * lifter's actual training history instead of generic page copy.
 */

import Link from "next/link";
import { ArrowRight, Clock3, Dumbbell } from "lucide-react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { formatDateToYmdLocal, parseYmdLocal } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";

/**
 * Prompts the user to start today's log with the selected Lift Explorer lift.
 * @param {Object} props
 * @param {string} props.liftType - Selected lift type.
 */
export function LiftLogCta({ liftType }) {
  const { parsedData, isLoading } = useUserLiftingData();

  if (!liftType) return null;

  const today = formatDateToYmdLocal(new Date());
  const latestLiftDate = getLatestLiftDate(parsedData, liftType);
  const daysSince = latestLiftDate
    ? getDaysBetweenYmd(latestLiftDate, today)
    : null;
  const copy = getLiftLogCtaCopy(liftType, daysSince);

  return (
    <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            <span>{copy.eyebrow}</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-semibold tracking-tight text-foreground">
              {copy.heading}
            </h3>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {copy.body}
            </p>
          </div>
        </div>

        <Button asChild size="lg" className="h-12 px-5 text-base sm:min-w-56">
          <Link
            href={{
              pathname: "/log",
              query: { startLift: liftType },
            }}
          >
            <Dumbbell className="h-5 w-5" />
            <span>{`Log ${liftType} now`}</span>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </div>

      {!isLoading && latestLiftDate && (
        <div className="border-t bg-muted/25 px-4 py-2 text-xs text-muted-foreground sm:px-5">
          Last logged:{" "}
          <Link
            href={{ pathname: "/log", query: { date: latestLiftDate } }}
            className="font-medium text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
          >
            {latestLiftDate}
          </Link>
        </div>
      )}
    </section>
  );
}

function getLatestLiftDate(parsedData, liftType) {
  if (!Array.isArray(parsedData)) return null;

  let latestDate = null;
  for (let i = 0; i < parsedData.length; i += 1) {
    const entry = parsedData[i];
    if (entry?.liftType === liftType && !entry.isGoal && entry.date) {
      latestDate = !latestDate || entry.date > latestDate ? entry.date : latestDate;
    }
  }

  return latestDate;
}

function getDaysBetweenYmd(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.round((parseYmdLocal(endDate) - parseYmdLocal(startDate)) / msPerDay),
  );
}

function getLiftLogCtaCopy(liftType, daysSince) {
  if (daysSince === null) {
    return {
      eyebrow: "Fresh page",
      heading: `Feel like making ${liftType} part of the story?`,
      body: `Start with one honest ${liftType} set today. The first entry gives this page something real to build from.`,
    };
  }

  if (daysSince === 0) {
    return {
      eyebrow: "Already touched today",
      heading: `Got another ${liftType} set in you?`,
      body: `You already logged ${liftType} today. Add the next set while the session is still fresh.`,
    };
  }

  if (daysSince === 1) {
    return {
      eyebrow: "Yesterday's work is close",
      heading: `Feel like doing ${liftType} again today?`,
      body: `It has only been a day. If the body says yes, stack another small brick onto this lift.`,
    };
  }

  if (daysSince <= 7) {
    return {
      eyebrow: `${daysSince} days since last time`,
      heading: `${liftType} is still warm in the rotation.`,
      body: `You trained it ${daysSince} days ago. Today is a clean chance to keep the thread moving.`,
    };
  }

  if (daysSince <= 21) {
    return {
      eyebrow: `${daysSince} days since last time`,
      heading: `Time to check in with ${liftType}?`,
      body: `A quick, crisp session would keep this movement from drifting too far from your hands.`,
    };
  }

  if (daysSince <= 60) {
    return {
      eyebrow: `${daysSince} days since last time`,
      heading: `${liftType} has been waiting a while.`,
      body: `You do not need a heroic session. One controlled set is enough to bring it back into view.`,
    };
  }

  return {
    eyebrow: `${daysSince} days since last time`,
    heading: `Bring ${liftType} back from the archives.`,
    body: `This lift has been quiet for a while. Log a conservative opener and let the next chapter start there.`,
  };
}
