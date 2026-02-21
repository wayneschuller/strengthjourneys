import { devLog, getReadableDateString, getDisplayWeight } from "@/lib/processing-utils";
import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { brightenHexColor, saturateHexColor } from "@/lib/color-tools";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useLiftColors } from "@/hooks/use-lift-colors";

/**
 * Renders a compact inline summary of a session's sets as "reps@weight" pairs, optionally
 * preceded by the session date.
 *
 * @param {Object} props
 * @param {string} [props.date] - ISO date string (YYYY-MM-DD) for the session; displayed only when showDate is true.
 * @param {Array} props.lifts - Array of lift objects to display (each must have reps, weight, and unitType).
 * @param {boolean} [props.isMetric] - When true, displays weights in kg; defaults to reading each lift's native unitType.
 * @param {boolean} [props.showDate] - Whether to prefix the row with the formatted date; defaults to true.
 */
export const SessionRow = ({ date, lifts, isMetric, showDate = true }) => {
  if (!lifts || lifts.length === 0) return null;

  const formattedDate = date
    ? new Date(date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="text-xs">
      {showDate && formattedDate && (
        <>
          <span className="font-semibold">{formattedDate}:</span>{" "}
        </>
      )}
      <span className="mr-1 font-semibold">Sets:</span>
      {lifts.map((lift, index) => {
        const { value, unit } = getDisplayWeight(lift, isMetric ?? false);
        return (
          <span key={index}>
            {lift.reps}@{value}
            {unit}
            {index < lifts.length - 1 && ", "}
          </span>
        );
      })}
    </div>
  );
};

// Shared function to create tooltip content for a lift
// tuple.displayUnit is set by processVisualizerData (already converted to user's preferred unit)
const createLiftTooltipContent = (liftType, tuple, color) => {
  const reps = tuple[`${liftType}_reps`];
  const weight = tuple[`${liftType}_weight`];
  const oneRepMax = tuple[`${liftType}`];
  const displayUnit = tuple.displayUnit || "";

  if (!reps || !weight || !oneRepMax) return null;

  const labelContent =
    reps === 1
      ? `Lifted ${reps}@${weight}${displayUnit}`
      : `Potential 1@${oneRepMax}${displayUnit} from lifting ${reps}@${weight}${displayUnit}`;

  return {
    liftType,
    label: labelContent,
    color: color,
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

/**
 * Recharts tooltip content for the multi-lift E1RM area chart, showing each selected lift's
 * date, lift type name, and estimated one-rep max for the hovered data point.
 *
 * @param {Object} props
 * @param {boolean} props.active - Whether the tooltip is currently active (provided by Recharts).
 * @param {Array} props.payload - Recharts payload array for the hovered data point.
 * @param {*} props.label - Recharts label value (unused; date is read from payload).
 * @param {string[]} props.selectedLiftTypes - List of lift type names currently displayed on the chart.
 */
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
    .map((liftType) =>
      createLiftTooltipContent(liftType, tuple, payload[0].color),
    )
    .filter(Boolean);

  return <TooltipUI dateLabel={dateLabel} tooltipsPerLift={tooltipsPerLift} />;
};

// Helper function to get session lifts grouped by lift type (reused from visualizer-tonnage.js)
function getSessionLiftsByType(parsedData, dateStr, chartLiftType) {
  if (!parsedData || !dateStr) return {};

  // Filter lifts for the given date, excluding goals
  const sessionLifts = parsedData.filter(
    (lift) =>
      lift.date === dateStr &&
      lift.isGoal !== true &&
      (!chartLiftType || lift.liftType === chartLiftType),
  );

  // Group by lift type
  const liftsByType = {};
  sessionLifts.forEach((lift) => {
    if (!liftsByType[lift.liftType]) {
      liftsByType[lift.liftType] = [];
    }
    liftsByType[lift.liftType].push(lift);
  });

  return liftsByType;
}

/**
 * Recharts tooltip content for a single-lift E1RM chart, showing the date, lift name, estimated
 * one-rep max, and the raw sets logged that session (fetched from parsedData).
 *
 * @param {Object} props
 * @param {boolean} props.active - Whether the tooltip is currently active (provided by Recharts).
 * @param {Array} props.payload - Recharts payload array for the hovered data point.
 * @param {*} props.label - Recharts label value (unused; date is read from payload).
 * @param {string} props.liftType - Display name of the lift being charted.
 * @param {Array} props.parsedData - Full parsed lifting dataset used to look up session sets.
 * @param {string} [props.liftColor] - Hex color for the lift's color swatch; falls back to the lift color from context.
 * @param {boolean} [props.isMetric] - When true, displays weights in kg; otherwise lb.
 */
export const SingleLiftTooltipContent = ({
  active,
  payload,
  label,
  liftType,
  parsedData,
  liftColor,
  isMetric,
}) => {
  const { getColor } = useLiftColors();
  if (!active || !payload?.length) return null;

  const tuple = payload[0].payload;
  const dateStr = tuple.date; // "YYYY-MM-DD" format
  const dateLabel = getReadableDateString(tuple.date);
  const tooltipContent = createLiftTooltipContent(
    liftType,
    tuple,
    payload[0].color,
  );

  // Get session lifts for this date and lift type
  const sessionLiftsByType =
    parsedData && dateStr
      ? getSessionLiftsByType(parsedData, dateStr, liftType)
      : null;

  const lifts = sessionLiftsByType?.[liftType] || [];

  if (!tooltipContent) return null;

  return (
    <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">{dateLabel}</p>
      <div className="flex flex-row items-center">
        <div
          className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: liftColor || getColor(liftType) }}
        />
        <div className="font-semibold">{liftType}</div>
      </div>
      <div className="">{tooltipContent.label}</div>
      {lifts.length > 0 && (
        <div className="mt-1">
          <SessionRow
            date={dateStr}
            lifts={lifts}
            isMetric={isMetric ?? false}
            showDate={false}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Dropdown that lets the user switch between available E1RM estimation algorithms
 * (e.g. Brzycki, Epley, etc.). Used in visualizer chart footers.
 *
 * @param {Object} props
 * @param {string} props.e1rmFormula - Currently selected formula name.
 * @param {function(string)} props.setE1rmFormula - Callback to update the selected formula.
 */
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

/**
 * Recharts custom label that renders a user-supplied text annotation (from the "label" column
 * in the Google Sheet) as a bordered badge below a chart data point.
 *
 * @param {Object} props
 * @param {number} props.x - SVG x coordinate provided by Recharts.
 * @param {number} props.y - SVG y coordinate provided by Recharts.
 * @param {string} [props.value] - Label text to display; truncated at 20 characters.
 */
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

// Helper to get rep color for tooltip, matching chart logic
function getRepColor(reps, liftColor) {
  if (reps === 1) return liftColor;
  if (reps === 3) return brightenHexColor(liftColor, 1.25);
  if (reps === 5) return saturateHexColor(liftColor, 1.3);
  return liftColor;
}

/**
 * Recharts tooltip content for the Singles/Triples/Fives area chart, showing the date, lift type,
 * and the best recorded weight for each rep range at the hovered data point.
 *
 * @param {Object} props
 * @param {boolean} props.active - Whether the tooltip is currently active (provided by Recharts).
 * @param {Array} props.payload - Recharts payload array for the hovered data point.
 * @param {*} props.label - Recharts label value (unused; date is read from payload).
 * @param {boolean} [props.isMetric] - When true, displays weights in kg; otherwise lb.
 */
export const VisualizerRepsTooltip = ({ active, payload, label, isMetric }) => {
  if (!active || !payload?.length) return null;
  // devLog(payload);
  const tuple = payload[0].payload;
  const dateLabel = getReadableDateString(tuple.date);

  // Extract liftType from the first available repsX_tuple
  const firstRepTuple = [
    tuple.reps1_tuple,
    tuple.reps3_tuple,
    tuple.reps5_tuple,
  ].find(Boolean);
  const liftType = firstRepTuple?.liftType;

  // Build info for singles, triples, fives
  const repInfos = [
    { label: "Single", reps: 1 },
    { label: "Triple", reps: 3 },
    { label: "Five", reps: 5 },
  ]
    .map((tab) => {
      const t = tuple[`reps${tab.reps}_tuple`];
      if (!t) return null;
      const { value: displayWeight, unit: displayUnit } = getDisplayWeight(t, isMetric ?? false);
      return {
        ...tab,
        weight: displayWeight,
        unitType: displayUnit,
        liftType: t.liftType, // Add liftType from the tuple
        color: getRepColor(tab.reps, payload[0].color),
        // Add more fields as needed
      };
    })
    .filter(Boolean);

  // devLog(tuple);

  return (
    <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-bold">
        <span>{dateLabel}</span>
        {liftType && (
          <div className="text-xs text-muted-foreground">{liftType}</div>
        )}
      </div>
      {repInfos.map((info) => (
        <div key={info.label} className="mb-1">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-row items-center">
              <div
                className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: info.color }}
              />
              <div className="font-semibold">{info.label}</div>
            </div>
            <div className="ml-4 whitespace-nowrap font-semibold">
              {typeof info.weight !== "undefined" && (
                <span>
                  {info.weight}
                  {info.unitType}
                </span>
              )}
            </div>
          </div>
          {info.rpe ? (
            <div className="ml-6 text-xs text-muted-foreground">
              RPE {info.rpe}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};
