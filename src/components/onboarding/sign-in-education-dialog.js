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
import { ShieldCheck, FileText, EyeOff } from "lucide-react";

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

const POINTS = [
  {
    Icon: FileText,
    text: "We only read and write the Google Sheet we create for your lifts.",
  },
  {
    Icon: EyeOff,
    text: "Nothing else in your Drive is visible to Strength Journeys.",
  },
  {
    Icon: ShieldCheck,
    text: "Your data lives in your account, and you can revoke access anytime.",
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
            In a moment, Google will ask Strength Journeys for Drive access.
            Here is what that actually means.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 py-2">
          {POINTS.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-3">
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
            Continue with Google
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
