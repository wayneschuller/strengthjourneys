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
 *
 * Speed: nothing here walks the whole log. Records come from the pipeline's
 * PR tables (topLiftsByTypeAndReps), tonnage from its session lookup, and
 * first/last dates from liftTypes; only the recent tail (the last 12 months,
 * or the last 20 sessions if those reach further back) is scanned, once.
 * Step timings go to the console in the same grouped format as the main
 * processing pipeline.
 */

import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getStrengthRatingForE1RM } from "@/lib/lifting-standards-kg";
import { processConsistency } from "@/lib/consistency";
import { MAX_CHAT_METADATA_CHARS } from "@/lib/ai/chat-metadata-limit";
import { logTimingGroup } from "@/lib/processing-utils";

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
 * @param {{ liftType: string, oldestDate: string, newestDate: string }[]} [args.liftTypes] From calculateLiftTypes, most frequent first.
 * @param {Object} [args.topLiftsByTypeAndReps] Pipeline PR table, all time.
 * @param {Object} [args.topLiftsByTypeAndRepsLast12Months] Pipeline PR table, last 12 months.
 * @param {Object} [args.sessionTonnageLookup] Pipeline per-session tonnage lookup.
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
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
  sessionTonnageLookup,
  options = {},
  bio = null,
  isMetric,
  standards = {},
  e1rmFormula = "Brzycki",
  today,
}) {
  const timings = [];
  const step = (name, run) => {
    const startTime = performance.now();
    const result = run();
    timings.push({ name, ms: performance.now() - startTime });
    return result;
  };

  const unit = isMetric ? "kg" : "lb";
  const ctx = {
    unit,
    today,
    e1rmFormula,
    toUnit: (entry) => convertWeight(entry.weight, entry.unitType, unit),
  };

  const wantsTraining =
    options.records ||
    options.trainingLoad ||
    options.frequency ||
    options.consistency ||
    options.sessionData;
  const tail = wantsTraining
    ? step("Recent tail", () => getRecentTail(parsedData, today))
    : [];
  const hasTraining = tail.length > 0;
  if (!bio && !hasTraining) return "";

  const latestDate = tail.at(-1)?.date ?? null;
  const mainLifts = hasTraining
    ? pickMainLifts({ tail, liftTypes, latestDate })
    : [];
  const lifts = hasTraining
    ? step("Lift summaries", () =>
        summarizeLifts({
          tail,
          mainLifts,
          liftTypes,
          topAll: topLiftsByTypeAndReps,
          top12m: topLiftsByTypeAndRepsLast12Months,
          ctx,
        }),
      )
    : {};

  const sections = [
    buildAboutSection({ ctx, options, bio, latestDate, hasTraining }),
    bio && buildProfileSection(bio, unit),
    bio && hasTraining && options.records &&
      buildStandingSection({ mainLifts, lifts, standards, ctx }),
    hasTraining &&
      (options.records || options.frequency) &&
      step("Main lifts", () =>
        buildLiftsSection({ mainLifts, lifts, options, ctx }),
      ),
    hasTraining && options.consistency &&
      step("Consistency", () =>
        buildConsistencySection({ tail, parsedData, mainLifts, ctx }),
      ),
    hasTraining && options.trainingLoad &&
      step("Training load", () =>
        buildTrainingLoadSection({ sessionTonnageLookup, mainLifts, ctx }),
      ),
    hasTraining && options.sessionData &&
      step("Recent sessions", () =>
        buildRecentSessionsSection({ tail, lifts, mainLifts, ctx }),
      ),
    bio && buildStandardsSection({ mainLifts, standards, unit }),
  ];

  const text = combineSections(sections, MAX_CHAT_METADATA_CHARS);
  // Only once there is training data: before the log loads, builds are empty
  // and would just be noise in the console.
  if (hasTraining) logTimingGroup("\u{1F916} AI Coach Context", timings, {
    summary: `${text.length} chars, ${tail.length} recent sets`,
  });
  return text;
}

/**
 * Valid sets from the recent end of the log, oldest first: the last 12
 * months, extended back to cover the last 20 sessions for lifters who train
 * rarely. Walks backwards from the newest row and stops as soon as both are
 * covered, so a long history costs nothing extra.
 */
function getRecentTail(parsedData, today) {
  if (!parsedData?.length) return [];
  const cutoff12m = shiftDate(today, -365);
  const tail = [];
  let sessionCount = 0;
  let previousDate = null;

  for (let i = parsedData.length - 1; i >= 0; i -= 1) {
    const entry = parsedData[i];
    if (!entry.date) continue;
    if (entry.date !== previousDate) {
      if (entry.date < cutoff12m && sessionCount >= RECENT_SESSION_COUNT) break;
      previousDate = entry.date;
      sessionCount += 1;
    }
    if (entry.isGoal || !entry.liftType || !(entry.reps > 0)) continue;
    tail.push(entry);
  }

  return tail.reverse();
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
      `Latest logged session: ${latestDate}, ${daysAgo(latestDate, ctx.today)}.`,
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
      if (!standard || !(best12m?.e1rm > 0)) return null;
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
      const bestAll = formatBestSets(lift.bestByRepsAll, lift.bestE1RMAll, ctx);
      const best12m = formatBestSets(lift.bestByReps12m, lift.bestE1RM12m, ctx);
      // Under a year of history makes all-time and 12-month bests the same;
      // say so once rather than twice.
      lines.push(
        bestAll === best12m
          ? `  Best sets, all time and last 12 months alike: ${bestAll}.`
          : `  Best sets all time: ${bestAll}.\n  Best sets in the last 12 months: ${best12m}.`,
      );
      const e1rmAll = formatE1RMPoint(lift.bestE1RMAll, ctx);
      const e1rm12m = formatE1RMPoint(lift.bestE1RM12m, ctx);
      // No e1RM story for a lift only ever done at bodyweight.
      if (lift.bestE1RMAll?.e1rm > 0) lines.push(
        `  Best e1RM: ${e1rmAll === e1rm12m ? `all time and last 12 months ${e1rmAll}` : `all time ${e1rmAll}; last 12 months ${e1rm12m}`}; last 6 weeks ${formatE1RMPoint(lift.bestE1RM6w, ctx)}; the 6 weeks before ${formatE1RMPoint(lift.bestE1RMPrev6w, ctx)}.`,
        `  Best e1RM by month, oldest to newest: ${formatMonthlyE1RM(lift.monthlyE1RM, lift.firstDate, ctx)}.`,
      );
    }

    return lines.join("\n");
  });

  return section("main lifts", blocks);
}

function buildConsistencySection({ tail, parsedData, mainLifts, ctx }) {
  const lines = [];

  // "Review my month" is the most common ask, and models miscount sessions
  // from a list of dates, so count this calendar month outright.
  const monthStart = `${ctx.today.slice(0, 7)}-01`;
  const monthDates = new Set();
  const monthDatesByLift = new Map();
  for (let i = tail.length - 1; i >= 0 && tail[i].date >= monthStart; i -= 1) {
    const { date, liftType } = tail[i];
    monthDates.add(date);
    const dates = monthDatesByLift.get(liftType) ?? new Set();
    dates.add(date);
    monthDatesByLift.set(liftType, dates);
  }
  const perLift = mainLifts
    .map((liftType) => `${liftType} ${monthDatesByLift.get(liftType)?.size ?? 0}`)
    .join(", ");
  lines.push(
    `This calendar month so far (${formatShortDate(monthStart)} to ${formatShortDate(ctx.today)}): ${monthDates.size} ${monthDates.size === 1 ? "session" : "sessions"}. Sessions with each main lift: ${perLift}.`,
  );

  const weekly = countSessionsByWeek(tail, ctx.today, WEEKS_OF_SESSION_COUNTS);
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

/** Reads the pipeline's session tonnage lookup; walks only the last year of session dates. */
function buildTrainingLoadSection({ sessionTonnageLookup, mainLifts, ctx }) {
  const {
    allSessionDates = [],
    sessionTonnageByDate = {},
    sessionTonnageByDateAndLift = {},
  } = sessionTonnageLookup ?? {};
  const cutoff12m = shiftDate(ctx.today, -365);
  // Tonnage is stored per unit; fold any other unit into the preferred one.
  const inUnit = (byUnit) =>
    Object.entries(byUnit ?? {}).reduce(
      (sum, [unitType, tonnage]) =>
        sum + convertWeight(tonnage, unitType, ctx.unit),
      0,
    );

  const sessionTotals = [];
  const liftTotals = new Map(mainLifts.map((liftType) => [liftType, []]));
  for (let i = allSessionDates.length - 1; i >= 0; i -= 1) {
    const date = allSessionDates[i];
    if (date < cutoff12m) break;
    sessionTotals.push([date, inUnit(sessionTonnageByDate[date])]);
    const byLift = sessionTonnageByDateAndLift[date] ?? {};
    liftTotals.forEach((totals, liftType) => {
      if (byLift[liftType]) totals.push([date, inUnit(byLift[liftType])]);
    });
  }

  if (sessionTotals.length === 0) return "";

  // Newest first, as walked.
  const [latestDate, latestTotal] = sessionTotals[0];
  const sorted = sessionTotals.map(([, total]) => total).sort((a, b) => a - b);
  const lines = [
    `Whole sessions, all lifts: latest ${round(latestTotal)}${ctx.unit} on ${formatDate(latestDate, ctx.today)}; 12-month average ${round(average(sorted))}${ctx.unit} per session; typical range ${round(percentile(sorted, 0.25))}-${round(percentile(sorted, 0.75))}${ctx.unit} (middle half of sessions).`,
  ];

  liftTotals.forEach((totals, liftType) => {
    // Bodyweight lifts logged at 0 have no tonnage worth reporting.
    if (!totals.some(([, total]) => total > 0)) return;
    const [lastDate, lastTotal] = totals[0];
    const [bestDate, bestTotal] = totals.reduce((best, current) =>
      current[1] > best[1] ? current : best,
    );
    lines.push(
      `${liftType} only: latest ${round(lastTotal)}${ctx.unit} on ${formatDate(lastDate, ctx.today)}; 12-month average ${round(average(totals.map(([, total]) => total)))}${ctx.unit} per session with this lift; biggest ${round(bestTotal)}${ctx.unit} on ${formatDate(bestDate, ctx.today)}.`,
    );
  });

  return section("training load (tonnage), last 12 months", lines);
}

function buildRecentSessionsSection({ tail, lifts, mainLifts, ctx }) {
  const byDate = new Map();
  for (let i = tail.length - 1; i >= 0; i -= 1) {
    const entry = tail[i];
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
// Per-lift summaries: records from the PR tables, trends from the recent tail
// -----------------------------------------------------------------------------

function summarizeLifts({ tail, mainLifts, liftTypes, topAll, top12m, ctx }) {
  const cutoff6w = shiftDate(ctx.today, -42);
  const cutoff12w = shiftDate(ctx.today, -84);
  const firstMonth = shiftMonth(ctx.today.slice(0, 7), -11);
  const liftInfo = new Map(liftTypes.map((info) => [info.liftType, info]));
  const lifts = {};

  mainLifts.forEach((liftType) => {
    const bestByRepsAll = readBestSets(topAll?.[liftType], ctx);
    const bestByReps12m = readBestSets(top12m?.[liftType], ctx);
    lifts[liftType] = {
      firstDate: liftInfo.get(liftType)?.oldestDate ?? null,
      lastDate: liftInfo.get(liftType)?.newestDate ?? null,
      bestByRepsAll,
      bestByReps12m,
      bestE1RMAll: bestE1RMOf(bestByRepsAll, ctx),
      bestE1RM12m: bestE1RMOf(bestByReps12m, ctx),
      monthlyE1RM: {},
      bestE1RM6w: null,
      bestE1RMPrev6w: null,
      sessionDates6w: new Set(),
      sessionDatesPrev6w: new Set(),
    };
  });

  tail.forEach((entry) => {
    const lift = lifts[entry.liftType];
    if (!lift || entry.date < firstMonth) return;
    const weight = ctx.toUnit(entry);
    const set = { weight, reps: entry.reps, date: entry.date };
    const e1rm = estimateE1RM(entry.reps, weight, ctx.e1rmFormula);

    const month = entry.date.slice(0, 7);
    lift.monthlyE1RM[month] = keepBestE1RM(lift.monthlyE1RM[month], set, e1rm);
    if (entry.date >= cutoff6w) {
      lift.bestE1RM6w = keepBestE1RM(lift.bestE1RM6w, set, e1rm);
      lift.sessionDates6w.add(entry.date);
    } else if (entry.date >= cutoff12w) {
      lift.bestE1RMPrev6w = keepBestE1RM(lift.bestE1RMPrev6w, set, e1rm);
      lift.sessionDatesPrev6w.add(entry.date);
    }
  });

  Object.values(lifts).forEach((lift) => {
    lift.sessions6w = lift.sessionDates6w.size;
    lift.sessionsPrev6w = lift.sessionDatesPrev6w.size;
  });

  return lifts;
}

/** Best set for 1 to 10 reps, from a PR table row (index 0 is 1 rep, best first). */
function readBestSets(repArrays, ctx) {
  const bestByReps = {};
  (repArrays ?? []).forEach((ranked, index) => {
    const best = ranked?.[0];
    if (!best) return;
    bestByReps[index + 1] = {
      weight: ctx.toUnit(best),
      reps: index + 1,
      date: best.date,
    };
  });
  return bestByReps;
}

function bestE1RMOf(bestByReps, ctx) {
  return Object.values(bestByReps).reduce(
    (best, set) =>
      keepBestE1RM(best, set, estimateE1RM(set.reps, set.weight, ctx.e1rmFormula)),
    null,
  );
}

/**
 * The lifts to summarise, from the 12 weeks up to the latest session (so a
 * lapsed lifter is judged on their last block, not an empty recent past):
 * big four lifts trained in that window first, then other lifts by how many
 * sessions they appeared in, ties to the most recently trained. Then any big
 * four ever logged, then the most logged lifts. One accessory-heavy session
 * can no longer push the main lifts out.
 */
function pickMainLifts({ tail, liftTypes, latestDate }) {
  const known = new Set(liftTypes.map(({ liftType }) => liftType));
  const windowStart = latestDate ? shiftDate(latestDate, -83) : null;
  const sessionsByLift = new Map();
  const lastDateByLift = new Map();

  for (let i = tail.length - 1; i >= 0; i -= 1) {
    const { date, liftType } = tail[i];
    if (date < windowStart) break;
    const dates = sessionsByLift.get(liftType) ?? new Set();
    dates.add(date);
    sessionsByLift.set(liftType, dates);
    if (!lastDateByLift.has(liftType)) lastDateByLift.set(liftType, date);
  }

  const isBigFour = (liftType) => (BIG_FOUR.includes(liftType) ? 1 : 0);
  const ranked = [...sessionsByLift.keys()].sort(
    (a, b) =>
      isBigFour(b) - isBigFour(a) ||
      sessionsByLift.get(b).size - sessionsByLift.get(a).size ||
      lastDateByLift.get(b).localeCompare(lastDateByLift.get(a)),
  );

  const picked = [];
  const add = (liftType) => {
    if (!liftType || picked.includes(liftType)) return;
    if (known.size > 0 && !known.has(liftType)) return;
    picked.push(liftType);
  };
  ranked.forEach(add);
  BIG_FOUR.forEach((liftType) => known.has(liftType) && add(liftType));
  liftTypes.forEach(({ liftType }) => add(liftType));

  return picked.slice(0, MAIN_LIFT_LIMIT);
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
      tonnage > 0 && `${round(tonnage)}${ctx.unit}`,
    ].filter(Boolean);
    let highlights = "";
    if (mainLifts.includes(liftType)) {
      const bestE1RM = Math.max(
        ...sets.map((set) => estimateE1RM(set.reps, set.weight, ctx.e1rmFormula)),
      );
      if (bestE1RM > 0) summary.push(`best e1RM ${bestE1RM}${ctx.unit}`);
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

  // Warm-ups can hold odd rep-count bests (an empty bar for 9); skip anything
  // well below the lift's working weights.
  const floor = (lift.bestE1RM12m?.e1rm ?? 0) * WORKING_SET_FLOOR;

  liftEntries.forEach((entry) => {
    const weight = ctx.toUnit(entry);
    if (estimateE1RM(entry.reps, weight, ctx.e1rmFormula) < floor) return;
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
      `${formatWeight(weight)}×${reps}${count > 1 ? ` (${count} sets)` : ""}`,
    )
    .join(", ");
}

// -----------------------------------------------------------------------------
// Weekly counts
// -----------------------------------------------------------------------------

function countSessionsByWeek(tail, today, weeks) {
  const currentWeekStart = startOfWeek(today);
  const oldestWeekStart = shiftDate(currentWeekStart, -7 * (weeks - 1));
  const counts = new Map();

  new Set(tail.map((entry) => entry.date)).forEach((date) => {
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
  return `${formatWeight(set.weight)}×${set.reps}`;
}

/** Bodyweight lifts are logged at 0 extra load. */
function formatWeight(weight) {
  return weight > 0 ? formatNumber(weight) : "bodyweight";
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

/** The last 12 months, starting no earlier than the month the lift was first logged. */
function formatMonthlyE1RM(monthlyE1RM, firstDate, ctx) {
  const yearAgo = shiftMonth(ctx.today.slice(0, 7), -11);
  const firstMonth = firstDate?.slice(0, 7);
  const months = listMonths(
    firstMonth && firstMonth > yearAgo ? firstMonth : yearAgo,
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
  return `${date} (${weekday}, ${daysAgo(date, today)})`;
}

function daysAgo(date, today) {
  const days = Math.round((parseDate(today) - parseDate(date)) / DAY_MS);
  return days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
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
