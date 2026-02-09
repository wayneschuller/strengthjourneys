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
 */
export function TimeRangeSelect({ timeRange, setTimeRange }) {
  const { parsedData } = useUserLiftingData();

  if (!parsedData) return null;

  // This is the first date in "YYYY-MM-DD" format
  // FIXME: Should we find the first date for selected lifts only?
  const firstDateStr = parsedData[0].date;

  const todayStr = format(new Date(), "yyyy-MM-dd"); // Local date, not UTC

  let validSelectTimeDomains = [];

  periodTargets.forEach((period) => {
    const dateMonthsAgo = subMonths(new Date(), period.months);
    const thresholdDateStr = format(dateMonthsAgo, "yyyy-MM-dd");

    if (firstDateStr < thresholdDateStr) {
      validSelectTimeDomains.push({
        label: period.label,
        shortLabel: period.shortLabel,
        timeRangeThreshold: thresholdDateStr,
      });
    }
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
  if (!parsedData) return null;

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
