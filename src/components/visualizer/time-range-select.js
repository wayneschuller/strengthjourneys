import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { format, subMonths } from "date-fns";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// These are the full period targets we will use for Visualizer chart time domains
// This allows us to offer time domains on the visualizer that match the user data
// The algorithm assumes each period is longer than the next
export const periodTargets = [
  {
    label: "Last 3 months",
    months: 3,
    shortLabel: "3M",
  },
  {
    label: "Last 6 months",
    months: 6,
    shortLabel: "6M",
  },
  {
    label: "Last year",
    months: 12,
    shortLabel: "1Y",
  },
  {
    label: "Last 2 years",
    months: 12 * 2,
    shortLabel: "2Y",
  },
  {
    label: "Last 5 years",
    months: 12 * 5,
    shortLabel: "5Y",
  },
  // All Time option will be pushed manually
];

/**
 * Dropdown to select the chart time range (e.g. 3 months, 1 year, All Time). Only shows
 * options that have data available. Used in Visualizer and lift pages.
 *
 * @param {Object} props
 * @param {string} props.timeRange - Current selection (e.g. "3M", "1Y", "MAX").
 * @param {function(string)} props.setTimeRange - Callback to update the selection.
 * @param {string} [props.liftType] - When set, only shows periods that contain at least one
 *   set of this lift, and that aren't entirely covered by an even shorter period. Avoids
 *   teasing the user with empty time ranges for low-frequency lifts.
 */
export function TimeRangeSelect({ timeRange, setTimeRange, liftType }) {
  const { parsedData } = useUserLiftingData();

  if (!Array.isArray(parsedData) || parsedData.length === 0) return null;

  const relevantData = liftType
    ? parsedData.filter((entry) => entry.liftType === liftType && !entry.isGoal)
    : parsedData;

  if (relevantData.length === 0) return null;

  // First/last lift date in "YYYY-MM-DD" format. parsedData is chronological,
  // and filter() preserves order, so first/last entries are the bounds.
  const firstDateStr = relevantData[0].date;

  let validSelectTimeDomains = [];

  periodTargets.forEach((period) => {
    const dateMonthsAgo = subMonths(new Date(), period.months);
    const thresholdDateStr = format(dateMonthsAgo, "yyyy-MM-dd");

    // Period must extend the user's history (data older than the threshold)
    // AND contain at least one set within the threshold window — otherwise the
    // option exists only to show an empty chart.
    if (firstDateStr >= thresholdDateStr) return;
    const hasDataInPeriod = relevantData.some((e) => e.date >= thresholdDateStr);
    if (!hasDataInPeriod) return;

    validSelectTimeDomains.push({
      label: period.label,
      shortLabel: period.shortLabel,
      timeRangeThreshold: thresholdDateStr,
    });
  });

  // Manually push "All Time" option every time
  validSelectTimeDomains.push({
    label: "All time",
    timeRangeThreshold: "1900-01-01",
    shortLabel: "MAX",
  });

  // devLog(validSelectTimeDomains);

  return (
    <Select value={timeRange} onValueChange={setTimeRange}>
      <SelectTrigger
        className="w-[160px] rounded-lg sm:ml-auto"
        aria-label="Select a value"
      >
        <SelectValue placeholder="All time" />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {validSelectTimeDomains.map((period) => (
          <SelectItem
            key={period.shortLabel}
            value={period.shortLabel}
            className="rounded-lg"
          >
            {period.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Snap a stored time-range preference to the smallest valid period for a given lift.
 * "Valid" = at least one logged set inside the window. Walks from the preferred period
 * upward through 3M → 6M → 1Y → 2Y → 5Y → MAX. Returns the preferred range untouched
 * if it already has data, or if there is no data to compare against.
 */
export function snapTimeRangeToData(parsedData, liftType, preferredRange) {
  if (preferredRange === "MAX") return "MAX";
  if (!Array.isArray(parsedData) || parsedData.length === 0) return preferredRange;

  const relevantData = liftType
    ? parsedData.filter((e) => e.liftType === liftType && !e.isGoal)
    : parsedData;
  if (relevantData.length === 0) return preferredRange;

  const startIdx = periodTargets.findIndex((p) => p.shortLabel === preferredRange);
  if (startIdx === -1) return preferredRange;

  for (let i = startIdx; i < periodTargets.length; i++) {
    const period = periodTargets[i];
    const dateMonthsAgo = subMonths(new Date(), period.months);
    const thresholdDateStr = format(dateMonthsAgo, "yyyy-MM-dd");
    if (relevantData.some((e) => e.date >= thresholdDateStr)) {
      return period.shortLabel;
    }
  }
  return "MAX";
}

// Calculate start YYYY-MM-DD for the user desired time range for chart
export const calculateThresholdDate = (timeRange, setTimeRange) => {
  if (timeRange === "MAX") {
    return "1900-01-01"; // "All Time"
  }

  const period = periodTargets.find((p) => p.shortLabel === timeRange);
  if (!period) {
    setTimeRange("MAX"); // This might trigger rerender but whatever
    return "1900-01-01";
  }

  const dateMonthsAgo = subMonths(new Date(), period.months);
  return format(dateMonthsAgo, "yyyy-MM-dd");
};

// Used in the chart card description
export const getTimeRangeDescription = (timeRange, parsedData) => {
  if (!Array.isArray(parsedData) || parsedData.length === 0) return null;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-based index, January is 0

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  let timeRangeDate = new Date(timeRange);
  if (timeRange === "1900-01-01") {
    // Special case for the "All Time" category
    timeRangeDate = new Date(parsedData[0].date); // Use first user data date for "All Time" option
  }

  let month = timeRangeDate.getMonth();
  let year = timeRangeDate.getFullYear();

  return `${monthNames[month]} ${year !== currentYear ? `${year}` : ""} - ${monthNames[currentMonth]} ${currentYear}`;
};
