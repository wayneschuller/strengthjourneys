/**
 * First-time Drive-permission primer.
 *
 * Shown once per browser before Google's OAuth consent screen. Its one job is
 * to reassure the user that the Drive permission Google is about to ask for
 * is narrow — we only touch the sheet we create. Keep the copy short and on
 * that single topic; broader app pitching belongs on the landing page.
 *
 * The gate (`isReturningLifter()` + `markReturningLifter()`) lives in
 * `lib/sign-in-dialog-gate.js`; this component just renders the UI.
 */

import { useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import { ShieldCheck, FileText, EyeOff, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  GoogleLogo,
  tagSignInSource,
} from "@/components/onboarding/google-sign-in";
import {
  gaTrackSignInClick,
  gaTrackSignInPrimerShown,
  gaTrackSignInPrimerDismissed,
  gaTrackSignInPrimerContinued,
} from "@/lib/analytics";
import { markReturningLifter } from "@/lib/sign-in-dialog-gate";

const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";

const POINTS = [
  {
    Icon: FileText,
    text: "We only access the lifting spreadsheet you create or choose for Strength Journeys.",
  },
  {
    Icon: EyeOff,
    text: "We do not browse your other Google Drive files.",
  },
  {
    Icon: ShieldCheck,
    text: (
      <>
        You can{" "}
        <a
          href={GOOGLE_PERMISSIONS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:no-underline"
        >
          revoke access anytime
        </a>{" "}
        from your Google account.
      </>
    ),
  },
  {
    Icon: Sparkles,
    text: (
      <strong className="text-foreground font-semibold">
        Merge your lifting exports from multiple fitness apps into one Google
        Sheet you own.
      </strong>
    ),
  },
];

export function SignInEducationDialog({
  open,
  onOpenChange,
  cta,
  callbackUrl = "/",
}) {
  const router = useRouter();
  // Tracks whether the user left the dialog by clicking Continue (true) or
  // by closing it (false). Lets the single onOpenChange handler pick the
  // right dismissed/continued event without double-firing.
  const didContinueRef = useRef(false);

  useEffect(() => {
    if (open) {
      didContinueRef.current = false;
      gaTrackSignInPrimerShown(router.pathname, cta);
    }
  }, [open, router.pathname, cta]);

  const handleContinue = () => {
    didContinueRef.current = true;
    markReturningLifter();
    gaTrackSignInPrimerContinued(router.pathname, cta);
    gaTrackSignInClick(router.pathname, cta);
    tagSignInSource(cta, callbackUrl);
    signIn("google", { callbackUrl });
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && open && !didContinueRef.current) {
      gaTrackSignInPrimerDismissed(router.pathname, cta);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Signing in with Google</DialogTitle>
          <DialogDescription className="pt-1">
            Google will ask to &ldquo;view and manage Google Drive files&rdquo;.
            For Strength Journeys, that means:
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 py-2">
          {POINTS.map(({ Icon, text }, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <Icon
                className="text-primary mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={1.75}
              />
              <p className="text-sm leading-snug">{text}</p>
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground text-xs leading-snug">
          You can keep using preview and import mode without signing in. Sign in
          when you want a persistent lifting history in your own Google Sheet.
        </p>

        <DialogFooter className="mt-2">
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
