import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { gaTrackSignInClick } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * Shared Google sign-in primitives for Strength Journeys.
 *
 * Future sign-in UI should use these components instead of calling `signIn()`
 * directly at each callsite. That keeps analytics tagging, CTA wiring, and the
 * intentional redirect to the root page (`callbackUrl: "/"`) consistent across
 * the app. The root redirect is deliberate because post-auth onboarding starts
 * from the home dashboard flow.
 */

/**
 * Inline SVG rendering of the Google "G" logo in its official four-color form.
 * Kept in this module so every shared sign-in component ships with the same icon.
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

function useGoogleSignInAction({ cta, callbackUrl = "/" }) {
  const router = useRouter();

  return () => {
    gaTrackSignInClick(router.pathname, cta);
    signIn("google", { callbackUrl });
  };
}

/**
 * Standard button CTA for Google sign-in. Use this for primary and secondary
 * buttons anywhere a normal shadcn `Button` would fit.
 */
export function GoogleSignInButton({
  cta,
  callbackUrl = "/",
  children = "Sign in with Google",
  iconSize = 16,
  className,
  onClick,
  ...props
}) {
  const handleGoogleSignIn = useGoogleSignInAction({ cta, callbackUrl });

  return (
    <Button
      className={cn("flex items-center gap-2", className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        handleGoogleSignIn();
      }}
      {...props}
    >
      <GoogleLogo size={iconSize} />
      {children}
    </Button>
  );
}

/**
 * Dropdown-menu variant for places like avatar menus and settings menus where
 * sign-in should look like a first-class menu action.
 */
export function GoogleSignInMenuItem({
  cta,
  callbackUrl = "/",
  children = "Sign in with Google",
  iconSize = 16,
  className,
  onSelect,
  ...props
}) {
  const handleGoogleSignIn = useGoogleSignInAction({ cta, callbackUrl });

  return (
    <DropdownMenuItem
      className={cn("cursor-pointer", className)}
      onSelect={(event) => {
        onSelect?.(event);
        if (event.defaultPrevented) return;
        handleGoogleSignIn();
      }}
      {...props}
    >
      <GoogleLogo size={iconSize} />
      {children}
    </DropdownMenuItem>
  );
}

/**
 * Toast action variant for delayed nudges and banners that render inside the
 * shared toast system rather than directly on the page.
 */
export function GoogleSignInToastAction({
  cta,
  callbackUrl = "/",
  altText = "Google Login",
  children = "Google Sign in",
  iconSize = 14,
  className,
  onClick,
  ...props
}) {
  const handleGoogleSignIn = useGoogleSignInAction({ cta, callbackUrl });

  return (
    <ToastAction
      altText={altText}
      className={cn("inline-flex items-center gap-2", className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        handleGoogleSignIn();
      }}
      {...props}
    >
      <GoogleLogo size={iconSize} />
      {children}
    </ToastAction>
  );
}

/**
 * Lightweight inline text-link style sign-in control for sentence-level copy
 * such as "Sign in and connect your sheet".
 */
export function GoogleSignInInlineButton({
  cta,
  callbackUrl = "/",
  children = "Sign in",
  className,
  onClick,
  ...props
}) {
  const handleGoogleSignIn = useGoogleSignInAction({ cta, callbackUrl });

  return (
    <button
      className={cn(
        "text-blue-600 underline visited:text-purple-600 hover:text-blue-800",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        handleGoogleSignIn();
      }}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
