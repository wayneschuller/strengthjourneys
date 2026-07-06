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

const LIFT_LOG_CTA_PHRASES = {
  never: [
    "Feel like making {lift} part of the story?",
    "Start your {lift} history today.",
    "Give {lift} its first real entry.",
    "One honest {lift} set is enough to begin.",
    "Put {lift} on the map.",
    "No history yet. Perfect day to start.",
    "Let today be your first {lift} data point.",
    "Build the first brick for {lift}.",
    "Open the book on {lift}.",
    "Log the set future-you will want to see.",
  ],
  today: [
    "Got another {lift} set in you?",
    "Add the next {lift} set while it is fresh.",
    "Keep today's {lift} session moving.",
    "One more crisp {lift} set?",
    "You already started. Finish the thought.",
    "Stack another {lift} set onto today.",
    "Add the set that rounds this session out.",
    "Today's {lift} story is still open.",
    "Keep the {lift} groove warm.",
    "Capture the next set before you forget it.",
  ],
  yesterday: [
    "Feel like doing {lift} again today?",
    "Yesterday was close. Today can build on it.",
    "Keep {lift} in your hands.",
    "Back-to-back momentum is there if you want it.",
    "Yesterday set the thread. Today can pull it forward.",
    "If recovery says yes, log another {lift} day.",
    "Turn yesterday's touch into a rhythm.",
    "Stay familiar with {lift}.",
    "Another small exposure goes a long way.",
    "Keep the groove alive.",
  ],
  recent: [
    "{lift} is still warm in the rotation.",
    "Keep the {lift} thread moving.",
    "This is a good window for another touch.",
    "Come back before the groove fades.",
    "A clean {lift} session would fit nicely today.",
    "Keep this movement honest.",
    "Small repeat exposures make {lift} yours.",
    "The timing is good for another look.",
    "Stay close to the skill.",
    "Add one more data point while it still feels familiar.",
  ],
  checkIn: [
    "Time to check in with {lift}?",
    "Bring {lift} back into the week.",
    "A quick touch would keep {lift} from drifting.",
    "Check the movement before it gets rusty.",
    "One crisp set can re-anchor {lift}.",
    "This is a good day to remind the body.",
    "Keep {lift} from becoming a stranger.",
    "Revisit the {lift} pattern.",
    "A small session beats waiting for perfect timing.",
    "See what {lift} feels like today.",
  ],
  stale: [
    "{lift} has been waiting a while.",
    "Bring {lift} back gently.",
    "No heroics needed. Just a clean opener.",
    "Dust off {lift} with one controlled set.",
    "Let {lift} re-enter the rotation.",
    "Start conservative and rebuild the rhythm.",
    "Today can be the low-pressure return.",
    "Reintroduce {lift} with intent.",
    "One easy set gets {lift} back in view.",
    "Make the comeback boring and useful.",
  ],
  archived: [
    "Bring {lift} back from the archives.",
    "Reopen the {lift} chapter.",
    "This lift has been quiet long enough.",
    "Start the comeback with a conservative opener.",
    "Give old {lift} history a new entry.",
    "No need to chase the old number today.",
    "Return to {lift} with patience.",
    "Make today the first marker back.",
    "Wake the lift up carefully.",
    "The next chapter can start with one set.",
  ],
};

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
  const copy = getLiftLogCtaCopy(liftType, daysSince, today);

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

function getLiftLogCtaCopy(liftType, daysSince, today) {
  const category = getLiftLogCtaCategory(daysSince);
  const heading = getRotatingPhrase({
    phrases: LIFT_LOG_CTA_PHRASES[category],
    seed: `${today}:${category}:${liftType}`,
    liftType,
  });

  if (daysSince === null) {
    return {
      eyebrow: "Fresh page",
      heading,
      body: `Start with one honest ${liftType} set today. The first entry gives this page something real to build from.`,
    };
  }

  if (daysSince === 0) {
    return {
      eyebrow: "Already touched today",
      heading,
      body: `You already logged ${liftType} today. Add the next set while the session is still fresh.`,
    };
  }

  if (daysSince === 1) {
    return {
      eyebrow: "Yesterday's work is close",
      heading,
      body: `It has only been a day. If the body says yes, stack another small brick onto this lift.`,
    };
  }

  if (daysSince <= 7) {
    return {
      eyebrow: `${daysSince} days since last time`,
      heading,
      body: `You trained it ${daysSince} days ago. Today is a clean chance to keep the thread moving.`,
    };
  }

  if (daysSince <= 21) {
    return {
      eyebrow: `${daysSince} days since last time`,
      heading,
      body: `A quick, crisp session would keep this movement from drifting too far from your hands.`,
    };
  }

  if (daysSince <= 365) {
    return {
      eyebrow: `${daysSince} days since last time`,
      heading,
      body: `You do not need a heroic session. One controlled set is enough to bring it back into view.`,
    };
  }

  return {
    eyebrow: `${daysSince} days since last time`,
    heading,
    body: `This lift has been quiet for a while. Log a conservative opener and let the next chapter start there.`,
  };
}

function getLiftLogCtaCategory(daysSince) {
  if (daysSince === null) return "never";
  if (daysSince === 0) return "today";
  if (daysSince === 1) return "yesterday";
  if (daysSince <= 7) return "recent";
  if (daysSince <= 21) return "checkIn";
  if (daysSince <= 365) return "stale";
  return "archived";
}

function getRotatingPhrase({ phrases, seed, liftType }) {
  const phrase = phrases[getStableHash(seed) % phrases.length];
  return phrase.replaceAll("{lift}", liftType);
}

function getStableHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
