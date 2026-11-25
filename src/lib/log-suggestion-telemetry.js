/**
 * Anonymous telemetry for the /log set suggestions, so the suggestion rules
 * can be tuned against what athletes actually lift.
 *
 * Two moments are recorded, one record each:
 *   "suggestion"  the athlete pressed one of our suggested sets
 *   "custom"      the athlete entered their own set with "Add custom set"
 *
 * A record describes the moment, not the person. Every weight is a ratio to
 * the lift's anchor (last session's top set, or the first-time target), so
 * no absolute weight leaves the browser. There is no user, sheet, email,
 * date, note, bodyweight, age or sex in it, and only registry lifts are kept,
 * since a typed lift name could say who someone is.
 *
 * This module is shared: the page builds a record with it, and the API route
 * runs the same sanitiser over whatever arrives. Storage lives server side in
 * lib/log-suggestion-stats.js.
 */

import { getDisplayWeight } from "@/lib/processing-utils";

export const LOG_SUGGESTION_EVENTS = ["suggestion", "custom"];
export const LOG_SUGGESTION_TELEMETRY_VERSION = 1;

const MAX_SETS = 30;
const MAX_OFFERED = 6;
const MAX_RATIO = 5;
const MAX_REPS = 100;
const MAX_GAP_DAYS = 365;
const MAX_PRIOR_SESSIONS = 100;
const ENDPOINT = "/api/log-suggestion-event";

const roundRatio = (value) => Math.round(value * 1000) / 1000;

function toRatio(weight, anchorWeight) {
  if (!(anchorWeight > 0) || !Number.isFinite(weight)) return null;
  return roundRatio(weight / anchorWeight);
}

function getDaysBetween(fromYmd, toYmd) {
  if (!fromYmd || !toYmd) return null;
  const from = Date.parse(`${fromYmd}T00:00:00Z`);
  const to = Date.parse(`${toYmd}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / 86400000);
}

/**
 * Builds a record on the page at the moment a set is added, before the new
 * set lands. Returns null when there is nothing honest to record.
 * @param {Object} params
 * @param {"suggestion"|"custom"} params.event
 * @param {Object} params.coachState The lift block's coaching state.
 * @param {string} params.liftType
 * @param {string} params.sessionDate
 * @param {boolean} params.isMetric
 * @param {boolean} params.isPastSession
 * @param {Object[]} params.realSets This lift's saved sets so far today.
 * @param {number} [params.pickedIndex] Which suggestion was pressed.
 * @param {{reps:number, weight:number, unitType:string}} [params.entered]
 *   The set the athlete typed, in whatever unit they typed it.
 */
export function buildLogSuggestionRecord({
  event,
  coachState,
  liftType,
  sessionDate,
  isMetric,
  isPastSession,
  realSets,
  pickedIndex,
  entered,
}) {
  const context = coachState?.telemetryContext;
  const anchorWeight = context?.anchorWeight;
  if (!LOG_SUGGESTION_EVENTS.includes(event) || !(anchorWeight > 0)) {
    return null;
  }

  const ratioSet = ({ reps, weight }) => ({
    reps,
    weight: toRatio(weight, anchorWeight),
  });

  const record = {
    v: LOG_SUGGESTION_TELEMETRY_VERSION,
    event,
    lift: liftType,
    mode: coachState.mode,
    phase: context.phase,
    unit: isMetric ? "kg" : "lb",
    increment: context.minIncrement,
    pastSession: Boolean(isPastSession),
    priorSessions: context.priorSessionCount,
    daysSincePrevious: getDaysBetween(context.previousDate, sessionDate),
    offered: (coachState.buttons ?? []).map((button) => ({
      kind: button.kind ?? "unknown",
      ...ratioSet(button),
    })),
    today: (realSets ?? [])
      .filter((set) => (set.reps ?? 0) > 0 || (set.weight ?? 0) > 0)
      .map((set) =>
        ratioSet({
          reps: set.reps ?? 0,
          weight: getDisplayWeight(set, isMetric).value ?? 0,
        }),
      ),
    previous: (context.previousSets ?? []).map(ratioSet),
  };

  if (event === "suggestion") {
    if (!Number.isInteger(pickedIndex)) return null;
    record.picked = pickedIndex;
  } else {
    if (!entered) return null;
    const weight = getDisplayWeight(
      {
        weight: Number(entered.weight) || 0,
        unitType: entered.unitType ?? (isMetric ? "kg" : "lb"),
      },
      isMetric,
    ).value;
    record.entered = ratioSet({ reps: Number(entered.reps) || 0, weight });
  }

  return sanitizeLogSuggestionRecord(record);
}

function sanitizeRatio(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return roundRatio(Math.min(MAX_RATIO, Math.max(0, value)));
}

function sanitizeReps(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(MAX_REPS, Math.max(0, Math.round(value)));
}

function sanitizeSet(set) {
  if (!set || typeof set !== "object") return null;
  const reps = sanitizeReps(set.reps);
  const weight = sanitizeRatio(set.weight);
  if (reps === null || weight === null) return null;
  return { reps, weight };
}

function sanitizeSets(sets, max = MAX_SETS) {
  if (!Array.isArray(sets)) return [];
  return sets.slice(0, max).map(sanitizeSet).filter(Boolean);
}

function sanitizeToken(value, maxLength = 32) {
  return typeof value === "string" && /^[a-z0-9-]+$/i.test(value)
    ? value.slice(0, maxLength)
    : null;
}

function sanitizeCount(value, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(0, Math.round(value)));
}

/**
 * Keeps only the fields and shapes we mean to store. Runs on the page and
 * again on the server, so a hand-made request cannot widen a record.
 * `isKnownLift` lets the server drop lift names outside the registry.
 * @returns {Object|null}
 */
export function sanitizeLogSuggestionRecord(raw, { isKnownLift } = {}) {
  if (!raw || typeof raw !== "object") return null;
  if (!LOG_SUGGESTION_EVENTS.includes(raw.event)) return null;
  if (typeof raw.lift !== "string" || !raw.lift.trim()) return null;
  if (isKnownLift && !isKnownLift(raw.lift)) return null;

  const offered = Array.isArray(raw.offered)
    ? raw.offered
        .slice(0, MAX_OFFERED)
        .map((button) => {
          const set = sanitizeSet(button);
          return set
            ? { kind: sanitizeToken(button.kind) ?? "unknown", ...set }
            : null;
        })
        .filter(Boolean)
    : [];

  const record = {
    v: LOG_SUGGESTION_TELEMETRY_VERSION,
    event: raw.event,
    lift: raw.lift.trim().slice(0, 60),
    mode: sanitizeToken(raw.mode),
    phase: sanitizeToken(raw.phase),
    unit: raw.unit === "kg" ? "kg" : "lb",
    increment:
      typeof raw.increment === "number" && raw.increment > 0
        ? Math.min(25, raw.increment)
        : null,
    pastSession: raw.pastSession === true,
    priorSessions: sanitizeCount(raw.priorSessions, MAX_PRIOR_SESSIONS),
    daysSincePrevious: sanitizeCount(raw.daysSincePrevious, MAX_GAP_DAYS),
    offered,
    today: sanitizeSets(raw.today),
    previous: sanitizeSets(raw.previous),
  };

  if (raw.event === "suggestion") {
    const picked = sanitizeCount(raw.picked, MAX_OFFERED);
    if (picked === null || picked >= offered.length) return null;
    record.picked = picked;
  } else {
    const entered = sanitizeSet(raw.entered);
    if (!entered) return null;
    record.entered = entered;
  }

  return record;
}

/** Fire and forget. Telemetry must never slow or break logging a set. */
export function sendLogSuggestionRecord(record) {
  if (!record || typeof window === "undefined") return;
  try {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Nothing to do: a lost record costs us one data point.
  }
}
