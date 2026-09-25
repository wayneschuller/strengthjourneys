/**
 * Builds the lifting summary the AI assistant sends with each message.
 *
 * Written for a language model to read, not for a parser: every figure is
 * labelled in plain words, sets are always weight×reps, recent dates carry
 * "N days ago", and comparisons the model would otherwise get wrong (is this
 * a best? how does it rank against the standards? how many sessions a week?)
 * are worked out here. A short header states the conventions once.
 *
 * Pure function of the lifter's data and choices, so it runs in the browser
 * and the page can show the exact text in the Personalize dialog.
 */

import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getStrengthRatingForE1RM } from "@/hooks/use-athlete-biodata";
import { processConsistency } from "@/lib/consistency";
import { MAX_CHAT_METADATA_CHARS } from "@/lib/ai/chat-metadata-limit";

// The last 20 sessions, counted rather than dated, so the summary stays the
// same size whether someone trains daily or weekly: three sessions a week
// covers about six weeks, one a week covers about five months.
const RECENT_SESSION_COUNT = 20;
// Safety net for sessions with many lifts: session blocks stop at this many
// characters, newest first, so they never crowd the other sections out.
const RECENT_SESSIONS_MAX_CHARS = 7000;
const MAIN_LIFT_LIMIT = 6;
const WEEKS_OF_SESSION_COUNTS = 12;
const BIG_FOUR = ["Back Squat", "Bench Press", "Deadlift", "Strict Press"];
const LB_PER_KG = 2.2046;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * @param {Object} args
 * @param {import("@/lib/data-sources/import-dispatcher").ParsedData} args.parsedData Sorted by date, oldest first.
 * @param {{ liftType: string }[]} [args.liftTypes] Lift names, most frequent first.
 * @param {{ records?: boolean, trainingLoad?: boolean, frequency?: boolean, consistency?: boolean, sessionData?: boolean }} args.options
 * @param {{ age: number, sex: string, bodyWeight: number, heightCm: number } | null} args.bio Null when the profile is not shared.
 * @param {boolean} args.isMetric The lifter's preferred unit; every weight is shown in it.
 * @param {Object} [args.standards] Per-lift standards in the preferred unit, for the lifter's age, sex and bodyweight.
 * @param {string} [args.e1rmFormula]
 * @param {string} args.today The lifter's local date, YYYY-MM-DD.
 * @returns {string}
 */
export function buildLiftingContext({
  parsedData,
  liftTypes = [],
  options = {},
  bio = null,
  isMetric,
  standards = {},
  e1rmFormula = "Brzycki",
  today,
}) {
  const unit = isMetric ? "kg" : "lb";
  const entries = (parsedData ?? []).filter(
    (entry) => !entry.isGoal && entry.date && entry.liftType && entry.reps > 0,
  );
  const hasTraining =
    entries.length > 0 &&
    (options.records ||
      options.trainingLoad ||
      options.frequency ||
      options.consistency ||
      options.sessionData);

  if (!bio && !hasTraining) return "";

  const ctx = {
    unit,
    today,
    e1rmFormula,
    toUnit: (entry) => convertWeight(entry.weight, entry.unitType, unit),
  };
  const latestDate = entries.at(-1)?.date ?? null;
  const lifts = hasTraining ? summarizeLifts(entries, ctx) : {};
  const mainLifts = hasTraining
    ? pickMainLifts({ entries, lifts, liftTypes, latestDate })
    : [];

  const sections = [
    buildAboutSection({ ctx, options, bio, latestDate, hasTraining }),
    bio && buildProfileSection(bio, unit),
    bio && hasTraining && options.records &&
      buildStandingSection({ mainLifts, lifts, standards, ctx }),
    hasTraining &&
      (options.records || options.frequency) &&
      buildLiftsSection({ mainLifts, lifts, options, ctx }),
    hasTraining && options.consistency &&
      buildConsistencySection({ entries, parsedData, ctx }),
    hasTraining && options.trainingLoad &&
      buildTrainingLoadSection({ entries, mainLifts, ctx }),
    hasTraining && options.sessionData &&
      buildRecentSessionsSection({ entries, lifts, mainLifts, ctx }),
    bio && buildStandardsSection({ mainLifts, standards, unit }),
  ];

  return combineSections(sections, MAX_CHAT_METADATA_CHARS);
}

// -----------------------------------------------------------------------------
// Sections
// -----------------------------------------------------------------------------

function buildAboutSection({ ctx, options, bio, latestDate, hasTraining }) {
  const shared = [
    bio && "profile",
    hasTraining && options.records && "records and e1RM trends",
    hasTraining && options.frequency && "lift history",
    hasTraining && options.consistency && "consistency",
    hasTraining && options.trainingLoad && "training load",
    hasTraining && options.sessionData && "recent sessions",
  ].filter(Boolean);

  return section("about this data", [
    `Today is ${ctx.today} (${WEEKDAYS[parseDate(ctx.today).getUTCDay()]}), the lifter's local date.`,
    latestDate &&
      `Latest logged session: ${formatDate(latestDate, ctx.today)}.`,
    `All weights are in ${ctx.unit}. Sets are written weight×reps: 160×1 is one rep at 160${ctx.unit}. Repeated identical sets show a count: 100×5 (3 sets).`,
    `"Best N-rep set" is the heaviest set of exactly N reps ever logged, not a tested max, so a best 5-rep set can be heavier than a best 3-rep set when heavy triples were never done.`,
    `e1RM is an estimated one-rep max from a single set (${ctx.e1rmFormula} formula); comparing e1RMs is the fairest way to compare sets with different reps.`,
    `Tonnage is weight × reps added up over a session.`,
    `Shared by the lifter: ${shared.join(", ") || "nothing"}. Anything not listed was not shared.`,
  ]);
}

function buildProfileSection(bio, unit) {
  return section("profile", [
    `Age ${bio.age}, ${bio.sex}, bodyweight ${bio.bodyWeight}${unit}, height ${bio.heightCm}cm.`,
  ]);
}

function buildStandingSection({ mainLifts, lifts, standards, ctx }) {
  const lines = mainLifts
    .map((liftType) => {
      const standard = standards?.[liftType];
      const best12m = lifts[liftType]?.bestE1RM12m;
      if (!standard || !best12m) return null;
      const rating = getStrengthRatingForE1RM(best12m.e1rm, standard);
      return `${liftType}: ${rating} (best e1RM in the last 12 months ${best12m.e1rm}${ctx.unit}, from ${formatSet(best12m.set)} on ${formatDate(best12m.set.date, ctx.today)}).`;
    })
    .filter(Boolean);

  if (lines.length === 0) return "";
  return section("strength level for age, sex and bodyweight", lines);
}

function buildLiftsSection({ mainLifts, lifts, options, ctx }) {
  const blocks = mainLifts.map((liftType) => {
    const lift = lifts[liftType];
    const lines = [liftType];

    if (options.frequency) {
      lines.push(
        `  Last trained ${formatDate(lift.lastDate, ctx.today)}. Sessions with this lift: ${lift.sessions6w} in the last 6 weeks, ${lift.sessionsPrev6w} in the 6 weeks before. Logged since ${lift.firstDate}.`,
      );
    }

    if (options.records) {
      lines.push(
        `  Best sets all time: ${formatBestSets(lift.bestByRepsAll, lift.bestE1RMAll, ctx)}.`,
        `  Best sets in the last 12 months: ${formatBestSets(lift.bestByReps12m, lift.bestE1RM12m, ctx)}.`,
        `  Best e1RM: all time ${formatE1RMPoint(lift.bestE1RMAll, ctx)}; last 12 months ${formatE1RMPoint(lift.bestE1RM12m, ctx)}; last 6 weeks ${formatE1RMPoint(lift.bestE1RM6w, ctx)}; the 6 weeks before ${formatE1RMPoint(lift.bestE1RMPrev6w, ctx)}.`,
        `  Best e1RM by month, oldest to newest: ${formatMonthlyE1RM(lift.monthlyE1RM, ctx)}.`,
      );
    }

    return lines.join("\n");
  });

  return section("main lifts", blocks);
}

function buildConsistencySection({ entries, parsedData, ctx }) {
  const lines = [];

  const weekly = countSessionsByWeek(entries, ctx.today, WEEKS_OF_SESSION_COUNTS);
  if (weekly.length > 0) {
    lines.push(
      `Sessions per week, weeks starting Monday, newest first: ${weekly
        .map(
          ({ weekStart, count, isCurrent }) =>
            `${formatShortDate(weekStart)} ${count}${isCurrent ? " (this week, in progress)" : ""}`,
        )
        .join("; ")}.`,
    );
  }

  // Up to two years, plus the longest window as the whole-history view.
  const allPeriods = processConsistency(parsedData) ?? [];
  const consistency = allPeriods.filter(
    (period, index) =>
      period.periodDays <= 730 || index === allPeriods.length - 1,
  );
  consistency.forEach(
    ({ label, actualWorkouts, targetWorkouts, periodDays, gradedDays, isPartiallyTracked, percentage }) => {
      const graded = isPartiallyTracked
        ? `, graded over the ${gradedDays} days since the log began`
        : "";
      lines.push(
        `${label} (last ${periodDays} days): ${actualWorkouts} sessions against a target of ${targetWorkouts}${graded}, ${percentage}% of target.`,
      );
    },
  );

  if (lines.length === 0) return "";
  return section(
    "consistency (target is about three sessions a week)",
    lines,
  );
}

function buildTrainingLoadSection({ entries, mainLifts, ctx }) {
  const cutoff12m = shiftDate(ctx.today, -365);
  const sessionTotals = new Map();
  const liftSessionTotals = new Map();

  entries.forEach((entry) => {
    if (entry.date < cutoff12m) return;
    const tonnage = ctx.toUnit(entry) * entry.reps;
    sessionTotals.set(entry.date, (sessionTotals.get(entry.date) ?? 0) + tonnage);
    if (!mainLifts.includes(entry.liftType)) return;
    const byDate = liftSessionTotals.get(entry.liftType) ?? new Map();
    byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + tonnage);
    liftSessionTotals.set(entry.liftType, byDate);
  });

  if (sessionTotals.size === 0) return "";

  const lines = [];
  const totals = [...sessionTotals.values()].sort((a, b) => a - b);
  const [latestDate, latestTotal] = [...sessionTotals.entries()].at(-1);
  lines.push(
    `Whole sessions, all lifts: latest ${round(latestTotal)}${ctx.unit} on ${formatDate(latestDate, ctx.today)}; 12-month average ${round(average(totals))}${ctx.unit} per session; typical range ${round(percentile(totals, 0.25))}-${round(percentile(totals, 0.75))}${ctx.unit} (middle half of sessions).`,
  );

  mainLifts.forEach((liftType) => {
    const byDate = liftSessionTotals.get(liftType);
    if (!byDate || byDate.size === 0) return;
    const values = [...byDate.values()];
    const [lastDate, lastTotal] = [...byDate.entries()].at(-1);
    const [bestDate, bestTotal] = [...byDate.entries()].reduce((best, current) =>
      current[1] > best[1] ? current : best,
    );
    lines.push(
      `${liftType} only: latest ${round(lastTotal)}${ctx.unit} on ${formatDate(lastDate, ctx.today)}; 12-month average ${round(average(values))}${ctx.unit} per session with this lift; biggest ${round(bestTotal)}${ctx.unit} on ${formatDate(bestDate, ctx.today)}.`,
    );
  });

  return section("training load (tonnage), last 12 months", lines);
}

function buildRecentSessionsSection({ entries, lifts, mainLifts, ctx }) {
  const byDate = new Map();
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!byDate.has(entry.date)) {
      if (byDate.size >= RECENT_SESSION_COUNT) break;
      byDate.set(entry.date, []);
    }
    byDate.get(entry.date).unshift(entry);
  }

  const blocks = [];
  let chars = 0;
  for (const [date, sessionEntries] of byDate) {
    const block = formatSessionBlock(date, sessionEntries, lifts, mainLifts, ctx);
    if (chars + block.length + 1 > RECENT_SESSIONS_MAX_CHARS) break;
    blocks.push(block);
    chars += block.length + 1;
  }

  if (blocks.length === 0) return "";
  return section(
    `last ${blocks.length} sessions, newest first, every set in logged order`,
    blocks,
  );
}

function buildStandardsSection({ mainLifts, standards, unit }) {
  const lines = mainLifts
    .map((liftType) => {
      const levels = standards?.[liftType];
      if (!levels) return null;
      const parts = ["beginner", "intermediate", "advanced", "elite"]
        .filter((level) => levels[level])
        .map((level) => `${level} ${Math.round(levels[level])}`);
      return parts.length ? `${liftType}: ${parts.join(", ")}` : null;
    })
    .filter(Boolean);

  if (lines.length === 0) return "";
  return section(`strength standards as e1RM in ${unit}, for this lifter`, lines);
}

// -----------------------------------------------------------------------------
// Per-lift summaries, from one pass over the log
// -----------------------------------------------------------------------------

function summarizeLifts(entries, ctx) {
  const cutoff12m = shiftDate(ctx.today, -365);
  const cutoff6w = shiftDate(ctx.today, -42);
  const cutoff12w = shiftDate(ctx.today, -84);
  const firstMonth = shiftMonth(ctx.today.slice(0, 7), -11);
  const lifts = {};

  entries.forEach((entry) => {
    const lift = (lifts[entry.liftType] ??= {
      firstDate: entry.date,
      lastDate: entry.date,
      sessionDates: new Set(),
      bestByRepsAll: {},
      bestByReps12m: {},
      monthlyE1RM: {},
      bestE1RMAll: null,
      bestE1RM12m: null,
      bestE1RM6w: null,
      bestE1RMPrev6w: null,
    });

    const weight = ctx.toUnit(entry);
    const set = { weight, reps: entry.reps, date: entry.date };
    const e1rm = estimateE1RM(entry.reps, weight, ctx.e1rmFormula);

    lift.lastDate = entry.date;
    lift.sessionDates.add(entry.date);
    keepHeaviest(lift.bestByRepsAll, set);
    lift.bestE1RMAll = keepBestE1RM(lift.bestE1RMAll, set, e1rm);

    if (entry.date >= cutoff12m) {
      keepHeaviest(lift.bestByReps12m, set);
      lift.bestE1RM12m = keepBestE1RM(lift.bestE1RM12m, set, e1rm);
    }
    if (entry.date >= cutoff6w) {
      lift.bestE1RM6w = keepBestE1RM(lift.bestE1RM6w, set, e1rm);
    } else if (entry.date >= cutoff12w) {
      lift.bestE1RMPrev6w = keepBestE1RM(lift.bestE1RMPrev6w, set, e1rm);
    }

    const month = entry.date.slice(0, 7);
    if (month >= firstMonth) {
      lift.monthlyE1RM[month] = keepBestE1RM(lift.monthlyE1RM[month], set, e1rm);
    }
  });

  Object.values(lifts).forEach((lift) => {
    const dates = [...lift.sessionDates];
    lift.sessions6w = dates.filter((date) => date >= cutoff6w).length;
    lift.sessionsPrev6w = dates.filter(
      (date) => date >= cutoff12w && date < cutoff6w,
    ).length;
  });

  return lifts;
}

/** Lifts from the latest session first, then the big four, then the most logged. */
function pickMainLifts({ entries, lifts, liftTypes, latestDate }) {
  const picked = [];
  const add = (liftType) => {
    if (!liftType || picked.includes(liftType) || !lifts[liftType]) return;
    picked.push(liftType);
  };

  entries
    .filter((entry) => entry.date === latestDate)
    .forEach((entry) => add(entry.liftType));
  BIG_FOUR.forEach(add);
  liftTypes.forEach(({ liftType }) => add(liftType));

  return picked.slice(0, MAIN_LIFT_LIMIT);
}

function keepHeaviest(bestByReps, set) {
  const current = bestByReps[set.reps];
  if (!current || set.weight > current.weight) bestByReps[set.reps] = set;
}

function keepBestE1RM(current, set, e1rm) {
  const isBetter =
    !current ||
    e1rm > current.e1rm ||
    (e1rm === current.e1rm && set.weight > current.set.weight);
  return isBetter ? { e1rm, set } : current;
}

// -----------------------------------------------------------------------------
// Session blocks
// -----------------------------------------------------------------------------

/**
 * One session, lift by lift. e1RMs and best-set notes only for main lifts:
 * for carries and accessories they would be noise.
 */
function formatSessionBlock(date, sessionEntries, lifts, mainLifts, ctx) {
  const byLift = new Map();
  sessionEntries.forEach((entry) => {
    if (!byLift.has(entry.liftType)) byLift.set(entry.liftType, []);
    byLift.get(entry.liftType).push(entry);
  });

  const lines = [formatDate(date, ctx.today)];
  let sessionTonnage = 0;

  byLift.forEach((liftEntries, liftType) => {
    const sets = liftEntries.map((entry) => ({
      weight: ctx.toUnit(entry),
      reps: entry.reps,
    }));
    const tonnage = sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
    sessionTonnage += tonnage;
    const summary = [
      `${sets.length} ${sets.length === 1 ? "set" : "sets"}`,
      `${round(tonnage)}${ctx.unit}`,
    ];
    let highlights = "";
    if (mainLifts.includes(liftType)) {
      const bestE1RM = Math.max(
        ...sets.map((set) => estimateE1RM(set.reps, set.weight, ctx.e1rmFormula)),
      );
      summary.push(`best e1RM ${bestE1RM}${ctx.unit}`);
      highlights = describeHighlights(liftType, liftEntries, lifts, ctx);
    }

    lines.push(
      `  ${liftType}: ${collapseSets(sets)}. ${summary.join(", ")}.${highlights}`,
    );
  });

  if (byLift.size > 1) {
    lines.push(`  Session total ${round(sessionTonnage)}${ctx.unit}.`);
  }
  return lines.join("\n");
}

/** Notes a set that was, when lifted, the heaviest ever or in 12 months for its rep count. */
function describeHighlights(liftType, liftEntries, lifts, ctx) {
  const lift = lifts[liftType];
  if (!lift) return "";
  const notes = [];

  liftEntries.forEach((entry) => {
    const weight = ctx.toUnit(entry);
    const allTime = lift.bestByRepsAll[entry.reps];
    const year = lift.bestByReps12m[entry.reps];
    const label = entry.reps === 1 ? "single" : `${entry.reps}-rep set`;
    if (allTime && allTime.date === entry.date && allTime.weight === weight) {
      notes.push(`${formatSet({ weight, reps: entry.reps })} is the best ${label} ever logged`);
    } else if (year && year.date === entry.date && year.weight === weight) {
      notes.push(`${formatSet({ weight, reps: entry.reps })} is the best ${label} in 12 months`);
    }
  });

  const unique = [...new Set(notes)];
  return unique.length ? ` ${unique.join("; ")}.` : "";
}

function collapseSets(sets) {
  const groups = [];
  sets.forEach((set) => {
    const last = groups.at(-1);
    if (last && last.weight === set.weight && last.reps === set.reps) {
      last.count += 1;
    } else {
      groups.push({ ...set, count: 1 });
    }
  });
  return groups
    .map(({ weight, reps, count }) =>
      `${formatNumber(weight)}×${reps}${count > 1 ? ` (${count} sets)` : ""}`,
    )
    .join(", ");
}

// -----------------------------------------------------------------------------
// Weekly counts
// -----------------------------------------------------------------------------

function countSessionsByWeek(entries, today, weeks) {
  const currentWeekStart = startOfWeek(today);
  const oldestWeekStart = shiftDate(currentWeekStart, -7 * (weeks - 1));
  const counts = new Map();

  new Set(entries.map((entry) => entry.date)).forEach((date) => {
    if (date < oldestWeekStart || date > today) return;
    const weekStart = startOfWeek(date);
    counts.set(weekStart, (counts.get(weekStart) ?? 0) + 1);
  });

  return Array.from({ length: weeks }, (_, index) => {
    const weekStart = shiftDate(currentWeekStart, -7 * index);
    return {
      weekStart,
      count: counts.get(weekStart) ?? 0,
      isCurrent: index === 0,
    };
  });
}

// -----------------------------------------------------------------------------
// Formatting helpers
// -----------------------------------------------------------------------------

function section(title, lines) {
  const body = lines.filter(Boolean);
  if (body.length === 0) return "";
  return [`## ${title}`, ...body].join("\n");
}

/** Keeps whole sections, in order, while they fit; never cuts one mid-line. */
function combineSections(sections, maxChars) {
  const included = [];
  let length = 0;
  sections.filter(Boolean).forEach((text) => {
    const separator = included.length > 0 ? 2 : 0;
    if (length + separator + text.length > maxChars) return;
    included.push(text);
    length += separator + text.length;
  });
  return included.join("\n\n");
}

function formatSet(set) {
  return `${formatNumber(set.weight)}×${set.reps}`;
}

// A best N-rep set this far below the period's best e1RM is a warm-up (an
// empty bar for 10), not a working set, so it is left out.
const WORKING_SET_FLOOR = 0.7;

function formatBestSets(bestByReps, bestE1RM, ctx) {
  const floor = (bestE1RM?.e1rm ?? 0) * WORKING_SET_FLOOR;
  const parts = [1, 2, 3, 5, 8, 10]
    .filter(
      (reps) =>
        bestByReps[reps] &&
        estimateE1RM(reps, bestByReps[reps].weight, ctx.e1rmFormula) >= floor,
    )
    .map((reps) => {
      const set = bestByReps[reps];
      return `${formatSet(set)} on ${formatDate(set.date, ctx.today)}`;
    });
  return parts.join(", ") || "none";
}

function formatE1RMPoint(point, ctx) {
  if (!point) return "none";
  return `${point.e1rm}${ctx.unit} from ${formatSet(point.set)} on ${formatDate(point.set.date, ctx.today)}`;
}

function formatMonthlyE1RM(monthlyE1RM, ctx) {
  const months = listMonths(
    shiftMonth(ctx.today.slice(0, 7), -11),
    ctx.today.slice(0, 7),
  );
  return months
    .map((month) => {
      const point = monthlyE1RM[month];
      return `${formatMonth(month)} ${point ? point.e1rm : "not trained"}`;
    })
    .join(", ");
}

/** "2026-09-25 (Fri, 1 day ago)" within 60 days, otherwise just the date. */
function formatDate(date, today) {
  if (!date) return "unknown";
  const days = Math.round((parseDate(today) - parseDate(date)) / DAY_MS);
  if (days < 0 || days > 60) return date;
  const weekday = WEEKDAYS[parseDate(date).getUTCDay()];
  const ago = days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
  return `${date} (${weekday}, ${ago})`;
}

function formatShortDate(date) {
  const parsed = parseDate(date);
  return `${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCDate()}`;
}

function formatMonth(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${MONTHS[monthIndex - 1]} ${String(year).slice(2)}`;
}

function formatNumber(value) {
  return String(Math.round(value * 10) / 10);
}

function round(value) {
  return Math.round(value);
}

function convertWeight(weight, fromUnit, toUnit) {
  const value = Number(weight) || 0;
  if (!fromUnit || fromUnit === toUnit) return value;
  const converted = toUnit === "kg" ? value / LB_PER_KG : value * LB_PER_KG;
  return Math.round(converted * 2) / 2;
}

function average(values) {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

function percentile(sortedValues, fraction) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.floor(fraction * sortedValues.length),
  );
  return sortedValues[index];
}

// Dates are "YYYY-MM-DD" strings; the math is done in UTC so a timezone can
// never shift a day.
function parseDate(date) {
  return new Date(`${date}T00:00:00Z`);
}

function shiftDate(date, days) {
  const parsed = parseDate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const day = parseDate(date).getUTCDay();
  return shiftDate(date, -((day + 6) % 7));
}

function shiftMonth(month, delta) {
  const [year, monthIndex] = month.split("-").map(Number);
  const total = year * 12 + (monthIndex - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function listMonths(from, to) {
  const months = [];
  for (let month = from; month <= to; month = shiftMonth(month, 1)) {
    months.push(month);
  }
  return months;
}
