/**
 * First-time sign-in education dialog.
 *
 * Shown before Google's OAuth consent screen on high-intent CTAs (hero, demo
 * banner, preview banner) for first-time lifters. Returning lifters are
 * filtered out at the CTA layer via `isReturningLifter()` so this component
 * only has to worry about the first-time experience.
 *
 * Copy voice matches landing + import pages: privacy-first, Google Sheet
 * ownership, no subscriptions.
 */

import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import { ShieldCheck, LineChart, Trophy } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/onboarding/google-sign-in";
import { gaTrackSignInClick } from "@/lib/analytics";
import { markReturningLifter } from "@/lib/sign-in-dialog-gate";

const BENEFITS = [
  {
    Icon: Trophy,
    title: "Every PR, detected automatically",
    body: "By lift, by reps, by date. Your history becomes a timeline of wins.",
  },
  {
    Icon: LineChart,
    title: "Your strength, visualized",
    body: "E1RM trends, tonnage, consistency grades. Progress you can see, not just feel.",
  },
  {
    Icon: ShieldCheck,
    title: "Your data stays yours",
    body: "We save every session into a free Google Sheet in your own Drive. No subscriptions. Ever.",
  },
];

export function SignInEducationDialog({
  open,
  onOpenChange,
  cta,
  callbackUrl = "/",
}) {
  const router = useRouter();

  const handleContinue = () => {
    markReturningLifter();
    gaTrackSignInClick(router.pathname, cta);
    signIn("google", { callbackUrl });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Built by lifters, for lifters.
          </DialogTitle>
          <DialogDescription className="pt-1 text-base">
            Strength Journeys turns every session you log into PRs, trends, and
            standards. Free forever. Your data stays yours.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 py-2">
          {BENEFITS.map(({ Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <Icon
                className="text-primary mt-0.5 h-5 w-5 shrink-0"
                strokeWidth={1.75}
              />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-muted-foreground text-sm leading-snug">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground text-xs">
          We&apos;ll ask Google for access to one sheet: the one we create for you.
          Nothing else in your Drive.
        </p>

        <DialogFooter className="mt-2 sm:justify-between sm:gap-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground"
          >
            Just show me the app
          </Button>
          <Button
            onClick={handleContinue}
            className="flex items-center gap-2"
            size="lg"
          >
            <GoogleLogo size={16} />
            Continue with Google
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
