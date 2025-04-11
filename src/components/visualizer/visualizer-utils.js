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

export const MultiLiftTooltipContent = ({
  active,
  payload,
  label,
  selectedLiftTypes,
}) => {
  // devLog(payload);
  if (active && payload && payload.length) {
    // Right now we have put key info into the chartData paylod. But we could simply lookup the date in parsedData/topLifts for info
    const tuple = payload[0].payload;

    // devLog(tuple);
    const dateLabel = getReadableDateString(tuple.date);
    const tooltipsPerLift = [];

    selectedLiftTypes.forEach((liftType) => {
      const reps = tuple[`${liftType}_reps`];
      const weight = tuple[`${liftType}_weight`];
      const oneRepMax = tuple[`${liftType}`];
      const unitType = tuple.unitType;

      if (reps && weight && oneRepMax) {
        let labelContent = "";
        if (reps === 1) {
          labelContent = `Lifted ${reps}@${weight}${unitType}`;
        } else {
          labelContent = `Potential 1@${oneRepMax}${unitType} from lifting ${reps}@${weight}${unitType}`;
        }

        const color = getLiftColor(liftType);
        tooltipsPerLift.push({
          liftType: liftType,
          label: labelContent,
          color: color,
          reps: reps,
        });
      }
    });

    // devLog(liftLabels);

    return (
      <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <p className="font-bold">{dateLabel}</p>
        {tooltipsPerLift.map(({ liftType, label, color, reps, index }) => (
          <div key={liftType}>
            <div className="flex flex-row items-center">
              <div
                className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: color }} // Use css style because tailwind is picky
              />
              <div className="font-semibold">{liftType}</div>
            </div>
            <div className="">{label}</div>
          </div>
        ))}
      </div>
    );
  }

  return null;
};

// -----------------------------------------------------------------------------
// CustomToolTipContent
// Out tooltip is modelled on the shadcnui chart layout but customised for our needs
// -----------------------------------------------------------------------------
export const CustomTooltipContent = ({ active, payload, label, liftType }) => {
  // devLog(payload);

  const selectedLiftTypes = [liftType]; // FIXME: we can just remove the .foreach below in mini mode

  if (active && payload && payload.length) {
    // Right now we have put key info into the chartData paylod. But we could simply lookup the date in parsedData/topLifts for info
    const tuple = payload[0].payload;

    // devLog(tuple);
    const dateLabel = getReadableDateString(tuple.date);
    const tooltipsPerLift = [];

    selectedLiftTypes.forEach((liftType) => {
      const reps = tuple[`${liftType}_reps`];
      const weight = tuple[`${liftType}_weight`];
      const oneRepMax = tuple[`${liftType}`];
      const unitType = tuple.unitType;

      if (reps && weight && oneRepMax) {
        let labelContent = "";
        if (reps === 1) {
          labelContent = `Lifted ${reps}@${weight}${unitType}`;
        } else {
          labelContent = `Potential 1@${oneRepMax}${unitType} from lifting ${reps}@${weight}${unitType}`;
        }

        const color = getLiftColor(liftType);
        tooltipsPerLift.push({
          liftType: liftType,
          label: labelContent,
          color: color,
          reps: reps,
        });
      }
    });

    // devLog(liftLabels);

    return (
      <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <p className="font-bold">{dateLabel}</p>
        {tooltipsPerLift.map(({ liftType, label, color, reps, index }) => (
          <div key={liftType}>
            <div className="flex flex-row items-center">
              <div
                className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: color }} // Use css style because tailwind is picky
              />
              <div className="font-semibold">{liftType}</div>
            </div>
            <div className="">{label}</div>
          </div>
        ))}
      </div>
    );
  }

  return null;
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
