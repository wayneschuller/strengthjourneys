/**
 * Compact, progressively revealed sentiment feedback for cards and inline results.
 */
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "motion/react";
import { ThumbsSentimentControl } from "@/components/feedback/thumbs-sentiment-control";
import { Button } from "@/components/ui/button";
import {
  trackFeedbackSentiment,
} from "@/components/feedback/feedback-tracking";

const CELEBRATE_DURATION_MS = 1200;
const DEFAULT_REVEAL_DELAY_MS = 8000;
const DEFAULT_REVEAL_JITTER_MS = 4000;

const DEFAULT_SHORT_PROMPTS = [
  "Helpful?",
  "Like this?",
  "Useful?",
  "Good?",
  "Any good?",
];
const AUTO_HIDE_AFTER_FEEDBACK_MS = 10000;

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
 * @param {number} [props.revealDelayMs]
 * @param {number} [props.revealJitterMs]
 */
export function MiniFeedbackWidget({
  prompt,
  promptOptions = DEFAULT_SHORT_PROMPTS,
  contextId,
  page,
  analyticsExtra = {},
  className = "",
  revealDelayMs = DEFAULT_REVEAL_DELAY_MS,
  revealJitterMs = DEFAULT_REVEAL_JITTER_MS,
}) {
  const { status } = useSession();
  const [vote, setVote] = useState(null);
  const [reasonCode, setReasonCode] = useState(null);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isRevealed, setIsRevealed] = useState(() => revealDelayMs <= 0);
  const mountTime = useRef(null);
  const revealTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const celebrateTimerRef = useRef(null);
  const [effectiveRevealDelayMs] = useState(() => {
    const jitterRange = Math.max(0, revealJitterMs);
    const jitterOffset = Math.random() * jitterRange - jitterRange / 2;
    return Math.max(0, Math.round(revealDelayMs + jitterOffset));
  });
  const safePromptOptions = Array.isArray(promptOptions) && promptOptions.length > 0
    ? promptOptions
    : DEFAULT_SHORT_PROMPTS;
  const [promptIndex] = useState(() =>
    Math.floor(Math.random() * safePromptOptions.length),
  );

  useEffect(() => {
    if (isRevealed && mountTime.current === null) {
      mountTime.current = Date.now();
    }
  }, [isRevealed]);

  useEffect(() => {
    if (isRevealed) return undefined;

    revealTimerRef.current = setTimeout(() => {
      setIsRevealed(true);
    }, effectiveRevealDelayMs);

    return () => clearTimeout(revealTimerRef.current);
  }, [effectiveRevealDelayMs, isRevealed]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
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

    if (sentiment === "positive") {
      setIsCelebrating(true);
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
      celebrateTimerRef.current = setTimeout(() => {
        setIsCelebrating(false);
      }, CELEBRATE_DURATION_MS);
    }

    scheduleAutoHide();
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

  const promptText =
    prompt || safePromptOptions[promptIndex] || DEFAULT_SHORT_PROMPTS[0];
  const reasonOptions = getReasonOptions(vote);

  // Which label to show left of the thumbs buttons
  const labelText = isCelebrating ? "Thanks!" : vote ? "Thanks!" : promptText;

  return (
    <div
      className={`flex max-h-32 flex-col items-start gap-1.5 overflow-hidden transition-all duration-500 ${
        isHidden
          ? "invisible pointer-events-none max-h-0 opacity-0"
          : isRevealed
            ? "visible opacity-100"
            : "invisible pointer-events-none opacity-0"
      } ${className}`.trim()}
      aria-hidden={isHidden || !isRevealed}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-xs transition-colors duration-300 ${
            isCelebrating
              ? "font-medium text-green-500"
              : "text-muted-foreground"
          }`}
        >
          {labelText}
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
      {vote && !isCelebrating && reasonOptions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex flex-wrap items-center gap-1"
        >
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
        </motion.div>
      )}
    </div>
  );
}
