/**
 * Shared prompt builders for AI coaching review entry points.
 *
 * Keep these prompts specific enough to trigger useful data-aware analysis
 * while leaving room for the assistant to choose the right coaching structure.
 */

export const AI_ASSISTANT_PATH = "/ai-lifting-assistant";

export const AI_REVIEW_PROMPTS = {
  week:
    "Review my training this week. Look at sessions, lift selection, tonnage, PRs, consistency, and what I should focus on next.",
  month:
    "Review my training this month. Look at sessions, Big Four work, strength progress, consistency, and what I should focus on next month.",
};

export function buildWeeklyReviewPrompt({ startDate, endDate, isCurrentWeek }) {
  const windowText =
    startDate && endDate
      ? `from ${startDate} to ${endDate}`
      : isCurrentWeek
        ? "this week"
        : "that week";

  return `Review my training week ${windowText}. Look at sessions, lift selection, tonnage, PRs, consistency, and what I should focus on next. Be specific and use the lifting data I have shared with you.`;
}

export function buildMonthlyReviewPrompt({ startDate, endDate, isCurrentMonth }) {
  const windowText =
    startDate && endDate
      ? `from ${startDate} to ${endDate}`
      : isCurrentMonth
        ? "this month"
        : "that month";

  return `Review my training month ${windowText}. Look at sessions, Big Four work, strength progress, consistency, weak spots, and what I should focus on next. Be specific and use the lifting data I have shared with you.`;
}

export function buildLiftRecentSessionsReviewPrompt({
  liftType,
  startDate,
  endDate,
  sessionCount,
}) {
  const liftName = liftType || "this lift";
  const sessionText =
    typeof sessionCount === "number" && sessionCount > 0
      ? `my last ${sessionCount} ${liftName} ${sessionCount === 1 ? "session" : "sessions"}`
      : `my recent ${liftName} sessions`;
  const windowText =
    startDate && endDate ? ` from ${startDate} to ${endDate}` : "";

  return `Review ${sessionText}${windowText}. Look at load selection, rep ranges, estimated strength, PRs, fatigue signals, and what I should do next for ${liftName}. Be specific and use the lifting data I have shared with you.`;
}

export function buildAiAssistantPromptHref(prompt) {
  const query = new URLSearchParams({ aiPrompt: prompt });
  return `${AI_ASSISTANT_PATH}?${query.toString()}`;
}
