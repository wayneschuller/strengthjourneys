
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gaTrackFeedbackSentiment } from "@/lib/analytics";

const STORAGE_KEY_PREFIX = "article_feedback_";

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
  const mountTime = useRef(Date.now());

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${slug}`);
      if (stored === "positive" || stored === "negative") {
        setVote(stored);
      }
    } catch (_) {}
  }, [slug]);

  function handleVote(sentiment) {
    if (sentiment === vote) return; // already selected
    setVote(sentiment);
    try {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${slug}`, sentiment);
    } catch (_) {}
    const secondsOnPage = Math.round((Date.now() - mountTime.current) / 1000);
    gaTrackFeedbackSentiment(sentiment, `/articles/${slug}`, {
      logged_in: status === "authenticated",
      seconds_on_page: secondsOnPage,
    });
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {vote ? "Thanks for your feedback!" : "Was this article helpful?"}
      </span>
      <Button
        variant={vote === "positive" ? "default" : "outline"}
        size="sm"
        onClick={() => handleVote("positive")}
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        variant={vote === "negative" ? "default" : "outline"}
        size="sm"
        onClick={() => handleVote("negative")}
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  );
}
