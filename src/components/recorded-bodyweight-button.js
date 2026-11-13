/**
 * The way back from a what-if bodyweight to the one the lifter recorded.
 *
 * Every bodyweight slider is a playground: drag it to see what the standards
 * say at another weight. For a lifter whose sheet holds weigh-ins, this sits
 * under the slider and names their latest one. While the slider is somewhere
 * else it is a button that puts it back; once they match it says so.
 *
 * Reads the recorded weight from useAthleteBio (recordedBodyWeight, already
 * in the display unit). Renders nothing for a lifter without weigh-ins.
 */
import { Scale } from "lucide-react";

import { useAthleteBio } from "@/hooks/use-athlete-biodata";
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
  // Sliders move in whole units, so a weigh-in of 84.2 counts as matched at 84.
  const isMatched = Math.round(recorded) === Number(bodyWeight);

  if (isMatched) {
    return (
      <p
        className={`text-muted-foreground flex items-center gap-1.5 text-xs ${className}`}
      >
        <Scale className="h-3 w-3" aria-hidden />
        Your latest weigh-in, {recorded} {unit}
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className={`h-auto gap-1.5 px-0 text-xs ${className}`}
      onClick={() => setBodyWeight(Math.round(recorded))}
    >
      <Scale className="h-3 w-3" aria-hidden />
      Use your weigh-in, {recorded} {unit}
    </Button>
  );
}
