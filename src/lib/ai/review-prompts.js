/**
 * Shared prompt builders for AI coaching review entry points.
 *
 * Keep these prompts specific enough to trigger useful data-aware analysis
 * while leaving room for the assistant to choose the right coaching structure.
 */

import { getDisplayWeight } from "@/lib/processing-utils";

export const AI_ASSISTANT_PATH = "/ai-lifting-assistant";
export const AI_ASSISTANT_PROMPT_STORAGE_PREFIX = "SJ_AI_ASSISTANT_PROMPT_";

export const AI_REVIEW_PROMPTS = {
  week: "Review my training this week",
  month: "Review my training this month",
};

export function buildWeeklyReviewPrompt({
  startDate,
  endDate,
  isCurrentWeek,
  summaryLines,
}) {
  const windowText =
    startDate && endDate
      ? `from ${startDate} to ${endDate}`
      : isCurrentWeek
        ? "this week"
        : "that week";
  const visibleSummaryText =
    Array.isArray(summaryLines) && summaryLines.length > 0
      ? `\n\nVisible week card data:\n${summaryLines.join("\n")}`
      : "";

  return `Review my training week ${windowText}. Use the visible week card data below as the source of truth for this dashboard review.${visibleSummaryText}`;
}

export function buildMonthlyReviewPrompt({
  startDate,
  endDate,
  isCurrentMonth,
  summaryLines,
}) {
  const windowText =
    startDate && endDate
      ? `from ${startDate} to ${endDate}`
      : isCurrentMonth
        ? "this month"
        : "that month";
  const visibleSummaryText =
    Array.isArray(summaryLines) && summaryLines.length > 0
      ? `\n\nVisible month card data:\n${summaryLines.join("\n")}`
      : "";

  return `Review my training month ${windowText}. Use the visible month card data below as the source of truth for this dashboard review.${visibleSummaryText}`;
}

export function buildLiftRecentSessionsReviewPrompt({
  liftType,
  startDate,
  endDate,
  sessionCount,
  sessionSummaries,
}) {
  const liftName = liftType || "this lift";
  const sessionText =
    typeof sessionCount === "number" && sessionCount > 0
      ? `my last ${sessionCount} ${liftName} ${sessionCount === 1 ? "session" : "sessions"}`
      : `my recent ${liftName} sessions`;
  const windowText =
    startDate && endDate ? ` from ${startDate} to ${endDate}` : "";
  const visibleSessionText =
    Array.isArray(sessionSummaries) && sessionSummaries.length > 0
      ? `\n\nVisible session data:\n${sessionSummaries.join("\n")}`
      : "";

  return `Review ${sessionText}${windowText}. Use the visible session data below as the source of truth for these sessions; do not assume extra sets beyond this list unless I have shared broader training data with you.${visibleSessionText}`;
}

export function buildLogSessionReviewPrompt({
  sessionDate,
  sessionSummaries,
  tonnageSummaries,
}) {
  const dateText = sessionDate ? ` on ${sessionDate}` : "";
  const visibleSessionText =
    Array.isArray(sessionSummaries) && sessionSummaries.length > 0
      ? `\n\nVisible session data:\n${sessionSummaries.join("\n")}`
      : "";
  const visibleTonnageText =
    Array.isArray(tonnageSummaries) && tonnageSummaries.length > 0
      ? `\n\nVisible tonnage context:\n${tonnageSummaries.join("\n")}`
      : "";

  return `Review my lifting session${dateText}. Use the visible log data below as the source of truth for this session review; do not assume extra sets beyond this list unless I have shared broader training data with you.${visibleSessionText}${visibleTonnageText}`;
}

/**
 * One line per lift for the log's session review prompt: "- Back Squat:
 * 5@100kg, 5@105kg PR; notes: ...". Sets still on their way to the sheet are
 * left out.
 */
export function buildLogSessionPromptSummaries({
  sessionLiftsWithPending,
  isMetric,
}) {
  return Object.entries(sessionLiftsWithPending)
    .map(([liftType, sets]) => {
      const visibleSets = Array.isArray(sets)
        ? sets.filter(
            (set) =>
              (set.reps ?? 0) > 0 && (set.weight ?? 0) > 0 && !set._pending,
          )
        : [];
      if (visibleSets.length === 0) return null;

      const setLines = visibleSets.map((set) => {
        const { value, unit } = getDisplayWeight(set, isMetric);
        const prLabel = set.isHistoricalPR ? " PR" : "";
        return `${set.reps}@${formatPromptNumber(value)}${unit}${prLabel}`;
      });
      const noteLines = visibleSets
        .map((set) => normalizePromptNote(set.notes))
        .filter(Boolean)
        .slice(0, 4);
      const notesText =
        noteLines.length > 0 ? `; notes: ${noteLines.join(" | ")}` : "";

      return `- ${liftType}: ${setLines.join(", ")}${notesText}`;
    })
    .filter(Boolean);
}

/** Per-lift tonnage lines for the same prompt, with the comparison when one holds. */
export function buildLogSessionTonnagePromptSummaries(perLiftTonnageStats) {
  if (!perLiftTonnageStats) return [];

  return Object.entries(perLiftTonnageStats)
    .map(([liftType, stats]) => {
      if (!stats?.currentLiftTonnage || stats.currentLiftTonnage <= 0) {
        return null;
      }

      const unit = stats.unitType ?? "";
      const current = formatPromptNumber(stats.currentLiftTonnage);
      if (!stats.shouldShowComparison || !Number.isFinite(stats.pctDiff)) {
        return `- ${liftType}: tonnage=${current}${unit}`;
      }

      const pct = Math.round(stats.pctDiff);
      const sign = pct > 0 ? "+" : "";
      const sessionCountText =
        stats.sessionCount > 0
          ? ` across ${stats.sessionCount} prior sessions`
          : "";

      return `- ${liftType}: tonnage=${current}${unit} (${sign}${pct}% vs average${sessionCountText})`;
    })
    .filter(Boolean);
}

function normalizePromptNote(note) {
  if (typeof note !== "string") return "";
  const compact = note.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length > 120 ? `${compact.slice(0, 117).trim()}...` : compact;
}

function formatPromptNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.abs(value - Math.round(value)) < 0.05
    ? String(Math.round(value))
    : value.toFixed(1);
}

export function buildLiftChartReviewPrompt({
  liftType,
  formula,
  startDate,
  endDate,
  summaryLines,
}) {
  const visibleSummaryText =
    Array.isArray(summaryLines) && summaryLines.length > 0
      ? `\n\nChart data summary:\n${summaryLines.join("\n")}`
      : "";
  return `Review my ${liftType} estimated one-rep-max progress chart from ${startDate} to ${endDate}. The chart uses the ${formula} formula and shows the best estimated 1RM per logged session date. Use the summary below as the source of truth; distinguish measured progress from gaps or sparse data.${visibleSummaryText}`;
}

export function buildTonnageChartReviewPrompt({
  liftType,
  startDate,
  endDate,
  summaryLines,
}) {
  const chartName = liftType
    ? `${liftType} session tonnage`
    : "total session tonnage";
  const visibleSummaryText =
    Array.isArray(summaryLines) && summaryLines.length > 0
      ? `\n\nChart data summary:\n${summaryLines.join("\n")}`
      : "";

  return `Review my ${chartName} chart from ${startDate} to ${endDate}. It shows weight multiplied by reps for each logged session plus a 30-day rolling average. Use the summary below as the source of truth; discuss workload patterns and consistency without treating tonnage changes alone as proof of strength gain or loss.${visibleSummaryText}`;
}

export function buildLongGameReviewPrompt({ summaryLines }) {
  const visibleSummaryText =
    Array.isArray(summaryLines) && summaryLines.length > 0
      ? `\n\nLong Game summary:\n${summaryLines.join("\n")}`
      : "";
  return `Review my long-term training consistency and lifting history. Use the Long Game summary below as the source of truth. Look for sustainable consistency, meaningful breaks, streaks, and patterns worth discussing; do not infer exact daily training details beyond the summary.${visibleSummaryText}`;
}

export function buildAiAssistantPromptLink(prompt, options = {}) {
  const promptKey = buildPromptKey(prompt, options);
  const query = new URLSearchParams({ aiPromptKey: promptKey });
  if (options.resetChat) {
    query.set("resetChat", "1");
  }

  return {
    href: `${AI_ASSISTANT_PATH}?${query.toString()}`,
    prompt,
    promptKey,
  };
}

export function stashAiAssistantPrompt(promptLink) {
  if (
    typeof window === "undefined" ||
    !promptLink?.promptKey ||
    !promptLink?.prompt
  ) {
    return false;
  }

  try {
    window.sessionStorage.setItem(
      `${AI_ASSISTANT_PROMPT_STORAGE_PREFIX}${promptLink.promptKey}`,
      promptLink.prompt,
    );
    return true;
  } catch {
    return false;
  }
}

export function readAiAssistantPrompt(promptKey) {
  if (typeof window === "undefined" || !promptKey) return "";

  const storageKey = `${AI_ASSISTANT_PROMPT_STORAGE_PREFIX}${promptKey}`;
  try {
    return window.sessionStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

export function clearAiAssistantPrompt(promptKey) {
  if (typeof window === "undefined" || !promptKey) return;

  const storageKey = `${AI_ASSISTANT_PROMPT_STORAGE_PREFIX}${promptKey}`;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures; the prompt key contains no prompt data.
  }
}

function buildPromptKey(prompt, options = {}) {
  const seed = `${options.resetChat ? "reset:" : ""}${prompt || ""}`;
  let hash = 5381;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
