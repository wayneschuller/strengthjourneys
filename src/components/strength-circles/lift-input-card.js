/**
 * LiftInputCard
 *
 * Handles Squat / Bench / Deadlift input for the How Strong Am I page.
 * Each lift can be entered as:
 *   - A set (weight + reps) → E1RM computed via Brzycki
 *   - A direct 1RM
 *
 * Reads isMetric from AthleteBioProvider (no prop needed).
 * Calls onLiftChange({ squat, bench, deadlift }) with values in KG.
 */

import { useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { Dumbbell } from "lucide-react";

// ─── Per-lift config ──────────────────────────────────────────────────────────

const LIFTS = [
  { key: "squat",    label: "Back Squat",  emoji: "🏋️" },
  { key: "bench",    label: "Bench Press", emoji: "💪" },
  { key: "deadlift", label: "Deadlift",    emoji: "⛓️" },
];

// Convert display weight (in user's unit) to kg
function toKg(weight, isMetric) {
  if (isMetric) return weight;
  return Math.round((weight / 2.2046) * 10) / 10;
}

// ─── Single lift row ──────────────────────────────────────────────────────────

function LiftRow({ liftConfig, liftState, onChange, isMetric }) {
  const { key, label, emoji } = liftConfig;
  const { mode, weight, reps } = liftState;
  const unit = isMetric ? "kg" : "lb";

  const isSetMode = mode === "reps";

  // E1RM preview in display units (before converting to kg for parent)
  const e1rmPreview =
    isSetMode && weight > 0 && reps > 0
      ? estimateE1RM(reps, weight, "Brzycki")
      : null;

  const handleWeightChange = (e) => {
    const raw = e.target.value;
    // Allow empty string while typing
    const parsed = raw === "" ? "" : parseFloat(raw);
    onChange(key, { weight: parsed });
  };

  const handleRepsChange = ([newReps]) => {
    onChange(key, { reps: newReps });
  };

  const handleModeToggle = (checked) => {
    onChange(key, { mode: checked ? "reps" : "1rm" });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      {/* Header row: name + mode toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={isSetMode ? "font-medium text-foreground" : ""}>
            Set
          </span>
          <Switch
            checked={!isSetMode}
            onCheckedChange={(checked) => handleModeToggle(!checked)}
            aria-label={`${label} input mode`}
          />
          <span className={!isSetMode ? "font-medium text-foreground" : ""}>
            1RM
          </span>
        </div>
      </div>

      {/* Input area */}
      <div className="flex flex-col gap-2">
        {isSetMode ? (
          <>
            {/* Set mode: weight + reps slider */}
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-1.5">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  onChange={handleWeightChange}
                  placeholder="Weight"
                  className="w-24"
                  min={0}
                  max={isMetric ? 500 : 1100}
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  {unit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {reps} rep{reps !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Reps slider */}
            <div className="flex items-center gap-3 px-0.5">
              <span className="text-xs text-muted-foreground">1</span>
              <Slider
                value={[reps]}
                onValueChange={handleRepsChange}
                min={1}
                max={12}
                step={1}
                className="flex-1"
                aria-label={`${label} reps`}
              />
              <span className="text-xs text-muted-foreground">12</span>
            </div>

            {/* E1RM preview */}
            <div className="h-4">
              {e1rmPreview !== null && (
                <p className="text-xs text-muted-foreground">
                  ≈{" "}
                  <span className="font-medium text-foreground">
                    {isMetric
                      ? e1rmPreview
                      : Math.round(e1rmPreview)}{" "}
                    {unit}
                  </span>{" "}
                  estimated 1RM
                </p>
              )}
            </div>
          </>
        ) : (
          /* 1RM mode: single weight input */
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={handleWeightChange}
              placeholder="1RM"
              className="w-28"
              min={0}
              max={isMetric ? 500 : 1100}
            />
            <span className="text-sm text-muted-foreground">{unit} 1RM</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * @param {{
 *   liftInputs: {
 *     squat:    { mode: "reps"|"1rm", weight: number|"", reps: number },
 *     bench:    { mode: "reps"|"1rm", weight: number|"", reps: number },
 *     deadlift: { mode: "reps"|"1rm", weight: number|"", reps: number },
 *   },
 *   onLiftInputsChange: (inputs) => void,
 *   onLiftKgsChange: (kgs: { squat, bench, deadlift }) => void,
 * }} props
 */
export function LiftInputCard({ liftInputs, onLiftInputsChange, onLiftKgsChange }) {
  const { isMetric } = useAthleteBio();
  const unit = isMetric ? "kg" : "lb";

  const enteredCount = LIFTS.filter(({ key }) => {
    const s = liftInputs[key];
    return s.weight !== "" && Number(s.weight) > 0;
  }).length;

  // Update a single field within a single lift's state, then recompute kg outputs
  const handleChange = useCallback(
    (liftKey, patch) => {
      const next = {
        ...liftInputs,
        [liftKey]: { ...liftInputs[liftKey], ...patch },
      };
      onLiftInputsChange(next);

      // Derive kg values for computation
      const kgs = {};
      for (const { key } of LIFTS) {
        const s = next[key];
        const displayWeight = Number(s.weight);
        if (!displayWeight || isNaN(displayWeight) || displayWeight <= 0) {
          kgs[key] = null;
          continue;
        }
        if (s.mode === "reps" && s.reps > 0) {
          // Compute E1RM in display units, then convert to kg
          const e1rmDisplay = estimateE1RM(s.reps, displayWeight, "Brzycki");
          kgs[key] = toKg(e1rmDisplay, isMetric);
        } else {
          kgs[key] = toKg(displayWeight, isMetric);
        }
      }
      onLiftKgsChange(kgs);
    },
    [liftInputs, isMetric, onLiftInputsChange, onLiftKgsChange],
  );

  const missingLifts = LIFTS.filter(({ key }) => {
    const s = liftInputs[key];
    return !s.weight || Number(s.weight) <= 0;
  }).map(({ label }) => label);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Dumbbell className="h-4 w-4" />
          Your Lifts
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {LIFTS.map((liftConfig) => (
          <LiftRow
            key={liftConfig.key}
            liftConfig={liftConfig}
            liftState={liftInputs[liftConfig.key]}
            onChange={handleChange}
            isMetric={isMetric}
          />
        ))}

        {/* Partial-input hint */}
        {enteredCount > 0 && enteredCount < 3 && (
          <p className="text-xs text-muted-foreground">
            Add{" "}
            <span className="font-medium text-foreground">
              {missingLifts.join(" + ")}
            </span>{" "}
            to compute a full total percentile.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
