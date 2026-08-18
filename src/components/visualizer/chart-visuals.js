/**
 * Shared visual language for the time-series lifting charts (E1RM and tonnage).
 *
 * Gradients, glow layers, axis styling and tick rules live here so the charts
 * read as one family instead of drifting apart, and so a polish tweak lands on
 * every chart at once. Everything is expressed with theme tokens or the caller's
 * lift color because the app ships ten themes (light/dark plus blueprint,
 * starry-night, retro-arcade and neo-brutalism variants).
 */
import { ReferenceDot, ReferenceLine } from "recharts";

// Muted token rather than a hardcoded grey so axis furniture stays legible in every theme.
const AXIS_TEXT_COLOR = "var(--muted-foreground)";

// Line spacing for multi-line inline labels, exported so callers can offset a
// stacked label upward by the right amount.
export const LABEL_LINE_HEIGHT = 14;

/**
 * Vertical fill gradient for an area series. Three stops instead of two: a
 * punchy band just under the line, then a quick fade to nothing at the baseline.
 * The fast falloff matters on the E1RM chart, where a heavy fill would smother
 * the strength-standard bands behind it.
 */
export function ChartAreaGradient({ id, color }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.5} />
      <stop offset="30%" stopColor={color} stopOpacity={0.1} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  );
}

/**
 * Soft halo for a series: a blurred copy of the shape merged underneath the
 * crisp original, so the line reads sharp but bleeds light into the background.
 *
 * Applied straight to the series' own `filter` prop. Note a second stroke-only
 * <Area> can't be used for this — Recharts keys series by dataKey, so a
 * duplicate key silently replaces the real series instead of layering under it.
 */
export function ChartGlowFilter({ id, blur = 3 }) {
  return (
    <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation={blur} result="glowBlur" />
      <feMerge>
        <feMergeNode in="glowBlur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

/**
 * Horizontal gradient for strength-standard background bands. The tint builds
 * toward the right so the band's own label anchors it and the left side of the
 * plot stays clean instead of a flat wash of color.
 */
export function ChartBandGradient({ id, color }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor={color} stopOpacity={0.03} />
      <stop offset="100%" stopColor={color} stopOpacity={0.16} />
    </linearGradient>
  );
}

// Dotted rather than solid so the grid recedes behind the data. Opacity is left
// alone — the shadcn chart CSS already strokes gridlines with --border, and
// fading that further made the lines vanish in the light themes.
export const CHART_GRID_PROPS = {
  vertical: false,
  strokeDasharray: "2 6",
};

// Shared axis furniture: no axis lines or tick ticks, muted small labels.
export const CHART_AXIS_PROPS = {
  axisLine: false,
  tickLine: false,
  tickMargin: 8,
  tick: { fill: AXIS_TEXT_COLOR, fontSize: 11 },
};

/**
 * Hover crosshair tinted with the series color instead of the Recharts default
 * purple, which clashed with every theme.
 */
export function chartCursorProps(color) {
  return {
    stroke: color,
    strokeOpacity: 0.45,
    strokeWidth: 1.5,
    strokeDasharray: "4 4",
  };
}

/**
 * Hover dot for a series: filled with the series color and ringed in the card
 * background so it stays visible over the area fill.
 */
export function chartActiveDotProps(color) {
  return {
    r: 5,
    fill: color,
    stroke: "var(--background)",
    strokeWidth: 2,
  };
}

/**
 * Time axis configuration chosen from how much time the chart covers.
 *
 * Beyond a few months we place ticks on month boundaries ourselves rather than
 * letting Recharts pick from session dates. Session-derived ticks gave uneven,
 * arbitrary labels ("Aug 23 Sep 24 Oct 19 Nov 11..."), and twenty of them
 * crowded the axis. Month starts at a computed step read as a deliberate ruler.
 *
 * Returns the axis props separately from `axisShowsYears`, because the caller
 * spreads the props straight onto <XAxis> and Recharts should not be handed keys
 * it doesn't understand.
 *
 * @param {Array} chartData - Rows carrying a `rechartsDate` epoch ms field.
 * @returns {{axisProps: Object, axisShowsYears: boolean}} `axisShowsYears` is
 *   true once the step is a year or more and the tick labels are years
 *   themselves — the year dividers must then drop their own labels to avoid
 *   printing every year twice.
 */
export function getDateTickProps(chartData) {
  const first = chartData?.[0]?.rechartsDate;
  const last = chartData?.[chartData.length - 1]?.rechartsDate;
  const spanDays = first && last ? (last - first) / (1000 * 60 * 60 * 24) : 0;

  // Short ranges keep day-level detail — every session still reads distinctly.
  if (spanDays <= 120) {
    return {
      axisShowsYears: false,
      axisProps: {
        minTickGap: 36,
        tickFormatter: (tickItem) =>
          new Date(tickItem).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
          }),
      },
    };
  }

  // Smallest month step that keeps the axis to roughly a dozen labels. Twelve
  // rather than ten so a five- or six-year view still gets month names (Jan/Jul)
  // instead of jumping straight to bare years; minTickGap thins them further on
  // narrow screens anyway.
  const spanMonths = spanDays / 30.44;
  const monthStep =
    [1, 2, 3, 6, 12, 24, 60].find((step) => spanMonths / step <= 12) ?? 60;

  // Past about five years the step reaches a whole year, and a month name would
  // repeat ("Jan Jan Jan"), so the ticks become years instead.
  const axisShowsYears = monthStep >= 12;

  const ticks = [];
  const cursor = new Date(first);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  // Anchor multi-month steps to January so the labels land on the same months
  // each year instead of drifting with wherever the data happens to start.
  cursor.setMonth(Math.floor(cursor.getMonth() / monthStep) * monthStep);
  while (cursor.getTime() <= last) {
    if (cursor.getTime() >= first) ticks.push(cursor.getTime());
    cursor.setMonth(cursor.getMonth() + monthStep);
  }

  return {
    axisShowsYears,
    axisProps: {
      ticks,
      minTickGap: 24,
      tickFormatter: (tickItem) =>
        new Date(tickItem).toLocaleString(
          "en-US",
          axisShowsYears ? { year: "numeric" } : { month: "short" },
        ),
    },
  };
}

/**
 * Weight axis formatter that switches to "12k" style above 10,000 so big
 * tonnage numbers don't crowd the axis.
 */
export function formatWeightTick(value, unit = "") {
  if (Math.abs(value) >= 10000) return `${Math.round(value / 1000)}k${unit}`;
  return `${value}${unit}`;
}

/**
 * Small coloured label that sits inside the plot area — strength standards,
 * bodyweight multiples, the peak marker.
 *
 * These float over the area fill, the tinted bands and their own dashed line,
 * where plain coloured text at 11px was hard to read. The background-coloured
 * stroke drawn underneath the glyphs (paint-order: stroke) knocks out whatever
 * is behind each letter, so the label keeps its colour and still reads cleanly.
 *
 * @param {Object} props
 * @param {number} props.x - Text anchor x in chart coordinates.
 * @param {number} props.y - Baseline y of the first line, in chart coordinates.
 * @param {string} props.color - Fill colour for the glyphs.
 * @param {string} [props.textAnchor] - SVG text-anchor, defaults to "end".
 * @param {number} [props.fontWeight] - Bump it to mark a label as the important
 *   one in a set of otherwise identical labels.
 * @param {string[]} [props.lines] - Renders one tspan per entry, stacked
 *   downward. Callers stacking lines above a point need to raise `y` themselves
 *   by LABEL_LINE_HEIGHT per extra line.
 */
export function ChartInlineLabel({
  x,
  y,
  color,
  textAnchor = "end",
  fontWeight = 600,
  lines,
  children,
}) {
  const rows = lines ?? [children];

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fontSize={12}
      fontWeight={fontWeight}
      stroke="var(--background)"
      strokeWidth={3.5}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={{ fill: color }}
    >
      {rows.length > 1
        ? rows.map((line, i) => (
            <tspan key={`${i}-${line}`} x={x} dy={i === 0 ? 0 : LABEL_LINE_HEIGHT}>
              {line}
            </tspan>
          ))
        : rows[0]}
    </text>
  );
}

/**
 * Picks the best few points in a series, spread out so they read as separate
 * climbs rather than one crowded summit — this is what replaced the old dense
 * "Show Values" toggle. Labelling every session was fine for a few months but
 * buried the line over years of data; labelling only the largest few is
 * useless too, since a plain "N largest values" pick lands on neighbouring
 * points of the same peak week.
 *
 * Each candidate must clear a minimum separation from the points already
 * chosen before it can be added. Separation is a slice of the visible time
 * span — clamped to a week at the short end and six months at the long end —
 * so the marks stay spread on a 3-month view without demanding years of gap on
 * an all-time view.
 *
 * @param {Array} data - Chart rows in chronological order, each carrying a
 *   `rechartsDate` epoch ms field.
 * @param {function} getValue - (row) => number|null|undefined
 * @param {Object} [options]
 * @param {number} [options.count] - Maximum number of points to return. A
 *   ceiling, not a guarantee — a short range with few sessions, or one
 *   dominated by a single spike, simply returns fewer.
 * @returns {Array<{point: Object, index: number, value: number, rank: number}>}
 *   Ranked highest (rank 0) to lowest.
 */
export function selectTopPoints(data, getValue, { count = 5 } = {}) {
  if (!data?.length) return [];

  const DAY_MS = 24 * 60 * 60 * 1000;
  const spanMs = data[data.length - 1].rechartsDate - data[0].rechartsDate;
  const separationMs = Math.min(Math.max(spanMs / 12, 7 * DAY_MS), 180 * DAY_MS);

  const ranked = data
    .map((point, index) => ({ point, index, value: getValue(point) }))
    .filter((candidate) => candidate.value != null)
    // Ties break towards the earlier session — that's the day it was earned.
    .sort((a, b) => b.value - a.value || a.index - b.index);

  const chosen = [];
  for (const candidate of ranked) {
    if (chosen.length === count) break;
    const clear = chosen.every(
      (taken) =>
        Math.abs(candidate.point.rechartsDate - taken.point.rechartsDate) >=
        separationMs,
    );
    if (clear) chosen.push(candidate);
  }

  return chosen.map((candidate, rank) => ({ ...candidate, rank }));
}

/**
 * Renders the ranked markers from selectTopPoints. The winner gets a filled pin
 * with a breathing halo; the rest get smaller open rings, so the hierarchy is
 * readable at a glance. ReferenceDot sits at a zIndex above the series, so
 * these always draw over the area fill and any reference bands.
 *
 * @param {Object} props
 * @param {Array} props.topPoints - Output of selectTopPoints.
 * @param {string} props.color - Marker colour, and the winner's label colour;
 *   runners-up render their ring in this colour but drop their label to muted
 *   foreground so the winner stays visually dominant.
 * @param {function} props.getLines - ({ point, value, rank, isWinner }) =>
 *   string[]. One or more lines to stack above the marker — e.g. a rep@weight
 *   line above the E1RM estimate it produced.
 * @param {number} [props.labelOffset] - Extra px lifted above the marker, on
 *   top of the usual clearance. Two markers from *different* series can land
 *   close together in both time and value — selectTopPoints only keeps a
 *   series' own points apart, it has no view of any other series being drawn
 *   alongside it — so a multi-series chart should stagger each series by a
 *   different offset (e.g. its index among the selected series) to keep their
 *   label stacks from colliding. Single-series charts can ignore this.
 * @param {string} [props.labelColor] - Overrides the default foreground/muted
 *   label colour with `color` (or any colour the caller passes). A chart with
 *   one series doesn't need this — foreground already reads as "the" line —
 *   but once several series share a plot, same-coloured labels can't be
 *   traced back to their line. Pass the series' own colour there so a label
 *   matches its marker the same way the line and legend already do.
 */
export function TopPointMarkers({
  topPoints,
  color,
  getLines,
  labelOffset = 0,
  labelColor,
}) {
  if (!topPoints?.length) return null;

  return (
    <>
      <ReferenceDot
        x={topPoints[0].point.rechartsDate}
        y={topPoints[0].value}
        r={9}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={0.45}
        className="animate-pulse"
      />
      {topPoints.map(({ point, value, rank }) => {
        const isWinner = rank === 0;
        const lines = getLines({ point, value, rank, isWinner });
        return (
          <ReferenceDot
            key={`top-${rank}`}
            x={point.rechartsDate}
            y={value}
            r={isWinner ? 4.5 : 3.5}
            // The winner is filled and ringed in the foreground so it reads as a
            // pin in every theme; the runners-up are open circles, present but
            // clearly secondary.
            fill={isWinner ? color : "var(--background)"}
            stroke={isWinner ? "var(--foreground)" : color}
            strokeWidth={isWinner ? 1.5 : 2}
            label={{
              content: ({ viewBox }) => (
                <ChartInlineLabel
                  x={viewBox.x + viewBox.width / 2}
                  // Stacked labels grow downward from the first line, so lift the
                  // whole block to keep the last line clear of the marker.
                  y={
                    viewBox.y -
                    (isWinner ? 12 : 10) -
                    (lines.length - 1) * LABEL_LINE_HEIGHT -
                    labelOffset
                  }
                  textAnchor="middle"
                  // Foreground rather than the series colour, which is too dark
                  // to read against the dark themes. Runners-up drop to muted to
                  // keep the winner dominant. labelColor overrides both when the
                  // caller needs labels traceable back to their series.
                  color={
                    labelColor ??
                    (isWinner ? "var(--foreground)" : "var(--muted-foreground)")
                  }
                  fontWeight={isWinner ? 700 : 600}
                  lines={lines}
                />
              ),
            }}
          />
        );
      })}
    </>
  );
}

/**
 * XAxis `domain` padding: a [minFn, maxFn] pair that extends the visible range
 * a few days past the first/last session, so the edge points don't draw flush
 * against the plot border. Every time-series chart here pads identically, but
 * each had grown its own copy — one written as Date arithmetic, one as raw
 * milliseconds — so this is the one to reach for instead of a third variant.
 *
 * @param {number} [days] - Padding on each side, in days.
 * @returns {[function, function]} Recharts domain functions: (dataMin) => …,
 *   (dataMax) => ….
 */
export function paddedDateDomain(days = 2) {
  const paddingMs = days * 24 * 60 * 60 * 1000;
  return [(dataMin) => dataMin - paddingMs, (dataMax) => dataMax + paddingMs];
}

/**
 * Builds the `getLines` callback TopPointMarkers needs for an E1RM chart series
 * — shared because the single-lift and multi-lift E1RM charts both mark their
 * ranked sessions the same way and had copied this verbatim between them.
 *
 * A multi-rep session only ever charted an *estimate*, so the line above the
 * marker names the actual set that produced it (e.g. "5@115kg"), with the
 * estimate itself on the line below. A single is already its own estimate, so
 * it gets one line.
 *
 * @param {string} liftType - Which lift's `${liftType}_reps` / `_weight`
 *   fields to read off each chart point (set by processVisualizerData).
 * @returns {function} ({ point, value }) => string[]
 */
export function e1rmMarkerLines(liftType) {
  return ({ point, value }) => {
    const unit = point.displayUnit || "";
    const reps = point[`${liftType}_reps`];
    const weight = point[`${liftType}_weight`];
    return reps > 1 && weight != null
      ? [`${reps}@${weight}${unit}`, `${value}${unit}`]
      : [`${value}${unit}`];
  };
}

/**
 * Chooses which points get a value label when "Show Values" is on. Used by the
 * standalone all-lifts tonnage page, which has no natural "ranked peaks" reading
 * across different lift types the way a single-lift chart does — see
 * selectTopPoints for that alternative, used on the per-lift charts instead.
 *
 * Labelling every point is fine for a few months of sessions but unreadable over
 * years — a thousand overlapping numbers bury the very line they annotate. Past a
 * threshold we spend a fixed budget of labels on the points that carry the most
 * information, in priority order:
 *
 *   1. the latest session, the number people look for first
 *   2. every new running best, which is the progression story
 *   3. evenly spaced fill, so a flat or declining stretch still gets numbers
 *
 * Every candidate has to clear a minimum spacing from the labels already placed,
 * so nothing stacks.
 *
 * @param {Array} data - Chart rows in chronological order.
 * @param {function} getValue - (row) => number|null|undefined
 * @param {number} [maxDense] - Above this many points, switch to selective mode.
 * @param {Iterable<number>} [reservedIndices] - Points that already carry their
 *   own annotation and should never get a value label, though neighbouring
 *   labels still keep clear of them.
 * @returns {Set<number>} Indices of rows that should be labelled.
 */
export function selectValueLabelIndices(
  data,
  getValue,
  maxDense = 24,
  reservedIndices = [],
) {
  const n = data?.length ?? 0;
  if (!n) return new Set();

  const values = data.map((row) => getValue(row));
  const reserved = new Set(
    [...reservedIndices].filter((i) => i >= 0 && i < n),
  );

  // Small datasets keep labelling everything, which is what the toggle has
  // always done and is still readable at a few months of sessions.
  if (n <= maxDense) {
    const all = new Set();
    values.forEach((value, i) => {
      if (value != null && !reserved.has(i)) all.add(i);
    });
    return all;
  }

  // Spacing is counted in points rather than pixels: real pixel positions only
  // exist inside the label renderer. Both charts plot one point per session, so
  // point spacing tracks the time axis closely enough for this.
  const minGap = Math.ceil(n / maxDense);

  // Reserved points are seeded into the placed list so the spacing rule keeps
  // other labels away from their annotations, then dropped from the result.
  const chosen = [...reserved];
  const fits = (i) =>
    values[i] != null && chosen.every((j) => Math.abs(i - j) >= minGap);

  // 1. Latest session.
  for (let i = n - 1; i >= 0; i--) {
    if (values[i] == null) continue;
    if (fits(i)) chosen.push(i);
    break;
  }

  // 2. Running bests, walked newest first so that when records cluster the
  //    surviving label is the later, higher one.
  const records = [];
  let runningMax = -Infinity;
  values.forEach((value, i) => {
    if (value == null || value <= runningMax) return;
    runningMax = value;
    records.push(i);
  });
  for (let k = records.length - 1; k >= 0 && chosen.length < maxDense; k--) {
    if (fits(records[k])) chosen.push(records[k]);
  }

  // 3. Sweep left to right filling any remaining gap that clears the spacing
  //    rule, until the budget runs out. A fixed stride was tempting here, but it
  //    lands next to the labels already placed and gets rejected, leaving a flat
  //    stretch with half the labels it has room for.
  for (let i = 0; i < n && chosen.length < maxDense; i++) {
    if (fits(i)) chosen.push(i);
  }

  const result = new Set(chosen);
  reserved.forEach((i) => result.delete(i));
  return result;
}

/**
 * Faint dashed verticals at each January 1, with the year beneath them. Turns the
 * old floating year text into a deliberate timeline divider.
 *
 * Returned as an array (not a component) because Recharts only recognises
 * ReferenceLine as a direct child of the chart.
 *
 * @param {Array} yearLabels - [{ date, label }] from getYearLabels.
 * @param {boolean} [showLabels] - Pass false when the x axis is already printing
 *   years (see getDateTickProps' axisShowsYears). The lines still divide the
 *   decade, but a second row of identical years is just clutter.
 */
export function renderYearDividers(yearLabels, showLabels = true) {
  if (!yearLabels?.length) return null;

  return yearLabels.map(({ date, label }) => (
    <ReferenceLine
      key={`year-${date}`}
      x={date}
      stroke={AXIS_TEXT_COLOR}
      strokeOpacity={0.25}
      strokeDasharray="3 7"
      label={
        showLabels
          ? {
              value: label,
              position: "insideBottom",
              fontSize: 12,
              fill: AXIS_TEXT_COLOR,
              opacity: 0.8,
            }
          : undefined
      }
    />
  ));
}
