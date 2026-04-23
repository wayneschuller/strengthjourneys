import { useState } from "react";
import dynamic from "next/dynamic";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { gaTrackSignInClick } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { isReturningLifter } from "@/lib/sign-in-dialog-gate";

// Lazy-load the education dialog. First-time lifters are the only ones who
// instantiate it; returners are filtered before this module resolves.
const SignInEducationDialog = dynamic(
  () =>
    import("@/components/onboarding/sign-in-education-dialog").then(
      (m) => m.SignInEducationDialog,
    ),
  { ssr: false },
);

/**
 * Shared Google sign-in primitives for Strength Journeys.
 *
 * All sign-in CTAs funnel through here so analytics tagging, callback URL,
 * and the first-time Drive-permission primer dialog stay consistent. The
 * dialog is shown once per browser on the first sign-in attempt, then never
 * again. Callers can opt out with `skipEducation` — reserved for recovery
 * rails like `ScopeRepairPanel` where the user has already been through OAuth
 * once and is re-consenting after a scope denial.
 */

/**
 * Inline SVG rendering of the Google "G" logo in its official four-color form.
 */
export function GoogleLogo({ size = 20, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.69 1.22 9.18 3.61l6.83-6.83C35.46 2.45 30.12 0 24 0 14.62 0 6.5 5.48 2.56 13.41l7.96 6.18C12.14 13.38 17.58 9.5 24 9.5z"
      />
      <path
        fill="#34A853"
        d="M46.13 24.5c0-1.57-.14-3.08-.4-4.5H24v9h12.65c-.55 2.96-2.23 5.47-4.72 7.18l7.36 5.72C43.98 37.54 46.13 31.43 46.13 24.5z"
      />
      <path
        fill="#4A90E2"
        d="M9.52 28.59c-1.09-3.23-1.09-6.95 0-10.18L1.56 12.23C-1.7 18.18-1.7 25.82 1.56 31.77l7.96-3.18z"
      />
      <path
        fill="#FBBC05"
        d="M24 48c6.12 0 11.46-2.02 15.28-5.5l-7.36-5.72c-2.05 1.39-4.65 2.22-7.92 2.22-6.42 0-11.86-3.88-14.48-9.09l-7.96 3.18C6.5 42.52 14.62 48 24 48z"
      />
    </svg>
  );
}

function useDirectSignIn({ cta, callbackUrl = "/" }) {
  const router = useRouter();

  return () => {
    gaTrackSignInClick(router.pathname, cta);
    // Short-lived cookie so the NextAuth signIn callback can attribute this
    // OAuth attempt to a specific CTA in founder telemetry. SameSite=Lax is
    // required so the cookie survives the Google → callback redirect.
    if (typeof document !== "undefined") {
      document.cookie = `sj_signin_source=${encodeURIComponent(
        cta || "untagged",
      )}; path=/; max-age=120; samesite=lax`;
    }
    signIn("google", { callbackUrl });
  };
}

/**
 * Intercepts the click for first-time lifters so we can show the
 * Drive-permission primer before Google's consent screen. Returning browsers
 * and `skipEducation` callers (recovery rails) always go straight to Google.
 */
function useMaybeEducateSignIn({ cta, callbackUrl, skipEducation }) {
  const directSignIn = useDirectSignIn({ cta, callbackUrl });
  const [dialogOpen, setDialogOpen] = useState(false);

  const shouldEducate =
    !skipEducation && typeof window !== "undefined" && !isReturningLifter();

  const trigger = () => {
    if (shouldEducate) {
      setDialogOpen(true);
      return;
    }
    directSignIn();
  };

  return { trigger, dialogOpen, setDialogOpen, shouldEducate };
}

function EducationDialogMount({
  shouldEducate,
  dialogOpen,
  setDialogOpen,
  cta,
  callbackUrl,
}) {
  if (!shouldEducate) return null;
  return (
    <SignInEducationDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      cta={cta}
      callbackUrl={callbackUrl}
    />
  );
}

/**
 * Standard button CTA for Google sign-in.
 */
export function GoogleSignInButton({
  cta,
  callbackUrl = "/",
  children = "Sign in with Google",
  iconSize = 16,
  className,
  onClick,
  skipEducation = false,
  ...props
}) {
  const { trigger, dialogOpen, setDialogOpen, shouldEducate } =
    useMaybeEducateSignIn({ cta, callbackUrl, skipEducation });

  return (
    <>
      <Button
        className={cn("flex items-center gap-2", className)}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          trigger();
        }}
        {...props}
      >
        <GoogleLogo size={iconSize} />
        {children}
      </Button>
      <EducationDialogMount
        shouldEducate={shouldEducate}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        cta={cta}
        callbackUrl={callbackUrl}
      />
    </>
  );
}

/**
 * Dropdown-menu variant for avatar and settings menus.
 */
export function GoogleSignInMenuItem({
  cta,
  callbackUrl = "/",
  children = "Sign in with Google",
  iconSize = 16,
  className,
  onSelect,
  skipEducation = false,
  ...props
}) {
  const { trigger, dialogOpen, setDialogOpen, shouldEducate } =
    useMaybeEducateSignIn({ cta, callbackUrl, skipEducation });

  return (
    <>
      <DropdownMenuItem
        className={cn("cursor-pointer", className)}
        onSelect={(event) => {
          onSelect?.(event);
          if (event.defaultPrevented) return;
          trigger();
        }}
        {...props}
      >
        <GoogleLogo size={iconSize} />
        {children}
      </DropdownMenuItem>
      <EducationDialogMount
        shouldEducate={shouldEducate}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        cta={cta}
        callbackUrl={callbackUrl}
      />
    </>
  );
}

/**
 * Toast action variant for delayed nudges and banners inside the toast system.
 */
export function GoogleSignInToastAction({
  cta,
  callbackUrl = "/",
  altText = "Google Login",
  children = "Google Sign in",
  iconSize = 14,
  className,
  onClick,
  skipEducation = false,
  ...props
}) {
  const { trigger, dialogOpen, setDialogOpen, shouldEducate } =
    useMaybeEducateSignIn({ cta, callbackUrl, skipEducation });

  return (
    <>
      <ToastAction
        altText={altText}
        className={cn("inline-flex items-center gap-2", className)}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          trigger();
        }}
        {...props}
      >
        <GoogleLogo size={iconSize} />
        {children}
      </ToastAction>
      <EducationDialogMount
        shouldEducate={shouldEducate}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        cta={cta}
        callbackUrl={callbackUrl}
      />
    </>
  );
}

/**
 * Lightweight inline text-link style sign-in control.
 */
export function GoogleSignInInlineButton({
  cta,
  callbackUrl = "/",
  children = "Sign in",
  className,
  onClick,
  skipEducation = false,
  ...props
}) {
  const { trigger, dialogOpen, setDialogOpen, shouldEducate } =
    useMaybeEducateSignIn({ cta, callbackUrl, skipEducation });

  return (
    <>
      <button
        className={cn(
          "text-blue-600 underline visited:text-purple-600 hover:text-blue-800",
          className,
        )}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          trigger();
        }}
        type="button"
        {...props}
      >
        {children}
      </button>
      <EducationDialogMount
        shouldEducate={shouldEducate}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        cta={cta}
        callbackUrl={callbackUrl}
      />
    </>
  );
}
