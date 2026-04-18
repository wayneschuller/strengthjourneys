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
import { GoogleLogo } from "@/components/onboarding/google-sign-in";
import { gaTrackSignInClick } from "@/lib/analytics";
import { markReturningLifter } from "@/lib/sign-in-dialog-gate";

const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";

const POINTS = [
  {
    Icon: FileText,
    text: "We only access the one spreadsheet we create for your lifts.",
  },
  {
    Icon: EyeOff,
    text: "We cannot access anything else in your Drive.",
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
    text: "We will create your Google Sheet to store your lifelong barbell strength journey.",
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Signing in with Google</DialogTitle>
          <DialogDescription className="pt-1">
            When you sign in with Google, it will ask to &ldquo;view and manage
            Google Drive files&rdquo;. For Strength Journeys, that means:
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

        <DialogFooter className="mt-2">
          <Button
            onClick={handleContinue}
            className="flex items-center gap-2"
            size="lg"
          >
            <GoogleLogo size={16} />
            Sign in with Google and save your lifts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
