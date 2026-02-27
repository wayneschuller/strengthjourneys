
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { MessageCircleHeart } from "lucide-react";
import { motion, useAnimationControls } from "motion/react";
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
import { ThumbsSentimentControl } from "@/components/feedback/thumbs-sentiment-control";
import { trackFeedbackSentiment } from "@/components/feedback/feedback-tracking";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { SESSION_STORAGE_KEYS } from "@/lib/localStorage-keys";

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
const SUCCESS_CLOSE_SECONDS = 15;

const DONATION_ASKS = [
  "Strength Journeys is built by one person fuelled entirely by coffee. If you\u2019d like to keep the lights on:",
  "This app runs on caffeine and stubbornness. You can help with the caffeine part:",
  "No ads, no tracking, no venture capital. Just one dev and a dream. And coffee. Mostly coffee:",
  "Every coffee donated goes directly into late-night coding sessions and questionable programming decisions:",
  "I could be charging a subscription but I\u2019d rather just ask nicely:",
  "Building free software is expensive. Ironic, right? A coffee goes a long way:",
  "Behind every bug fix is a mass-market cup of coffee. Help fund the next one:",
  "This app is free because I believe strength tools should be. But my barista disagrees:",
  "One coffee = one more feature nobody asked for but everyone secretly needed:",
  "Server costs, domain fees, and an unhealthy coffee dependency. You can help with at least one:",
];

const TOOLTIP_MESSAGES = [
  "Quick feedback? Takes 5 seconds",
  "Tap to guide what we build next",
  "One click to steer the roadmap",
  "30 seconds to make this app better",
  "Your input shapes the next update",
  "Quick thumbs up or down?",
  "Help us fix what bugs you",
  "Tell us what to build next",
  "Two taps. That's all we need",
  "Point us in the right direction",
];

const DONATION_NUDGES = [
  "You clearly care about this app.",
  "People like you are the reason this app exists.",
  "That feedback was stronger than a 5-plate deadlift.",
  "You just made a solo developer's day. Seriously.",
  "Feedback like yours is rarer than a gym with enough squat racks.",
  "Most people scroll past. You stopped and helped. Legend.",
  "You're the kind of user I built this for.",
  "That feedback hit harder than a PR attempt.",
  "If feedback were reps, you just set a personal record.",
  "You're officially in the top 1% of users who actually care.",
];

const TRIGGER_LABELS = [
  "Thoughts?",
  "Ideas?",
  "Feedback?",
  "Issues?",
  "Requests?",
  "Suggestions?",
  "Opinions?",
];

/**
 * Floating feedback button and progressive-disclosure dialog for collecting user sentiment.
 * Renders a fixed-position button in the bottom-right corner that opens a multi-step dialog
 * (thumbs rating → optional comment → optional email → success/donation prompt).
 */
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
  // Keep this initial value deterministic for Next.js SSR/hydration; sessionStorage value is applied after mount.
  const [triggerLabelIndex, setTriggerLabelIndex] = useState(0);
  const clickedTriggerLabelRef = useRef(null);

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

  // Subscribes once to the avatar-menu event and opens the dialog in "menu" mode.
  useEffect(() => {
    const handleOpen = () => {
      clickedTriggerLabelRef.current = "menu";
      setOpen(true);
    };
    window.addEventListener("open-feedback", handleOpen);
    return () => window.removeEventListener("open-feedback", handleOpen);
  }, []);

  // Hydrates the rotating trigger label from sessionStorage; seeds a random start on first visit.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEYS.FEEDBACK_TRIGGER_LABEL_INDEX);
    const parsed = Number.parseInt(raw || "", 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      setTriggerLabelIndex(parsed % TRIGGER_LABELS.length);
      return;
    }
    const randomIndex = Math.floor(Math.random() * TRIGGER_LABELS.length);
    setTriggerLabelIndex(randomIndex);
    sessionStorage.setItem(SESSION_STORAGE_KEYS.FEEDBACK_TRIGGER_LABEL_INDEX, String(randomIndex));
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
    clickedTriggerLabelRef.current = null;
    phraseIndexRef.current = {
      title: Math.floor(Math.random() * TITLE_PREFIXES.length),
      subtitle: Math.floor(Math.random() * SUBTITLES.length),
      nudge: Math.floor(Math.random() * DONATION_NUDGES.length),
      ask: Math.floor(Math.random() * DONATION_ASKS.length),
      tooltip: Math.floor(Math.random() * TOOLTIP_MESSAGES.length),
    };
  }, []);

  // Drives the pre-submit auto-close countdown and closes/resets when it reaches zero.
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

  // Drives the post-submit success countdown and closes/resets when it reaches zero.
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
    nudge: Math.floor(Math.random() * DONATION_NUDGES.length),
    ask: Math.floor(Math.random() * DONATION_ASKS.length),
    tooltip: Math.floor(Math.random() * TOOLTIP_MESSAGES.length),
  });

  const titlePrefix = TITLE_PREFIXES[phraseIndexRef.current.title];
  const subtitle = SUBTITLES[phraseIndexRef.current.subtitle];
  const donationNudge = DONATION_NUDGES[phraseIndexRef.current.nudge];
  const donationAsk = DONATION_ASKS[phraseIndexRef.current.ask];
  const tooltipMessage = TOOLTIP_MESSAGES[phraseIndexRef.current.tooltip];
  const triggerLabel = TRIGGER_LABELS[triggerLabelIndex] || TRIGGER_LABELS[0];

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

  // Schedules recurring attention nudges while closed; disabled after feedback is submitted.
  const controls = useAnimationControls();
  const [hasFeedback, setHasFeedback] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!sessionStorage.getItem(SESSION_STORAGE_KEYS.FEEDBACK_GIVEN);
  });

  useEffect(() => {
    if (hasFeedback) return;
    function scheduleNudge() {
      const delay = 15000 + Math.random() * 30000; // 15-45s
      return setTimeout(() => {
        if (!open) {
          controls.start({
            scale: [1, 1.15, 0.95, 1.05, 1],
            rotate: [0, -5, 5, -3, 0],
            transition: { duration: 0.5, ease: "easeInOut" },
          });
        }
        timeoutId = scheduleNudge();
      }, delay);
    }
    let timeoutId = scheduleNudge();
    return () => clearTimeout(timeoutId);
  }, [controls, open, hasFeedback]);

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
    trackFeedbackSentiment({
      sentiment: value,
      page: router.pathname,
      isLoggedIn: Boolean(session),
    });
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
          triggerLabel: clickedTriggerLabelRef.current,
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
      setHasFeedback(true);
      sessionStorage.setItem(SESSION_STORAGE_KEYS.FEEDBACK_GIVEN, new Date().toISOString());
      startSuccessCountdown();
    } catch {
      setError("Couldn't send feedback. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Delays first render of the floating trigger on anonymous home visits to reduce interruption.
  const isHomePage = router.pathname === "/";
  const delayButton = isHomePage && !session;
  const [visible, setVisible] = useState(!delayButton);

  // Applies/removes the 20s visibility delay when route/session context changes.
  useEffect(() => {
    if (!delayButton) {
      setVisible(true);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 20000);
    return () => clearTimeout(timer);
  }, [delayButton]);

  return (
    <>
      {/* Floating trigger button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              animate={controls}
              className="fixed bottom-6 right-6 z-40 transition-opacity duration-300"
              style={{
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              <Button
                variant="outline"
                className="h-12 w-12 rounded-full border-amber-300 bg-amber-400 shadow-lg hover:bg-amber-500 lg:h-auto lg:w-auto lg:gap-2 lg:rounded-full lg:px-4 lg:py-2.5"
                onClick={() => {
                  clickedTriggerLabelRef.current = triggerLabel;
                  setOpen(true);
                  const nextIndex = (triggerLabelIndex + 1) % TRIGGER_LABELS.length;
                  setTriggerLabelIndex(nextIndex);
                  sessionStorage.setItem(
                    SESSION_STORAGE_KEYS.FEEDBACK_TRIGGER_LABEL_INDEX,
                    String(nextIndex),
                  );
                }}
                aria-label="Give feedback"
              >
                <MessageCircleHeart className="h-5 w-5 text-amber-950 lg:h-5 lg:w-5" />
                <span className="hidden text-sm font-semibold text-amber-950 lg:inline">
                  {triggerLabel}
                </span>
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{tooltipMessage}</p>
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
            <ThumbsSentimentControl
              value={sentiment}
              onVote={handleThumbClick}
              size="lg"
              wrapperClassName="flex justify-center gap-6 py-4"
              buttonClassName="h-16 w-16 rounded-full"
              iconClassName="!h-7 !w-7"
              positiveAriaLabel="Thumbs up"
              negativeAriaLabel="Thumbs down"
            />
          )}

          {/* Layer 2: Comment */}
          {layer >= 2 && layer <= 3 && (
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
              {includeEmail && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-medium">{donationNudge}</p>
                  <p className="mt-1">{donationAsk}</p>
                  <a
                    href="https://buymeacoffee.com/lrhvbjxzqr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-2 rounded-md bg-amber-400 px-3 py-1.5 font-medium text-amber-950 transition-colors hover:bg-amber-500"
                  >
                    ☕ Buy me a coffee
                  </a>
                </div>
              )}
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
