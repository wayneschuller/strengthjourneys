/**
 * Shared prompt builders for AI coaching review entry points.
 *
 * Keep these prompts specific enough to trigger useful data-aware analysis
 * while leaving room for the assistant to choose the right coaching structure.
 */

export const AI_ASSISTANT_PATH = "/ai-lifting-assistant";
export const AI_ASSISTANT_PROMPT_STORAGE_PREFIX = "SJ_AI_ASSISTANT_PROMPT_";

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

  return `Review my lifting session${dateText}. Use the visible log data below as the source of truth for this session review; do not assume extra sets beyond this list unless I have shared broader training data with you.${visibleSessionText}${visibleTonnageText}`;
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
