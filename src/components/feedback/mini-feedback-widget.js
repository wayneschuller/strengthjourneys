import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ThumbsSentimentControl } from "@/components/feedback/thumbs-sentiment-control";
import { Button } from "@/components/ui/button";
import { SESSION_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  readStoredSentiment,
  trackFeedbackSentiment,
  writeStoredSentiment,
} from "@/components/feedback/feedback-tracking";

const DEFAULT_SHORT_PROMPTS = [
  "Helpful?",
  "Like this?",
  "Useful?",
  "Good?",
  "Any good?",
];
const AUTO_HIDE_AFTER_FEEDBACK_MS = 15000;

const REASON_OPTIONS_BY_SENTIMENT = Object.freeze({
  positive: [
    { code: "useful", label: "Useful" },
    { code: "clear", label: "Clear" },
    { code: "accurate", label: "Accurate" },
    { code: "motivating", label: "Motivating" },
  ],
  negative: [
    { code: "not_useful", label: "Not useful" },
    { code: "confusing", label: "Confusing" },
    { code: "wrong_for_me", label: "Wrong for me" },
    { code: "buggy", label: "Buggy" },
  ],
});

function getReasonOptions(sentiment) {
  if (sentiment !== "positive" && sentiment !== "negative") return [];
  return REASON_OPTIONS_BY_SENTIMENT[sentiment];
}

function isValidReasonCode(sentiment, reasonCode) {
  if (typeof reasonCode !== "string" || !reasonCode) return false;
  return getReasonOptions(sentiment).some((reason) => reason.code === reasonCode);
}

/**
 * Compact thumbs-only feedback widget for cards and inline placements.
 *
 * @param {Object} props
 * @param {string} [props.prompt]
 * @param {string[]} [props.promptOptions]
 * @param {string} props.contextId
 * @param {string} props.page
 * @param {object} [props.analyticsExtra]
 * @param {string} [props.className]
 */
export function MiniFeedbackWidget({
  prompt,
  promptOptions = DEFAULT_SHORT_PROMPTS,
  contextId,
  page,
  analyticsExtra = {},
  className = "",
}) {
  const { status } = useSession();
  const [vote, setVote] = useState(null);
  const [reasonCode, setReasonCode] = useState(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [isHidden, setIsHidden] = useState(false);
  const mountTime = useRef(null);
  const hideTimerRef = useRef(null);
  const storageKey = `${SESSION_STORAGE_KEYS.MINI_FEEDBACK_PREFIX}${contextId || "unknown"}`;
  const reasonStorageKey = `${SESSION_STORAGE_KEYS.MINI_FEEDBACK_REASON_PREFIX}${contextId || "unknown"}`;
  const promptIndexStorageKey = `${SESSION_STORAGE_KEYS.MINI_FEEDBACK_PROMPT_INDEX_PREFIX}${contextId || "unknown"}`;
  const safePromptOptions = Array.isArray(promptOptions) && promptOptions.length > 0
    ? promptOptions
    : DEFAULT_SHORT_PROMPTS;

  useEffect(() => {
    // Mini feedback is intentionally session-scoped so votes reset naturally
    // when the browser session ends (no long-term cooldown/TTL).
    setVote(readStoredSentiment(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!vote) {
      setReasonCode(null);
      return;
    }

    const storedReasonCode = sessionStorage.getItem(reasonStorageKey);
    if (isValidReasonCode(vote, storedReasonCode)) {
      setReasonCode(storedReasonCode);
      return;
    }

    setReasonCode(null);
    if (storedReasonCode) {
      sessionStorage.removeItem(reasonStorageKey);
    }
  }, [reasonStorageKey, vote]);

  useEffect(() => {
    if (prompt) return;

    const raw = sessionStorage.getItem(promptIndexStorageKey);
    const parsed = Number.parseInt(raw || "", 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      setPromptIndex(parsed % safePromptOptions.length);
      return;
    }

    const randomIndex = Math.floor(Math.random() * safePromptOptions.length);
    setPromptIndex(randomIndex);
    sessionStorage.setItem(promptIndexStorageKey, String(randomIndex));
  }, [prompt, promptIndexStorageKey, safePromptOptions.length]);

  useEffect(() => {
    if (mountTime.current === null) {
      mountTime.current = Date.now();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  function scheduleAutoHide() {
    setIsHidden(false);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setIsHidden(true);
    }, AUTO_HIDE_AFTER_FEEDBACK_MS);
  }

  function handleVote(sentiment) {
    if (sentiment === vote) return;
    setVote(sentiment);
    setReasonCode(null);
    scheduleAutoHide();
    writeStoredSentiment(storageKey, sentiment);
    sessionStorage.removeItem(reasonStorageKey);
    trackFeedbackSentiment({
      sentiment,
      page,
      isLoggedIn: status === "authenticated",
      startedAtMs: mountTime.current,
      extra: { ...analyticsExtra, feedback_step: "vote" },
    });
  }

  function handleReasonClick(nextReasonCode) {
    if (!vote || !isValidReasonCode(vote, nextReasonCode)) return;
    if (nextReasonCode === reasonCode) return;

    setReasonCode(nextReasonCode);
    scheduleAutoHide();
    sessionStorage.setItem(reasonStorageKey, nextReasonCode);
    trackFeedbackSentiment({
      sentiment: vote,
      page,
      isLoggedIn: status === "authenticated",
      startedAtMs: mountTime.current,
      extra: {
        ...analyticsExtra,
        feedback_step: "reason",
        reason_code: nextReasonCode,
      },
    });
  }

  const promptText = prompt || safePromptOptions[promptIndex] || DEFAULT_SHORT_PROMPTS[0];
  const reasonOptions = getReasonOptions(vote);

  return (
    <div
      className={`flex max-h-32 flex-col items-start gap-1.5 overflow-hidden transition-all duration-500 ${
        isHidden ? "pointer-events-none max-h-0 opacity-0" : "opacity-100"
      } ${className}`.trim()}
      aria-hidden={isHidden}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-[5.75rem] text-xs text-muted-foreground">
          {vote ? "Thanks!" : promptText}
        </span>
        <ThumbsSentimentControl
          value={vote}
          onVote={handleVote}
          size="sm"
          wrapperClassName="flex items-center gap-1"
          iconClassName="h-3.5 w-3.5"
          positiveAriaLabel="Thumbs up"
          negativeAriaLabel="Thumbs down"
        />
      </div>
      {vote && reasonOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-muted-foreground">Reason:</span>
          {reasonOptions.map((reason) => (
            <Button
              key={reason.code}
              type="button"
              variant={reasonCode === reason.code ? "secondary" : "outline"}
              size="sm"
              className="h-6 rounded-full px-2 text-[11px]"
              onClick={() => handleReasonClick(reason.code)}
              aria-pressed={reasonCode === reason.code}
            >
              {reason.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
