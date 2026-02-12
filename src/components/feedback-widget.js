"use client";

import { useState, useEffect, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { trackFeedbackSentiment } from "@/lib/analytics";

export function FeedbackWidget() {
  const router = useRouter();
  const { data: session } = useSession();
  const { ssid } = useUserLiftingData();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [layer, setLayer] = useState(1); // 1=thumbs, 2=comment, 3=email+submit
  const [sentiment, setSentiment] = useState(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [includeEmail, setIncludeEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Auto-close countdown (layer 2 only, cancelled once they type)
  const AUTO_CLOSE_SECONDS = 15;
  const [countdown, setCountdown] = useState(null);

  function startCountdown() {
    setCountdown(AUTO_CLOSE_SECONDS);
  }

  function cancelCountdown() {
    setCountdown(null);
  }

  // Listen for open-feedback event from avatar menu
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-feedback", handleOpen);
    return () => window.removeEventListener("open-feedback", handleOpen);
  }, []);

  const resetState = useCallback(() => {
    cancelCountdown();
    setLayer(1);
    setSentiment(null);
    setMessage("");
    setEmail("");
    setIncludeEmail(false);
    setIsSubmitting(false);
    setError(null);
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

  const handleOpenChange = useCallback(
    (isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetState();
    },
    [resetState],
  );

  function getUserType() {
    if (session && ssid) return "auth-with-sheet";
    if (session) return "auth-no-sheet";
    return "anonymous";
  }

  function handleThumbClick(value) {
    setSentiment(value);
    trackFeedbackSentiment(value, router.pathname);
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
          email: includeEmail ? (session?.user?.email || email || "") : "",
          userType: getUserType(),
        }),
      });

      if (!res.ok) throw new Error("Failed to send");

      toast({ title: "Thanks for your feedback!" });
      setOpen(false);
      resetState();
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
              size="icon"
              className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg"
              onClick={() => setOpen(true)}
              aria-label="Give feedback"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Give feedback</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Progressive disclosure dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {layer === 1 && "How's your experience on this page?"}
              {layer >= 2 && "Thanks! Anything you'd like to tell us?"}
            </DialogTitle>
            <DialogDescription>
              {layer === 1 && "Your feedback helps us improve."}
              {layer === 2 && countdown !== null && `Closing in ${countdown}s — start typing to keep open.`}
              {layer >= 3 && "Optional — skip anytime."}
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
        </DialogContent>
      </Dialog>
    </>
  );
}
