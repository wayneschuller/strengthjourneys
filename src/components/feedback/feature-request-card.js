/**
 * Inline feature request card for /changelog, the page lifters read to see what
 * shipped. It replaced the Canny board: a request goes through /api/feedback
 * like any other feedback, flagged with sentiment "request" so the email reads
 * as an idea rather than a thumbs down. No public board, no votes, no account.
 */
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Lightbulb, PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUserLiftingData } from "@/hooks/use-userlift-data";

/**
 * @param {Object} props
 * @param {string} [props.id] - Anchor so other pages can link straight here.
 * @param {string} props.page - Page path reported with the request.
 */
export function FeatureRequestCard({ id, page }) {
  const { data: session } = useSession();
  const { sheetInfo } = useUserLiftingData();
  const [message, setMessage] = useState("");
  const [includeEmail, setIncludeEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          sentiment: "request",
          page,
          triggerLabel: "changelog-feature-request",
          includeEmail,
          email: includeEmail ? session?.user?.email || email || "" : "",
          userType: session
            ? sheetInfo?.ssid
              ? "auth-with-sheet"
              : "auth-no-sheet"
            : "anonymous",
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setIsSent(true);
    } catch {
      setError("That didn't send. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      id={id}
      aria-label="Request a feature"
      className="bg-card scroll-mt-24 rounded-2xl border p-5 shadow-sm md:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary hidden size-12 shrink-0 items-center justify-center rounded-xl sm:flex">
          {isSent ? (
            <PartyPopper className="size-6" />
          ) : (
            <Lightbulb className="size-6" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold tracking-tight">
            {isSent ? "Thanks, your idea is in" : "What should we build next?"}
          </h2>
          <p className="text-muted-foreground mt-1 text-pretty">
            {isSent
              ? "Every request gets read, and plenty of the updates above started this way."
              : "Most of these updates began as a lifter's idea. Tell us yours."}
          </p>

          {!isSent && (
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="A feature, a lift, an import, a chart you wish you had..."
                rows={4}
                maxLength={5000}
                aria-label="Your feature request"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeEmail}
                  onChange={(event) => setIncludeEmail(event.target.checked)}
                  className="rounded"
                />
                Include my email so we can follow up
              </label>
              {includeEmail &&
                (session?.user?.email ? (
                  <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm">
                    Sending as {session.user.email}
                  </p>
                ) : (
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    aria-label="Your email"
                  />
                ))}
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button
                type="submit"
                className="rounded-full"
                disabled={!message.trim() || isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send request"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
