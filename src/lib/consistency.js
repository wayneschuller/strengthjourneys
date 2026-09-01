/**
 * Shared consistency analysis used across dashboard and AI features.
 * Keep the logic UI-free so dormant card components do not own active data processing.
 *
 * Every period grades the same thing: did you train three times a week across the
 * window, allowing the fortnight off a year that everybody takes? The window lengths below are true calendar lengths so a ring labelled
 * "Year" really does cover a year — the single exception is Week, which runs eight
 * days on purpose so one late session does not tank an otherwise solid week.
 *
 * A window wider than the log itself is graded only over the part the log covers,
 * so the oldest ring measures the lifter rather than the date they started logging.
 */
import {
  addDays,
  format,
  parseISO,
  subDays,
  differenceInCalendarDays,
} from "date-fns";
import {
  CONSISTENCY_GRADE_THRESHOLDS,
  TARGET_SESSIONS_PER_WEEK,
  getHoldSessionsPerWeek,
  getTargetSessions,
  isRestGrade,
} from "@/lib/consistency-grades";

const DAYS_PER_YEAR = 365.25;
// A rolling window sheds its oldest week every week. Seven days is the horizon we
// report on, because "what do I owe this week" is the only actionable version of it.
const ROLLING_HORIZON_DAYS = 7;
// The Week ring is itself a week long, so counting what rolls off it says nothing
// the ring has not already said. Every longer window gets the note.
const ROLLING_NOTE_MIN_PERIOD_DAYS = 30;
// Past a year the weekly arithmetic stops being advice. Telling someone to log two
// sessions to protect a ten year grade is technically true and completely the wrong
// scale, so these windows swap the sums for the long view.
const LONG_VIEW_MIN_PERIOD_DAYS = 400;

function subtractDays(dateStr, days) {
  const date = parseISO(dateStr);
  return format(subDays(date, days), "yyyy-MM-dd");
}

function addDaysTo(dateStr, days) {
  const date = parseISO(dateStr);
  return format(addDays(date, days), "yyyy-MM-dd");
}

function daysForYears(years) {
  return Math.round(years * DAYS_PER_YEAR);
}

// Window lengths are whole years by construction, so they round cleanly.
function formatWindowYears(days) {
  return Math.round(days / DAYS_PER_YEAR);
}

// A log is however long it is. Keep a decimal until the span is long enough that
// the decimal has stopped carrying any meaning.
function formatTrackedYears(days) {
  const years = days / DAYS_PER_YEAR;
  if (years >= 10) return String(Math.round(years));
  const rounded = Math.round(years * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const BASE_PERIOD_TARGETS = [
  { label: "Week", days: 8 }, // Seven days plus one grace day
  { label: "Month", days: 30 },
  { label: "3 Month", days: 91 }, // Exactly thirteen weeks
  { label: "Half Year", days: 182 }, // Exactly twenty-six weeks
  { label: "Year", days: 365 },
  { label: "24 Month", days: 730 },
  { label: "5 Year", days: daysForYears(5) },
];

function getRelevantPeriods(workoutRangeDays) {
  const relevantPeriods = [];

  for (let i = 0; i < BASE_PERIOD_TARGETS.length; i += 1) {
    relevantPeriods.push(BASE_PERIOD_TARGETS[i]);
    if (BASE_PERIOD_TARGETS[i].days > workoutRangeDays) {
      return relevantPeriods;
    }
  }

  for (let years = 10; years <= 100; years += 5) {
    const period = { label: `${years} Year`, days: daysForYears(years) };
    relevantPeriods.push(period);

    if (period.days > workoutRangeDays) {
      break;
    }
  }

  return relevantPeriods;
}

// Human phrasing for a period label, used by tooltips and detail panels so the UI
// never has to talk in raw day counts.
function getPeriodWindowLabel(label, days) {
  if (label === "Week" || label === "Month") return `Last ${days} days`;
  if (label === "Half Year") return "Last 6 months";
  if (label === "Year") return "Last 12 months";
  if (label === "24 Month") return "Last 2 years";

  const monthMatch = label.match(/^(\d+) Month$/);
  if (monthMatch) return `Last ${monthMatch[1]} months`;

  const yearMatch = label.match(/^(\d+) Year$/);
  if (yearMatch) return `Last ${yearMatch[1]} years`;

  return `Last ${days} days`;
}

function pluraliseSessions(count) {
  return count === 1 ? "session" : "sessions";
}

// --- Rolling window encouragement ---

// A window this wide moves forward as the calendar does, so a few of the oldest
// sessions in it fall behind the start line each week. That is worth saying, because
// it is what makes showing up this week matter. It is not worth saying as a threat,
// so every line below leads with what training buys rather than what skipping costs.
//
// Two registers. Up to a year the sums are actionable, so the copy does the sums:
// this many this week keeps it level, more climbs. Past a year they stop being
// advice and start being noise, so those windows drop the arithmetic and say the
// only thing that is actually true at that scale, which is that no week decides it.
//
// Five ways of saying each idea, so a row of nine rings does not read like one
// sentence printed nine times. The pick steps with the ring's position, so
// neighbours never land on the same wording, and the whole row is offset by the
// date, so it reads fresh tomorrow instead of reshuffling on every render.
function hashPhraseSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickPhrase(variants, rotation) {
  return variants[rotation % variants.length];
}

// --- Rest phrases ---

// A window with almost nothing in it draws a bed, and the bed gets to say something.
// Tone tracks the length of the gap, because one joke does not stretch across every
// scale. A week off is worth affirming, since that is where the adaptation happens.
// A month off earns a gentle ribbing. From a quarter onwards the odds that this is
// injury, illness or life rather than laziness get high enough that the right move
// is sincerity, so those windows share one set and talk about the long game instead.
const REST_MONTH_MIN_PERIOD_DAYS = 30;
const REST_LONG_MIN_PERIOD_DAYS = 91;

const REST_WEEK_PHRASES = [
  `A week off. Muscle is built between sessions, not during them, so this is the half nobody photographs.`,
  `Nothing logged, everything repairing. A rest week is when the last block turns into actual strength.`,
  `A blank week. Your fortnight a year is built into the target, so this one is already paid for.`,
  `Recovery week. Tendons and connective tissue heal slower than muscle, and they are using the time.`,
  `Zero sessions, full adaptation. The bar will feel better for it.`,
];

const REST_MONTH_PHRASES = [
  `A month off. Have you been running? Blink twice if you have been running.`,
  `Thirty days, no barbell. If somebody has talked you into a parkrun, we can still fix this.`,
  `A quiet month. Cardio is fine. Cardio is a perfectly fine thing that other people do.`,
  `One month in bed. The good news is muscle memory is real. The bad news is the bar remembers too.`,
  `A month off the tools. Somewhere your squat is telling people you two are still together.`,
];

const REST_LONG_PHRASES = [
  `A long quiet stretch. Nothing holds on to strength and bone with age like lifting does, and it restarts the moment you do.`,
  `Time away. Lifting was never about this window. It is about carrying your own shopping at eighty.`,
  `A long gap. Muscle is the tissue that shapes how you age, and it is remarkably willing to come back.`,
  `Quiet for a while. The lifters who last are not the ones who never stopped, they are the ones who always restarted.`,
  `A long rest. Nothing in your history is lost, and the first session back counts for more than any session you missed.`,
];

function getRestPhrases(periodDays) {
  if (periodDays < REST_MONTH_MIN_PERIOD_DAYS) return REST_WEEK_PHRASES;
  if (periodDays < REST_LONG_MIN_PERIOD_DAYS) return REST_MONTH_PHRASES;
  return REST_LONG_PHRASES;
}

// Sessions are moving out the back of the window this week, so this many keeps the
// grade level and anything past that raises it.
const ROLLING_PACE_PHRASES = [
  (count, sessions) =>
    `${count} ${sessions} this week and this grade stays right where you built it. Anything more climbs.`,
  (count, sessions) =>
    `This window rolls forward this week. Log ${count} ${sessions} to keep the grade level, more to lift it.`,
  (count, sessions) =>
    `Match ${count} ${sessions} this week and the grade stays yours. Beat it and it climbs.`,
  (count, sessions) =>
    `The pace this grade sits at is ${count} ${sessions} a week. Go past it and it rises.`,
  (count, sessions) =>
    `Hold this grade with ${count} ${sessions} this week. Every one after that builds it higher.`,
];

// Nothing falls behind the start line in the next seven days, so the whole week is
// upside. This is the best news a ring can carry, so it gets to sound like it.
const ROLLING_CLEAR_PHRASES = [
  () =>
    `Nothing rolls off this window this week, so every session you log lifts this grade.`,
  () =>
    `Clear run ahead. Nothing leaves this window for seven days, so anything you log is gain.`,
  () =>
    `A free week for this ring. Nothing drops out, so every session moves it up.`,
  () =>
    `No ground to make up this week. Everything between now and next week is pure upside.`,
  () =>
    `This window loses nothing over the next seven days, so the grade has only one direction to go.`,
];

// The log has not filled this window yet, so the window grows a week every week and
// takes its target with it. Holding the ratio means matching your own current rate.
const ROLLING_FILLING_PHRASES = [
  (holdRate, target) =>
    `This window is still filling. ${holdRate} a week keeps this grade, ${target} a week climbs it.`,
  (holdRate, target) =>
    `Still filling out. ${holdRate} a week holds this grade, ${target} a week takes it higher.`,
  (holdRate, target) =>
    `The window grows as you do. ${holdRate} a week keeps this grade steady, ${target} builds it.`,
  (holdRate, target) =>
    `You are still writing this window. Keep ${holdRate} a week and the grade holds, ${target} a week lifts it.`,
  (holdRate, target) =>
    `Room left in this window. ${holdRate} a week keeps the grade where it is, ${target} a week moves it up.`,
];

// Past a year. No week moves a grade like this, and saying so is more honest and
// more encouraging than a target: a window this wide is the one place a bad month
// genuinely does not matter.
const LONG_VIEW_PHRASES = [
  (windowYears) =>
    `Nothing you do in one week moves ${windowYears} years of training, and that is exactly why this one is worth having.`,
  () =>
    `The long view. Grades out here answer to the years, not to any single week.`,
  (windowYears) =>
    `${windowYears} years averaged into one mark. It shifts when the habit shifts, and habits are slow.`,
  (windowYears) =>
    `Out this far the maths goes quiet. This is simply what ${windowYears} years of showing up looks like.`,
  (windowYears) =>
    `A ${windowYears}-year window has room for every bad month you have ever had. Keep showing up and it absorbs them.`,
];

// Past a year, and the log has not reached the back of it yet. The window is still
// growing into the lifter rather than the other way round, so there is nothing to
// chase: continuing is the whole instruction.
const LONG_VIEW_FILLING_PHRASES = [
  (trackedYears, windowYears) =>
    `You are ${trackedYears} years into a ${windowYears}-year window, and the rest of it is still ahead of you.`,
  () =>
    `This window reaches back further than your log does, so it fills in as you go. No hurry.`,
  (trackedYears) =>
    `Still growing into this one. ${trackedYears} years down, and the window keeps making room.`,
  (trackedYears, windowYears) =>
    `A ${windowYears}-year window with ${trackedYears} years of log in it. It improves simply by continuing.`,
  (trackedYears) =>
    `Out here the only instruction is to keep going. ${trackedYears} years so far, and the window grows with you.`,
];

// Same growing window, but already at the ceiling. There is no climb left to offer,
// so the line just says how good that is.
const ROLLING_FILLING_MAXED_PHRASES = [
  (target) =>
    `This window is still filling and you are filling it perfectly. ${target} a week keeps it there.`,
  (target) =>
    `Still growing, and still topped out. ${target} a week keeps it that way.`,
  (target) =>
    `Full marks with room left to fill. ${target} a week holds the top.`,
  (target) =>
    `You are keeping pace with a window that is still growing. ${target} a week keeps it perfect.`,
  (target) =>
    `Nothing left to catch up on here. ${target} a week keeps this maxed.`,
];

// Grades are A/B/C bands plus ".", so only the A band needs "an".
function indefiniteArticle(grade) {
  return grade.startsWith("A") ? "an" : "a";
}

// Sessions still needed to reach the next grade band, measured against the same
// rounded percentage the ring displays so the ring and its tooltip never disagree.
function calculateGradeJump(
  displayedPercentage,
  actualWorkouts,
  targetWorkouts,
) {
  if (targetWorkouts <= 0) return null;

  // CONSISTENCY_GRADE_THRESHOLDS is ordered highest-first, so a plain .find() for
  // "minProgress above where I am" always returned A+ and told a C- lifter to chase
  // a perfect score. Walk from the bottom instead to land on the very next band up.
  let nextThreshold = null;
  for (let i = CONSISTENCY_GRADE_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (CONSISTENCY_GRADE_THRESHOLDS[i].minProgress > displayedPercentage) {
      nextThreshold = CONSISTENCY_GRADE_THRESHOLDS[i];
      break;
    }
  }
  if (!nextThreshold) return null;

  const minWorkoutsForNextGrade = Math.ceil(
    (nextThreshold.minProgress * targetWorkouts) / 100,
  );

  return {
    grade: nextThreshold.grade,
    sessionsNeeded: Math.max(1, minWorkoutsForNextGrade - actualWorkouts),
  };
}

/**
 * Summarize training frequency into consistency bands for progressively larger periods.
 *
 * Each returned entry carries the raw counts as well as the derived detail the UI
 * needs (weekly rate, next grade, how much of the window your logged history
 * actually covers, what it costs to hold the grade for another week) so
 * presentation layers do not recompute any of it.
 *
 * @param {Array|null} parsedData
 * @returns {Array|null}
 */
export function processConsistency(parsedData) {
  if (!parsedData || parsedData.length === 0) return null;

  const today = format(new Date(), "yyyy-MM-dd");
  const firstTrainingDate = parsedData[0].date;
  const workoutRangeDays = differenceInCalendarDays(
    parseISO(today),
    parseISO(firstTrainingDate),
  );

  const relevantPeriods = getRelevantPeriods(workoutRangeDays);

  const periodStartDates = relevantPeriods.map((period) => ({
    label: period.label,
    startDate: subtractDays(today, period.days - 1),
  }));

  const periodDates = relevantPeriods.reduce((acc, period) => {
    acc[period.label] = new Set();
    return acc;
  }, {});

  const oldestStartDate =
    periodStartDates[periodStartDates.length - 1].startDate;

  for (let i = parsedData.length - 1; i >= 0; i -= 1) {
    const entryDate = parsedData[i].date;
    // Data is date-ascending, so the first entry older than the widest window
    // means every remaining entry is too old to count anywhere.
    if (entryDate < oldestStartDate) break;
    if (parsedData[i].isGoal) continue;

    for (let j = periodStartDates.length - 1; j >= 0; j -= 1) {
      if (entryDate < periodStartDates[j].startDate) break;
      periodDates[periodStartDates[j].label].add(entryDate);
    }
  }

  const dayPhraseOffset = hashPhraseSeed(today);

  return relevantPeriods.map((period, periodIndex) => {
    const sessionDates = periodDates[period.label];
    const actualWorkouts = sessionDates.size;

    // The widest window always reaches further back than the logged history. Grading
    // it against the full span would cap it at a grade nobody could ever earn — the
    // lifter gets marked down for the years before they kept a log — so every window
    // is graded against the part of it the log actually covers. Floored at a week so
    // a two-day-old log cannot divide by a target of zero.
    const trackedDays = Math.min(period.days, workoutRangeDays + 1);
    const isPartiallyTracked = trackedDays < period.days;
    const gradedDays = Math.max(trackedDays, 7);

    const targetWorkouts = getTargetSessions(gradedDays);
    const rawPercentage = (actualWorkouts / targetWorkouts) * 100;
    const consistencyPercentage = Math.min(Math.round(rawPercentage), 100);

    // Sessions sitting in the oldest week of the window: they drop out of it over the
    // next seven days. This is the number a lifter has to match just to stand still,
    // which is the whole argument for consistency in a single figure.
    const windowStartDate = periodStartDates[periodIndex].startDate;
    const expiryCutoffDate = addDaysTo(
      windowStartDate,
      ROLLING_HORIZON_DAYS - 1,
    );
    let expiringSessions = 0;
    for (const date of sessionDates) {
      if (date <= expiryCutoffDate) expiringSessions += 1;
    }

    // Stepped by the ring's position so no two rings in the row land on the same
    // wording, and offset by the date so the row reads fresh tomorrow. Shared by the
    // headline and the rolling note, which never draw from the same set.
    const phraseRotation = dayPhraseOffset + periodIndex;

    let graceDayWarning = false;
    if (period.label === "Week" && actualWorkouts >= targetWorkouts) {
      const strictStartDate = subtractDays(today, 6);
      let strictCount = 0;
      for (const date of periodDates[period.label]) {
        if (date >= strictStartDate) strictCount += 1;
      }
      graceDayWarning = strictCount < targetWorkouts;
    }

    const nextGrade = calculateGradeJump(
      consistencyPercentage,
      actualWorkouts,
      targetWorkouts,
    );

    const surplusSessions = Math.max(0, actualWorkouts - targetWorkouts);

    let headline = "";
    if (isRestGrade(consistencyPercentage)) {
      headline = pickPhrase(getRestPhrases(period.days), phraseRotation);
    } else if (graceDayWarning) {
      headline = "Riding the grace day. One lift today locks in the week.";
    } else if (surplusSessions > 0) {
      headline = `${surplusSessions} ${pluraliseSessions(surplusSessions)} clear of target for this window`;
    } else if (actualWorkouts === targetWorkouts) {
      headline = `Exactly on target for this window`;
    } else if (nextGrade) {
      headline = `${nextGrade.sessionsNeeded} more ${pluraliseSessions(
        nextGrade.sessionsNeeded,
      )} for ${indefiniteArticle(nextGrade.grade)} ${nextGrade.grade}`;
    } else {
      headline = `${actualWorkouts} ${pluraliseSessions(actualWorkouts)} logged`;
    }

    // What this week is worth to this ring. A window the log has already filled slides
    // forward and leaves its oldest week behind; a window the log has not filled yet
    // keeps growing instead, taking its target with it, so holding the ratio means
    // matching your own rate. Either sum still gets computed past a year, because the
    // number is useful to the AI layer, but the copy up there stops quoting it.
    let rollingNote = null;
    let holdSessionsPerWeek = null;
    if (period.days >= ROLLING_NOTE_MIN_PERIOD_DAYS) {
      holdSessionsPerWeek = isPartiallyTracked
        ? getHoldSessionsPerWeek(consistencyPercentage)
        : expiringSessions;

      if (period.days >= LONG_VIEW_MIN_PERIOD_DAYS) {
        rollingNote = isPartiallyTracked
          ? pickPhrase(LONG_VIEW_FILLING_PHRASES, phraseRotation)(
              formatTrackedYears(trackedDays),
              formatWindowYears(period.days),
            )
          : pickPhrase(
              LONG_VIEW_PHRASES,
              phraseRotation,
            )(formatWindowYears(period.days));
      } else if (isPartiallyTracked) {
        rollingNote =
          consistencyPercentage >= 100
            ? pickPhrase(
                ROLLING_FILLING_MAXED_PHRASES,
                phraseRotation,
              )(TARGET_SESSIONS_PER_WEEK)
            : pickPhrase(ROLLING_FILLING_PHRASES, phraseRotation)(
                holdSessionsPerWeek.toFixed(1),
                TARGET_SESSIONS_PER_WEEK,
              );
      } else {
        rollingNote =
          expiringSessions === 0
            ? pickPhrase(ROLLING_CLEAR_PHRASES, phraseRotation)()
            : pickPhrase(ROLLING_PACE_PHRASES, phraseRotation)(
                expiringSessions,
                pluraliseSessions(expiringSessions),
              );
      }
    }

    return {
      label: period.label,
      windowLabel: getPeriodWindowLabel(period.label, period.days),
      periodDays: period.days,
      trackedDays,
      gradedDays,
      isPartiallyTracked,
      expiringSessions,
      holdSessionsPerWeek,
      rollingNote,
      actualWorkouts,
      targetWorkouts,
      surplusSessions,
      percentage: consistencyPercentage,
      // Rate is measured over the tracked portion so the widest ring reports how
      // often you actually train, not how often you trained before you kept a log.
      // Floored at one week so a brand new log cannot report "7.0 per week".
      sessionsPerWeek: (
        actualWorkouts /
        (Math.max(trackedDays, 7) / 7)
      ).toFixed(1),
      targetSessionsPerWeek: TARGET_SESSIONS_PER_WEEK,
      nextGrade,
      graceDayWarning,
      headline,
    };
  });
}
