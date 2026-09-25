/**
 * Converts parsed lift history into Recharts-ready E1RM time-series data.
 * Formula handling stays here so full visualizer and mini charts agree.
 *
 * shapeMiniE1rmSeries is progress-guide only. The full visualizer plots
 * processVisualizerData as-is. The mini chart uses the same series, then drops
 * one-off dips once the plotted history spans five years.
 */
import { estimateLiftE1RM } from "@/lib/estimate-e1rm";
import { devLog, logTiming, getDisplayWeight } from "@/lib/processing-utils";

export function processVisualizerData(
  parsedData,
  e1rmFormula,
  selectedLiftTypes,
  timeRange,
  isMetric = false,
  bodyWeight = null,
  bodyWeightIsDefault = true,
) {
  if (!Array.isArray(parsedData) || parsedData.length === 0) {
    return { dataset: [], weightMax: 0, weightMin: 0 };
  }

  const startTime = performance.now();

  const dataMap = new Map(); // A per date mapping of the best lift per lifttype on that date

  let weightMax = 0;
  let weightMin = 1000;

  parsedData.forEach((lift) => {
    const { date, liftType, reps, isGoal, label } = lift;
    if (date < timeRange) return; // Skip if date out of range of chart
    if (isGoal) return; // FIXME: implement goal dashed lines at some point

    // Skip if the lift type is not selected
    if (selectedLiftTypes && !selectedLiftTypes.includes(liftType)) {
      return;
    }

    const { value: displayWeight, unit: displayUnit } = getDisplayWeight(
      lift,
      isMetric,
    );
    const oneRepMax = Math.round(
      estimateLiftE1RM({
        reps,
        weight: displayWeight,
        equation: e1rmFormula,
        liftType,
        bodyWeight: bodyWeightIsDefault ? null : bodyWeight,
        bodyWeightUnitType: isMetric ? "kg" : "lb",
        liftUnitType: displayUnit,
      }),
    );

    if (!dataMap.has(date)) {
      dataMap.set(date, {});
    }
    const liftData = dataMap.get(date);

    if (weightMax < oneRepMax) weightMax = oneRepMax;
    if (displayWeight < weightMin) weightMin = displayWeight;

    // Check if this is the best lift oneRepMax for this date and if so store it
    if (!liftData[liftType] || oneRepMax > liftData[liftType]) {
      liftData[liftType] = oneRepMax;
      liftData.displayUnit = displayUnit;
      liftData[`${liftType}_reps`] = reps;
      liftData[`${liftType}_weight`] = displayWeight;
      if (label) {
        liftData.label = label;
        devLog(`Special user label inserted: ${label} (date: ${date})`);
      }
    }
  });

  // Convert to recharts date oriented array of data tuples
  const dataset = [];
  dataMap.forEach((lifts, date) => {
    // Parse the YYYY-MM-DD parts directly — new Date("YYYY-MM-DD") is UTC midnight,
    // and local getters on it give the previous calendar day in USA/EU timezones.
    const [y, m, d] = date.split("-").map(Number);
    dataset.push({
      date,
      ...lifts,
      rechartsDate: Date.UTC(y, m - 1, d),
    });
  });
  // devLog(`${dataset.length} points of chart data`);

  logTiming("processVisualizerData", performance.now() - startTime);

  return { dataset, weightMax, weightMin };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Well under both neighbors: a light day, not a new level. Ordinary
// session-to-session noise (a few percent) stays on the line.
const ONE_OFF_DIP_RATIO = 0.85;
// One bad week, or a couple of light sessions close together. Past this,
// the low points agree with each other and the chart should show the dip.
const ONE_OFF_SPAN_MS = 21 * DAY_MS;
// The latest point has no session after it, so it cannot be proved a
// one-off. Only an absurd drop versus the last few months comes off,
// otherwise yesterday's ordinary light squat would vanish.
const ABSURD_TAIL_RATIO = 0.5;
const ABSURD_TAIL_LOOKBACK_MS = 90 * DAY_MS;

// A year or two is still about sessions, and that is the whole log for most
// lifters. All time is the default label, so the span of the points on screen
// decides, not the menu name.

/**
 * Shape the progress-guide E1RM line.
 *
 * A five-year area chart answers "how has my strength moved", and a one-off
 * light session is not an answer. The fill runs to the axis, so that session
 * draws a canyon. Tonnage keeps those dips on purpose: there the moving
 * average falling is the information. Here it is noise.
 *
 * One-off dips come off only when the points on screen cover five years. A
 * lighter day next to a heavy one stays: that is the week as it was trained.
 * A lighter stretch that lasts keeps its place.
 *
 * @param {Array} dataset - Rows from processVisualizerData, oldest first.
 * @param {string} liftType
 */
export function shapeMiniE1rmSeries(dataset, liftType) {
  if (!Array.isArray(dataset) || dataset.length === 0) return dataset ?? [];

  const points = dataset.filter((point) => Number.isFinite(point?.[liftType]));
  if (!plottedHistoryIsFiveYears(points)) {
    return points.length === dataset.length ? dataset : points;
  }
  return withoutOneOffDips(points, liftType);
}

// "Last 5 years" opens five years ago, so the first point inside it is
// usually a little later than that boundary. A month of slack lets a full
// five-year window count. Two years of history never reaches it, and neither
// does All time for someone whose whole log is a year.
function plottedHistoryIsFiveYears(points) {
  if (points.length < 2) return false;
  const first = points[0].date;
  const last = points[points.length - 1].date;
  if (!first || !last) return false;
  return first <= shiftIsoDate(last, -4, -11);
}

function shiftIsoDate(iso, years, months) {
  let year = Number(iso.slice(0, 4)) + years;
  let month = Number(iso.slice(5, 7)) + months;
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ];
  const day = Math.min(Number(iso.slice(8)), daysInMonth);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function withoutOneOffDips(points, liftType) {
  let kept = points;
  if (points.length >= 3) {
    for (let pass = 0; pass < points.length; pass++) {
      const next = dropShortDipRuns(
        dropIsolatedPoints(kept, liftType),
        liftType,
      );
      if (next.length === kept.length) break;
      kept = next;
    }
  }
  return dropAbsurdTail(kept, liftType);
}

// A point under both neighbors is a pothole. Repeating the pass lets a
// pair collapse: once one junk point goes, the one hiding behind it is
// exposed. Peaks are never removed.
function dropIsolatedPoints(points, liftType) {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(true);
  for (let i = 1; i < points.length - 1; i++) {
    const floor =
      ONE_OFF_DIP_RATIO *
      Math.min(points[i - 1][liftType], points[i + 1][liftType]);
    if (points[i][liftType] < floor) keep[i] = false;
  }
  return points.filter((_, i) => keep[i]);
}

// Several light sessions in the same bad week prop each other up, so the
// neighbor test misses them. Treat the whole short run as one dip when
// every point in it is under the sessions just outside it.
function dropShortDipRuns(points, liftType) {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(true);
  let i = 1;
  while (i < points.length - 1) {
    const leftValue = points[i - 1][liftType];
    if (points[i][liftType] >= leftValue * ONE_OFF_DIP_RATIO) {
      i++;
      continue;
    }

    let j = i;
    while (
      j < points.length &&
      points[j][liftType] < leftValue * ONE_OFF_DIP_RATIO
    ) {
      j++;
    }
    // A dip that runs off the right edge is a possible real decline into
    // today. The tail rule decides that, not this one.
    if (j >= points.length) break;

    const threshold =
      ONE_OFF_DIP_RATIO * Math.min(leftValue, points[j][liftType]);
    let allBelow = true;
    for (let k = i; k < j; k++) {
      if (points[k][liftType] >= threshold) {
        allBelow = false;
        break;
      }
    }
    const span = points[j - 1].rechartsDate - points[i].rechartsDate;
    if (allBelow && span <= ONE_OFF_SPAN_MS) {
      for (let k = i; k < j; k++) keep[k] = false;
    }
    i = j;
  }
  return points.filter((_, i) => keep[i]);
}

function dropAbsurdTail(points, liftType) {
  if (points.length < 2) return points;

  let end = points.length;
  while (end > 1) {
    const candidate = points[end - 1];
    let recentBest = 0;
    for (let i = end - 2; i >= 0; i--) {
      if (
        candidate.rechartsDate - points[i].rechartsDate >
        ABSURD_TAIL_LOOKBACK_MS
      )
        break;
      if (points[i][liftType] > recentBest) recentBest = points[i][liftType];
    }
    if (!(
      recentBest > 0 && candidate[liftType] < recentBest * ABSURD_TAIL_RATIO
    ))
      break;
    end -= 1;
  }

  if (end === points.length) return points;
  // A long stretch under half of recent strength is a collapse, not a
  // bad log. Put the whole tail back rather than trimming its tip.
  const span =
    points[points.length - 1].rechartsDate - points[end].rechartsDate;
  if (span > ONE_OFF_SPAN_MS) return points;
  return points.slice(0, end);
}

// Calculate January 1 of each year for label placement
export const getYearLabels = (data) => {
  if (!data || data.length === 0) return []; // Handle null or empty data
  const years = [];
  const startYear = parseInt(data[0].date.slice(0, 4), 10);
  const endYear = parseInt(data[data.length - 1].date.slice(0, 4), 10);

  for (let year = startYear; year <= endYear; year++) {
    const yearStart = new Date(`${year}-01-01`).getTime();
    years.push({ date: yearStart, label: year });
  }
  return years;
};
