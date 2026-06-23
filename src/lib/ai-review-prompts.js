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

  return `Review my training week ${windowText}. Use the visible week card data below as the source of truth for this dashboard review.${visibleSummaryText}\n\nLook at sessions, lift selection, tonnage, PRs, consistency, and what I should focus on next. Be specific and practical.`;
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

  return `Review my training month ${windowText}. Use the visible month card data below as the source of truth for this dashboard review.${visibleSummaryText}\n\nLook at sessions, Big Four work, strength progress, consistency, weak spots, and what I should focus on next. Be specific and practical.`;
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

  return `Review ${sessionText}${windowText}. Use the visible session data below as the source of truth for these sessions; do not assume extra sets beyond this list unless I have shared broader training data with you.${visibleSessionText}\n\nLook at load selection, rep ranges, estimated strength, PRs, fatigue signals, and what I should do next for ${liftName}. Be specific and practical.`;
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

  return `Review my lifting session${dateText}. Use the visible log data below as the source of truth for this session review; do not assume extra sets beyond this list unless I have shared broader training data with you.${visibleSessionText}${visibleTonnageText}\n\nLook at lift selection, load jumps, top sets, volume, PRs, notes, fatigue signals, and what I should adjust next time. Be specific, practical, and concise.`;
}

export function buildAiAssistantPromptHref(prompt, options = {}) {
  const query = new URLSearchParams({ aiPrompt: prompt });
  if (options.resetChat) {
    query.set("resetChat", "1");
  }
  return `${AI_ASSISTANT_PATH}?${query.toString()}`;
}
