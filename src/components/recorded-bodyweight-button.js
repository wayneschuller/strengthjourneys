/**
 * The way back from a what-if bodyweight to the one the lifter recorded.
 *
 * Every bodyweight slider is a playground: drag it to see what the standards
 * say at another weight. For a lifter whose sheet holds weigh-ins, this sits
 * under the slider and names their latest one and when it was. While the
 * slider is somewhere else it is an outlined button that puts it back; once
 * they match it says so in plain text.
 *
 * Reads the recorded weight from useAthleteBio (recordedBodyWeight, already
 * in the display unit). Renders nothing for a lifter without weigh-ins.
 */
import { format } from "date-fns";
import { Check, Scale } from "lucide-react";

import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { formatDateToYmdLocal } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";

/**
 * @param {Object} [props]
 * @param {number} [props.bodyWeight] The slider's value, when the host keeps
 *   its own copy. Defaults to the shared bio value.
 * @param {Function} [props.setBodyWeight] The host's setter, so a page that
 *   writes bodyweight into its URL hears about the change. Defaults to the
 *   shared bio setter.
 * @param {string} [props.className]
 */
export function RecordedBodyweightButton({
  bodyWeight: hostBodyWeight,
  setBodyWeight: hostSetBodyWeight,
  className = "",
} = {}) {
  const bio = useAthleteBio();
  const recorded = bio.recordedBodyWeight;
  if (recorded == null) return null;
  const bodyWeight = hostBodyWeight ?? bio.bodyWeight;
  const setBodyWeight = hostSetBodyWeight ?? bio.setBodyWeight;
  const unit = bio.isMetric ? "kg" : "lb";
  const when = describeWeighInDate(bio.latestWeighIn?.date);
  // Sliders move in whole units, so a weigh-in of 84.2 counts as matched at 84.
  const isMatched = Math.round(recorded) === Number(bodyWeight);

  if (isMatched) {
    return (
      <p
        className={`text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs ${className}`}
      >
        <Check className="h-3 w-3" aria-hidden />
        Set to your last weigh-in, {recorded} {unit}
        {when && <span>({when})</span>}
      </p>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 px-2.5 text-xs"
        onClick={() => setBodyWeight(Math.round(recorded))}
      >
        <Scale className="h-3.5 w-3.5" aria-hidden />
        Set to my last weigh-in, {recorded} {unit}
      </Button>
      {when && (
        <span className="text-muted-foreground text-xs">Weighed {when}</span>
      )}
    </div>
  );
}

/** "today", "yesterday", "5 days ago", or a date such as "Nov 2". */
function describeWeighInDate(date) {
  if (!date) return null;
  const today = formatDateToYmdLocal(new Date());
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) /
      86400000,
  );
  if (!Number.isFinite(days) || days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  const parsed = new Date(`${date}T00:00:00`);
  return format(
    parsed,
    parsed.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy",
  );
}
