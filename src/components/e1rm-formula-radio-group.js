import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { estimateE1RM, e1rmFormulae } from "@/lib/estimate-e1rm";
import { cn } from "@/lib/utils";

/**
 * Radio group for selecting an estimated one-rep-max (E1RM) formula. Optionally
 * shows the estimated value each formula would produce for the given reps and weight.
 *
 * @param {Object} props
 * @param {string[]} [props.formulae] - Array of formula names to display; defaults to all known formulae.
 * @param {string} props.e1rmFormula - The currently selected formula name.
 * @param {Function} props.setE1rmFormula - Callback to update the selected formula.
 * @param {number} [props.reps] - Rep count used to compute per-formula estimates.
 * @param {number} [props.weight] - Weight used to compute per-formula estimates.
 * @param {boolean} [props.isMetric] - Whether weights are in kg (true) or lb (false).
 * @param {boolean} [props.horizontal] - If true, renders the radio items in a multi-column grid.
 * @param {boolean} [props.showEstimates] - If true, shows the per-formula estimate beside each label.
 */
export function E1RMFormulaRadioGroup({
  formulae,
  e1rmFormula,
  setE1rmFormula,
  reps,
  weight,
  isMetric,
  horizontal = false,
  showEstimates = true, // New prop to control showing estimates
}) {
  // Default to the provided formulae if none are given
  if (!formulae) {
    formulae = e1rmFormulae;
  }

  // Check if we have all required data for estimates
  const hasEstimateData =
    reps !== undefined && weight !== undefined && isMetric !== undefined;

  const unit = isMetric ? "kg" : "lb";
  const minEstimate = hasEstimateData ? estimateE1RM(reps, weight, formulae[0]) : null;
  const maxEstimate = hasEstimateData ? estimateE1RM(reps, weight, formulae[formulae.length - 1]) : null;

  return (
    <fieldset className="">
      <legend>
        <Label>E1RM Algorithm:</Label>
      </legend>
      {hasEstimateData && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formulae.length} algorithms — estimates range from {minEstimate} to {maxEstimate}{unit}
        </p>
      )}
      <RadioGroup
        value={e1rmFormula}
        onValueChange={setE1rmFormula}
        className={cn(
          "mt-2 space-y-1",
          horizontal ? "grid grid-cols-2 lg:grid-cols-4" : "grid grid-cols-1",
        )}
        aria-label="Select E1RM Algorithm"
      >
        {formulae.map((formula) => (
          <div key={formula} className="flex items-center space-x-2">
            <RadioGroupItem value={formula} id={`e1rm-formula-${formula}`} />
            <Label htmlFor={`e1rm-formula-${formula}`} className="">
              {formula}
              {showEstimates && hasEstimateData && (
                <>
                  {" "}
                  ({estimateE1RM(reps, weight, formula)}
                  {isMetric ? "kg" : "lb"})
                </>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
