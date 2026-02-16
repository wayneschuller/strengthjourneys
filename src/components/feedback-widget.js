"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { MessageSquarePlus, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { gaTrackFeedbackSentiment } from "@/lib/analytics";

const TITLE_PREFIXES = [
  "How are you finding",
  "What do you think of",
  "How's your experience with",
  "Got any thoughts on",
  "How are you liking",
  "What's your take on",
  "How's it going with",
  "Any feelings about",
  "What do you make of",
  "How are we doing with",
];

const SUBTITLES = [
  "Your feedback helps us improve.",
  "We read every single response. Seriously. It's a small team.",
  "Even a thumbs up makes our day. We're not needy, just... emotionally invested.",
  "Tell us what you really think. We can take it. Probably.",
  "Your feedback is like a new PR — it makes everything worth it.",
  "Be honest. We promise not to cry. Much.",
  "Think of this as your spotter. We've got your back if you've got ours.",
  "We built this instead of going to the gym. Was it worth it? You tell us.",
  "Feedback is the progressive overload of product development.",
  "One rep of feedback can change everything.",
  "Your opinion matters more than your one rep max. Almost.",
  "Help us help you get stronger. It's a virtuous cycle.",
  "We check for feedback more often than we check our phone. Don't judge.",
  "Every piece of feedback adds 5kg to our motivation.",
  "This is a one-person dev team running on coffee and validation.",
  "Fun fact: zero people have told us this app is perfect. Be the first?",
  "Constructive criticism welcome. Unconstructive praise also welcome.",
  "Your feedback fuels development more than pre-workout ever could.",
  "We lift your data. You lift our spirits. Fair trade?",
  "Stronger feedback = stronger app. It's basically science.",
];

const AUTO_CLOSE_SECONDS = 15;
const SUCCESS_CLOSE_SECONDS = 4;

export function FeedbackWidget() {
  const router = useRouter();
  const { data: session } = useSession();
  const { sheetInfo, parsedData } = useUserLiftingData();

  const [open, setOpen] = useState(false);
  const [layer, setLayer] = useState(1); // 1=thumbs, 2=comment, 3=email+submit
  const [sentiment, setSentiment] = useState(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [includeEmail, setIncludeEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [countdown, setCountdown] = useState(null);
  const [successCountdown, setSuccessCountdown] = useState(null);

  function startCountdown() {
    setCountdown(AUTO_CLOSE_SECONDS);
  }

  function cancelCountdown() {
    setCountdown(null);
  }

  function startSuccessCountdown() {
    setSuccessCountdown(SUCCESS_CLOSE_SECONDS);
  }

  function cancelSuccessCountdown() {
    setSuccessCountdown(null);
  }

  // Listen for open-feedback event from avatar menu
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-feedback", handleOpen);
    return () => window.removeEventListener("open-feedback", handleOpen);
  }, []);

  const resetState = useCallback(() => {
    cancelCountdown();
    cancelSuccessCountdown();
    setLayer(1);
    setSentiment(null);
    setMessage("");
    setEmail("");
    setIncludeEmail(false);
    setIsSubmitting(false);
    setError(null);
    phraseIndexRef.current = {
      title: Math.floor(Math.random() * TITLE_PREFIXES.length),
      subtitle: Math.floor(Math.random() * SUBTITLES.length),
    };
  }, []);

  // Tick the countdown every second
  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      setCountdown(null);
      setOpen(false);
      resetState();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, resetState]);

  // Auto-close after successful submit
  useEffect(() => {
    if (successCountdown === null) return;

    if (successCountdown <= 0) {
      setSuccessCountdown(null);
      setOpen(false);
      resetState();
      return;
    }

    const timer = setTimeout(() => {
      setSuccessCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [successCountdown, resetState]);

  const handleOpenChange = useCallback(
    (isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetState();
    },
    [resetState],
  );

  // Pick random phrases — re-randomized on close so next open is fresh
  const phraseIndexRef = useRef({
    title: Math.floor(Math.random() * TITLE_PREFIXES.length),
    subtitle: Math.floor(Math.random() * SUBTITLES.length),
  });

  const titlePrefix = TITLE_PREFIXES[phraseIndexRef.current.title];
  const subtitle = SUBTITLES[phraseIndexRef.current.subtitle];

  const PAGE_NAMES = {
    "/": session ? "the Home Dashboard" : "the Landing Page",
    "/analyzer": "the PR Analyzer",
    "/visualizer": "the Visualizer",
    "/tonnage": "Tonnage Tracking",
    "/calculator": "the 1RM Calculator",
    "/strength-level-calculator": "the Strength Level Calculator",
    "/1000lb-club-calculator": "the 1000lb Club Calculator",
    "/warm-up-sets-calculator": "the Warm-up Calculator",
    "/strength-year-in-review": "your Year in Review",
    "/ai-lifting-assistant": "the AI Lifting Assistant",
    "/timer": "the Gym Timer",
    "/gym-playlist-leaderboard": "the Playlist Leaderboard",
    "/barbell-strength-potential": "Strength Potential",
  };

  const LIFT_SLUG_NAMES = {
    "barbell-squat-insights": "Back Squat Insights",
    "barbell-bench-press-insights": "Bench Press Insights",
    "barbell-deadlift-insights": "Deadlift Insights",
    "barbell-strict-press-insights": "Strict Press Insights",
  };

  const pageName =
    router.pathname === "/[lift]"
      ? LIFT_SLUG_NAMES[router.query.lift] || "Lift Insights"
      : PAGE_NAMES[router.pathname] || "Strength Journeys";

  function getUserType() {
    if (session && sheetInfo?.ssid) return "auth-with-sheet";
    if (session) return "auth-no-sheet";
    return "anonymous";
  }

  function handleThumbClick(value) {
    setSentiment(value);
    gaTrackFeedbackSentiment(value, router.pathname);
    setLayer(2);
    startCountdown();
  }

  async function handleSubmit() {
    if (!message.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          sentiment,
          page: router.pathname,
          includeEmail,
          email: includeEmail ? (session?.user?.email || email || "") : "",
          userType: getUserType(),
          metadata: {
            parsedRowCount: sheetInfo?.ssid && Array.isArray(parsedData) ? parsedData.length : null,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to send");

      setLayer(4);
      startSuccessCountdown();
    } catch {
      setError("Couldn't send feedback. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full border-amber-300 bg-amber-400 shadow-lg hover:bg-amber-500 lg:h-auto lg:w-auto lg:gap-2 lg:rounded-full lg:px-4 lg:py-2.5"
              onClick={() => setOpen(true)}
              aria-label="Give feedback"
            >
              <span className="text-lg">💬</span>
              <span className="hidden text-sm font-semibold text-amber-950 lg:inline">
                Thoughts?
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="lg:hidden">
            <p>Share your thoughts</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Progressive disclosure dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {layer === 1 && `${titlePrefix} ${pageName}?`}
              {layer >= 2 && layer <= 3 && "Thanks! Anything you'd like to tell us?"}
              {layer === 4 && "Feedback sent"}
            </DialogTitle>
            <DialogDescription>
              {layer === 1 && subtitle}
              {layer === 2 && countdown !== null && `Closing in ${countdown}s — start typing to keep open.`}
              {layer === 3 && "Optional — skip anytime."}
              {layer === 4 && (successCountdown !== null
                ? `Thanks for helping us improve. Closing in ${successCountdown}s.`
                : "Thanks for helping us improve.")}
            </DialogDescription>
          </DialogHeader>

          {/* Layer 1: Thumbs up/down */}
          {layer === 1 && (
            <div className="flex justify-center gap-6 py-4">
              <Button
                variant="outline"
                size="lg"
                className="h-16 w-16 rounded-full"
                onClick={() => handleThumbClick("positive")}
                aria-label="Thumbs up"
              >
                <ThumbsUp className="!h-7 !w-7" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-16 w-16 rounded-full"
                onClick={() => handleThumbClick("negative")}
                aria-label="Thumbs down"
              >
                <ThumbsDown className="!h-7 !w-7" />
              </Button>
            </div>
          )}

          {/* Layer 2: Comment */}
          {layer >= 2 && (
            <div className="space-y-4">
              <Textarea
                placeholder="Bug report, feature idea, or just say hi..."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (e.target.value.trim() && layer === 2) {
                    cancelCountdown();
                    setLayer(3);
                  }
                }}
                onKeyDown={(e) => e.stopPropagation()}
                rows={3}
                maxLength={5000}
              />

              {/* Layer 3: Identity opt-in (shown when they start typing) */}
              {layer === 3 && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeEmail}
                      onChange={(e) => setIncludeEmail(e.target.checked)}
                      className="rounded"
                    />
                    Include my email so you can follow up
                  </label>
                  {includeEmail && (
                    <>
                      {session?.user?.email ? (
                        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                          Sending as {session.user.email}
                        </p>
                      ) : (
                        <Input
                          type="email"
                          placeholder="Your email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                      )}
                    </>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    resetState();
                  }}
                >
                  Skip
                </Button>
                {layer === 3 && (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !message.trim()}
                  >
                    {isSubmitting ? "Sending..." : "Send feedback"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {layer === 4 && (
            <div className="space-y-4 py-2">
              <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Thanks for your feedback.
              </div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    resetState();
                  }}
                >
                  Close now
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
