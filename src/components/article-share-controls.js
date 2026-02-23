
import { useEffect, useState } from "react";
import { ShareCopyButton } from "@/components/share-copy-button";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { gaTrackShareCopy } from "@/lib/analytics";

const SHARE_NUDGES = [
  "Found this useful? Share it with someone who lifts.",
  "Know someone training this lift? Send this their way.",
  "Share this with your training partner.",
  "Pass this along to someone chasing strength goals.",
  "Helpful read? Drop it in your group chat.",
  "Send this to a lifter who'd benefit from it.",
  "Share this with someone building better habits.",
  "If this helped, pay it forward to another lifter.",
  "Think this would help your gym buddy? Share it.",
  "Forward this to someone working on consistency.",
  "Share this with someone who loves practical lifting tips.",
  "Got value from this? Send it to one strong friend.",
  "Help another lifter level up. Share this article.",
  "This might help someone break a plateau. Share it.",
  "Spread the gains: share this with a friend.",
  "If this saved you time, share it with someone else.",
  "Know someone who asks about this? Send them this.",
  "Share this with a teammate who trains hard.",
  "Put this in your lifting chat if it helped.",
  "Share this article with someone who wants to get stronger.",
];
const GENERIC_SHARE_TEXT = "Check out this article from Strength Journeys.";

function isAbortError(error) {
  return (
    error &&
    typeof error === "object" &&
    "name" in error &&
    (error.name === "AbortError" || error.name === "NotAllowedError")
  );
}

async function copyToClipboard(text) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard API unavailable");
  }
  await navigator.clipboard.writeText(text);
}

/**
 * Renders the primary share control for an article page. Uses the Web Share API
 * when available and falls back to copying the URL to the clipboard.
 *
 * @param {Object} props
 * @param {string} props.title - Article title passed to the share payload.
 * @param {string} props.slug - Article slug used for analytics tracking.
 * @param {string} props.url - Canonical article URL to share or copy.
 */
export function ArticleShareControls({ title, slug, url }) {
  const { handleShare, isSharing } = useArticleShare({ title, slug, url });

  return (
    <TopArticleShareButton isSharing={isSharing} onShare={handleShare} />
  );
}

function useArticleShare({ title, slug, url }) {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  const trackShare = (method, source) => {
    gaTrackShareCopy("article", {
      slug,
      method,
      source,
      page:
        typeof window !== "undefined" ? window.location.pathname : `/articles/${slug}`,
    });
  };

  const handleShare = async (source) => {
    if (!url) return;
    if (isSharing) return;
    setIsSharing(true);

    const sharePayload = {
      title,
      text: GENERIC_SHARE_TEXT,
      url,
    };

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share(sharePayload);
          trackShare("native", source);
          return;
        } catch (error) {
          if (isAbortError(error)) return;
        }
      }

      await copyToClipboard(url);
      toast({ description: "Article link copied to clipboard." });
      trackShare("clipboard", source);
    } catch {
      toast({ variant: "destructive", title: "Could not share this article" });
    } finally {
      setIsSharing(false);
    }
  };

  return { handleShare, isSharing };
}

/**
 * Icon-only share button used in the article page title area. Triggers the same
 * share flow as ArticleShareControls but renders as a compact icon.
 *
 * @param {Object} props
 * @param {string} [props.title] - Article title passed to the share payload.
 * @param {string} [props.slug] - Article slug used for analytics tracking.
 * @param {string} [props.url] - Canonical article URL to share or copy.
 */
export function TopArticleShareButton({ title, slug, url }) {
  const { handleShare, isSharing } = useArticleShare({ title, slug, url });

  return (
    <ShareCopyButton
      iconOnly
      tooltip="Share article"
      isLoading={isSharing}
      onClick={() => handleShare("title_icon")}
    />
  );
}

/**
 * Footer call-to-action block encouraging readers to share the article. Displays
 * a randomised nudge message above an outlined share button.
 *
 * @param {Object} props
 * @param {string} [props.title] - Article title passed to the share payload.
 * @param {string} [props.slug] - Article slug used for analytics tracking.
 * @param {string} [props.url] - Canonical article URL to share or copy.
 */
export function ArticleShareFooterCta({ title, slug, url }) {
  const { handleShare, isSharing } = useArticleShare({ title, slug, url });
  const [nudgeText, setNudgeText] = useState(SHARE_NUDGES[0]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * SHARE_NUDGES.length);
    setNudgeText(SHARE_NUDGES[randomIndex]);
  }, []);

  return (
    <div className="w-full text-left sm:max-w-sm sm:text-right">
      <p className="text-muted-foreground mb-3 text-sm">
        {nudgeText}
      </p>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => handleShare("footer_cta")}
        disabled={isSharing}
      >
        Share article
      </Button>
    </div>
  );
}

/**
 * Floating action button fixed to the bottom-right corner on mobile screens only.
 * Provides a prominent share trigger without cluttering the desktop layout.
 *
 * @param {Object} props
 * @param {string} [props.title] - Article title passed to the share payload.
 * @param {string} [props.slug] - Article slug used for analytics tracking.
 * @param {string} [props.url] - Canonical article URL to share or copy.
 */
export function MobileFloatingArticleShareButton({ title, slug, url }) {
  const { handleShare, isSharing } = useArticleShare({ title, slug, url });

  return (
    <div className="fixed bottom-6 right-6 z-40 md:hidden">
      <ShareCopyButton
        iconOnly
        variant="default"
        tooltip="Share article"
        className="h-12 w-12 rounded-full shadow-lg"
        isLoading={isSharing}
        onClick={() => handleShare("mobile_fab")}
      />
    </div>
  );
}
