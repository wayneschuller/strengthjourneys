import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { ThumbsSentimentControl } from "@/components/feedback/thumbs-sentiment-control";
import { SESSION_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  readStoredSentiment,
  writeStoredSentiment,
  trackFeedbackSentiment,
} from "@/components/feedback/feedback-tracking";

/**
 * Inline thumbs-up/thumbs-down feedback widget for article pages.
 * Persists the vote to sessionStorage and tracks the sentiment via GA, including time spent on the page.
 *
 * @param {Object} props
 * @param {string} props.slug - The article slug used as the sessionStorage key and the GA page path segment.
 */
export function ArticleFeedback({ slug }) {
  const { status } = useSession();
  const [vote, setVote] = useState(null); // "positive" | "negative" | null
  const mountTime = useRef(null);
  const storageKey = `${SESSION_STORAGE_KEYS.ARTICLE_FEEDBACK_PREFIX}${slug}`;

  useEffect(() => {
    setVote(readStoredSentiment(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (mountTime.current === null) {
      mountTime.current = Date.now();
    }
  }, []);

  function handleVote(sentiment) {
    if (sentiment === vote) return; // already selected
    setVote(sentiment);
    writeStoredSentiment(storageKey, sentiment);
    trackFeedbackSentiment({
      sentiment,
      page: `/articles/${slug}`,
      isLoggedIn: status === "authenticated",
      startedAtMs: mountTime.current,
    });
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {vote ? "Thanks for your feedback!" : "Was this article helpful?"}
      </span>
      <ThumbsSentimentControl
        value={vote}
        onVote={handleVote}
        size="sm"
        iconClassName="h-4 w-4"
        wrapperClassName="flex items-center gap-2"
      />
    </div>
  );
}
