/**
 * A small prompt on the dashboard's week card to add today's bodyweight, for
 * a lifter whose last weigh-in is more than four weeks old, or who has never
 * logged one. It is one line with the weight already filled in (their last
 * weigh-in, or their bodyweight setting), so keeping it current is a tap.
 *
 * The weigh-in goes through the log's sync queue (useWeighInWriter), and the
 * prompt turns into a short "saved" line at once. A lifter can put it away
 * for the rest of the week.
 */
import { useState } from "react";
import Link from "next/link";
import { useLocalStorage } from "usehooks-ts";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Scale, X } from "lucide-react";

import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { convertWeight, unitTypeFor } from "@/lib/weight-units";
import { useWeighInWriter } from "@/components/log/use-weigh-in-writer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// A weigh-in older than this is worth refreshing.
const STALE_DAYS = 28;

/**
 * @param {Object} props
 * @param {string} props.mondayStr The current week's Monday, YYYY-MM-DD.
 */
export function WeighInNudge({ mondayStr }) {
  const { canWrite, todayIso, weighInSeries, saveWeighIn } = useWeighInWriter();
  const { isMetric, bodyWeight, bodyWeightIsDefault } = useAthleteBio();
  const [dismissedWeek, setDismissedWeek] = useLocalStorage(
    LOCAL_STORAGE_KEYS.WEIGH_IN_NUDGE_DISMISSED_WEEK,
    null,
    { initializeWithValue: false },
  );
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const prefersReducedMotion = useReducedMotion();
  const unit = unitTypeFor(isMetric);

  const latest = weighInSeries?.at(-1) ?? null;
  const daysSince =
    latest && todayIso ? daysBetween(latest.date, todayIso) : null;
  const isDue = !latest || daysSince > STALE_DAYS;
  const isShown = canWrite && (saved || (isDue && dismissedWeek !== mondayStr));

  const suggested = latest
    ? round(convertWeight(latest.kg, "kg", unit))
    : bodyWeightIsDefault
      ? ""
      : bodyWeight;
  const weight = draft ?? String(suggested ?? "");
  const value = Number(String(weight).replace(",", "."));

  const save = (event) => {
    event.preventDefault();
    if (!(value > 0)) return;
    saveWeighIn({ date: todayIso, weight: round(value), unitType: unit });
    setSaved(round(value));
  };

  return (
    <AnimatePresence initial={false}>
      {isShown && (
        <motion.div
          key={saved ? "saved" : "ask"}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-muted/40 rounded-lg border px-3 py-2"
        >
          {saved ? (
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <Check className="text-primary h-4 w-4" aria-hidden />
              <span>
                Today&apos;s weigh-in, {saved} {unit}, is in your sheet.
              </span>
              <Link
                href="/bodyweight"
                className="text-muted-foreground text-xs underline underline-offset-2"
              >
                See your bodyweight chart
              </Link>
            </p>
          ) : (
            <form onSubmit={save} className="flex flex-wrap items-center gap-2">
              <Scale
                className="text-muted-foreground h-4 w-4 shrink-0"
                aria-hidden
              />
              <p className="min-w-[12rem] flex-1 text-sm">
                {latest
                  ? `Your last weigh-in was ${describeAgo(daysSince)}. What do you weigh today?`
                  : "Add your bodyweight and every lift is rated at what you weighed that day."}
              </p>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  aria-label={`Today's bodyweight in ${unit}`}
                  value={weight}
                  onChange={(event) => setDraft(event.target.value)}
                  className="h-8 w-20"
                />
                <span className="text-muted-foreground text-xs">{unit}</span>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8"
                  disabled={!(value > 0)}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Not this week"
                  onClick={() => setDismissedWeek(mondayStr)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function daysBetween(from, to) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000,
  );
}

function describeAgo(days) {
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

function round(value) {
  return Math.round(Number(value) * 10) / 10;
}
