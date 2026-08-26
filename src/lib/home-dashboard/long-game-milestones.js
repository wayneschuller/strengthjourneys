/**
 * The next thing the Long Game card will do for you, and how far away it is.
 *
 * Every threshold here is the real gate in getDashboardStage — nothing is invented
 * for motivation. The early card used to say views would "unlock once you have more
 * history", which is a promise with no terms; this turns it into a number that moves
 * every time a session is logged.
 */
import {
  EARLY_BASE_MAX_SESSIONS,
  FIRST_MONTH_MAX_SESSIONS,
  FIRST_WEEK_SPAN_DAYS,
} from "@/lib/home-dashboard/dashboard-stage";

/**
 * @param {object} params
 * @param {string} params.dashboardStage
 * @param {number} params.sessionCount
 * @param {number} params.trainingSpanDays - days between first and last session
 * @returns {{title:string, body:string, current:number, target:number, unit:string}|null}
 */
export function getNextLongGameMilestone({
  dashboardStage,
  sessionCount = 0,
  trainingSpanDays = 0,
}) {
  if (dashboardStage === "established") return null;

  if (sessionCount === 0) {
    return {
      title: "Your first square on the map",
      body: "Log one session and this card starts keeping score.",
      current: 0,
      target: 1,
      unit: "session",
    };
  }

  if (
    dashboardStage === "starter_sample" ||
    dashboardStage === "first_real_week"
  ) {
    // Stage flips on the span between first and last session, so the progress bar
    // has to measure the same thing the gate does.
    return {
      title: "Your first month view",
      body: "Train into a second week and the card widens from one week to a month at a time.",
      current: Math.min(trainingSpanDays + 1, FIRST_WEEK_SPAN_DAYS),
      target: FIRST_WEEK_SPAN_DAYS,
      unit: "day",
    };
  }

  if (dashboardStage === "first_month") {
    return {
      title: "Your full training heatmap",
      body: "Enough sessions to see a pattern rather than a handful of squares.",
      current: sessionCount,
      target: FIRST_MONTH_MAX_SESSIONS + 1,
      unit: "session",
    };
  }

  return {
    title: "Streaks, the monthly view and shareable images",
    body: "The long-range views need a real base of training behind them.",
    current: sessionCount,
    target: EARLY_BASE_MAX_SESSIONS + 1,
    unit: "session",
  };
}

export function formatMilestoneRemaining({ current, target, unit }) {
  const remaining = Math.max(0, target - current);
  if (remaining === 0) return "Unlocked";
  return `${remaining} more ${remaining === 1 ? unit : `${unit}s`}`;
}
