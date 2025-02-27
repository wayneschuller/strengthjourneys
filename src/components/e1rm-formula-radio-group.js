import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { estimateE1RM, e1rmFormulae } from "@/lib/estimate-e1rm";
import { cn } from "@/lib/utils";

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

  return (
    <fieldset className="">
      <legend>
        <Label>E1RM Algorithm:</Label>
      </legend>
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
