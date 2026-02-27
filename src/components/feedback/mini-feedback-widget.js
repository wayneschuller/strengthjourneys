import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ThumbsSentimentControl } from "@/components/feedback/thumbs-sentiment-control";
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
  const [promptIndex, setPromptIndex] = useState(0);
  const mountTime = useRef(null);
  const storageKey = `${SESSION_STORAGE_KEYS.MINI_FEEDBACK_PREFIX}${contextId || "unknown"}`;
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

  function handleVote(sentiment) {
    if (sentiment === vote) return;
    setVote(sentiment);
    writeStoredSentiment(storageKey, sentiment);
    trackFeedbackSentiment({
      sentiment,
      page,
      isLoggedIn: status === "authenticated",
      startedAtMs: mountTime.current,
      extra: analyticsExtra,
    });
  }

  const promptText = prompt || safePromptOptions[promptIndex] || DEFAULT_SHORT_PROMPTS[0];

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
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
  );
}
