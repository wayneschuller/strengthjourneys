import { devLog, getReadableDateString } from "@/lib/processing-utils";
import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { getLiftColor } from "@/lib/get-lift-color";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Shared function to create tooltip content for a lift
const createLiftTooltipContent = (liftType, tuple) => {
  const reps = tuple[`${liftType}_reps`];
  const weight = tuple[`${liftType}_weight`];
  const oneRepMax = tuple[`${liftType}`];
  const unitType = tuple.unitType;

  if (!reps || !weight || !oneRepMax) return null;

  const labelContent =
    reps === 1
      ? `Lifted ${reps}@${weight}${unitType}`
      : `Potential 1@${oneRepMax}${unitType} from lifting ${reps}@${weight}${unitType}`;

  return {
    liftType,
    label: labelContent,
    color: getLiftColor(liftType),
    reps,
  };
};

// Shared tooltip UI component
const TooltipUI = ({ dateLabel, tooltipsPerLift }) => (
  <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
    <p className="font-bold">{dateLabel}</p>
    {tooltipsPerLift.map(({ liftType, label, color, reps }) => (
      <div key={liftType}>
        <div className="flex flex-row items-center">
          <div
            className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: color }}
          />
          <div className="font-semibold">{liftType}</div>
        </div>
        <div className="">{label}</div>
      </div>
    ))}
  </div>
);

// For multiple lifts - the main visualizer chart has multi lifts
export const MultiLiftTooltipContent = ({
  active,
  payload,
  label,
  selectedLiftTypes,
}) => {
  if (!active || !payload?.length) return null;

  const tuple = payload[0].payload;
  const dateLabel = getReadableDateString(tuple.date);
  const tooltipsPerLift = selectedLiftTypes
    .map((liftType) => createLiftTooltipContent(liftType, tuple))
    .filter(Boolean);

  return <TooltipUI dateLabel={dateLabel} tooltipsPerLift={tooltipsPerLift} />;
};

// For single lift - visualizer mini uses this
export const SingleLiftTooltipContent = ({
  active,
  payload,
  label,
  liftType,
}) => {
  if (!active || !payload?.length) return null;

  const tuple = payload[0].payload;
  const dateLabel = getReadableDateString(tuple.date);
  const tooltipContent = createLiftTooltipContent(liftType, tuple);

  return tooltipContent ? (
    <TooltipUI dateLabel={dateLabel} tooltipsPerLift={[tooltipContent]} />
  ) : null;
};

export function E1RMFormulaSelect({ e1rmFormula, setE1rmFormula }) {
  return (
    <div className="flex flex-row items-center space-x-2">
      <div className="text-sm font-light">E1RM Algorithm</div>
      <Select value={e1rmFormula} onValueChange={setE1rmFormula}>
        <SelectTrigger
          className="w-[160px] rounded-lg sm:ml-auto"
          aria-label="Select a value"
        >
          <SelectValue placeholder="Brzycki" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {e1rmFormulae.map((formula) => (
            <SelectItem key={formula} value={formula} className="rounded-lg">
              {formula}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Show a label of corresponding to labels in user data
export const SpecialHtmlLabel = ({ x, y, value }) => {
  if (!value) return null;

  const maxChars = 20;
  // Trim the label if it's longer than the specified max characters
  const trimmedValue =
    value.length > maxChars ? value.slice(0, maxChars) + "..." : value;

  return (
    <foreignObject x={x - 50} y={y + 220} width={100} height={50}>
      <div
        className="rounded-md border p-2 text-center text-xs tracking-tight shadow-lg"
        title={value}
      >
        {trimmedValue}
      </div>
    </foreignObject>
  );
};

// Tooltip for VisualizerReps (singles, triples, fives)
export const VisualizerRepsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const tuple = payload[0].payload;
  const dateLabel = getReadableDateString(tuple.date);

  // Build info for singles, triples, fives
  const repInfos = [
    { label: "Singles", reps: 1, color: "#ef4444" },
    { label: "Triples", reps: 3, color: "#3b82f6" },
    { label: "Fives", reps: 5, color: "#10b981" },
  ]
    .map((tab) => {
      const t = tuple[`reps${tab.reps}_tuple`];
      if (!t) return null;
      return {
        ...tab,
        weight: t.weight,
        unitType: t.unitType,
        rpe: t.rpe,
        // Add more fields as needed
      };
    })
    .filter(Boolean);

  return (
    <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">{dateLabel}</p>
      {repInfos.map((info) => (
        <div key={info.label}>
          <div className="flex flex-row items-center">
            <div
              className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: info.color }}
            />
            <div className="font-semibold">{info.label}</div>
          </div>
          <div>
            {info.weight}
            {info.unitType}
            {info.rpe ? (
              <span className="ml-1 text-muted-foreground">RPE {info.rpe}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};
