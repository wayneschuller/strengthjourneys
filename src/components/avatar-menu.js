import { useState, useCallback } from "react";
import { useRouter } from "next/router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession, signIn, signOut } from "next-auth/react";
import { gaTrackSignInClick } from "@/lib/analytics";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { devLog } from "@/lib/processing-utils";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  MessageSquarePlus,
  Coffee,
  Eraser,
  Trash2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserLiftingData } from "@/hooks/use-userlift-data";

/**
 * User avatar button in the nav bar. Shows a Google sign-in button when unauthenticated,
 * or a dropdown menu with sheet management, feedback, and sign-out options when authenticated.
 *
 * @param {Object} props - No props; all data is sourced from session and lifting data context.
 */
export function AvatarDropdown() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [isResettingKv, setIsResettingKv] = useState(false);
  const { sheetInfo } = useUserLiftingData();

  const runKvReset = useCallback(
    async (mode) => {
      setIsResettingKv(true);
      try {
        const response = await fetch("/api/dev/reset-user-kv", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mode }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "KV reset failed");
        }
        devLog("[dev-kv-reset]", payload);
      } catch (error) {
        console.error("[dev-kv-reset] failed:", error);
      } finally {
        setIsResettingKv(false);
      }
    },
    [],
  );

  if (authStatus !== "authenticated")
    return (
      <Button
        variant="outline"
        onClick={() => {
          gaTrackSignInClick(router.pathname, "nav_avatar");
          signIn("google", { callbackUrl: "/" });
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        <span className="sm:hidden">Sign in</span>
        <span className="hidden sm:inline">Sign in with Google</span>
      </Button>
    );

  // I don't know how we could be authenticated and not have session.user.image but it happens occasionally
  // Possibly due to stale next-auth JWT token
  // Forced signOut() seems to reset everything
  if (authStatus === "authenticated" && !session?.user?.image) {
    console.error(`Next-auth being a silly-billy again.`);
    signOut();
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild aria-label="User menu">
                <Avatar className="ml-2 h-8 w-8 ring-muted-foreground hover:ring-2">
                  <AvatarImage src={session.user.image} />
                  <AvatarFallback>{session.user.name}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Open user menu</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="font-bold">Athlete: </p>
                  {/* <p className="flex-row text-sm font-medium leading-none"> {session.user.name} </p> */}
                  <p className="pl-2 text-xs leading-none text-muted-foreground">
                    {session.user.email}
                  </p>
                  {sheetInfo?.filename && (
                    <>
                      <p className="font-bold">Data source loaded: </p>
                      {sheetInfo?.url ? (
                        <a
                          href={sheetInfo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="pl-2 text-xs leading-none text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          {sheetInfo.filename}
                        </a>
                      ) : (
                        <p className="pl-2 text-xs leading-none text-muted-foreground">
                          {sheetInfo.filename}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {!sheetInfo?.ssid && (
                  <DropdownMenuItem
                    onClick={() => {
                      openSheetSetupDialog("bootstrap");
                    }}
                  >
                    <img
                      src={GOOGLE_SHEETS_ICON_URL}
                      alt=""
                      className="mr-2 h-4 w-4 shrink-0"
                      aria-hidden
                    />
                    Set Up Google Sheet
                  </DropdownMenuItem>
                )}
                {sheetInfo?.ssid && (
                  <DropdownMenuItem
                    onClick={() => {
                      openSheetSetupDialog("switch_sheet");
                    }}
                  >
                    <img
                      src={GOOGLE_SHEETS_ICON_URL}
                      alt=""
                      className="mr-2 h-4 w-4 shrink-0"
                      aria-hidden
                    />
                    Select New Data Source
                  </DropdownMenuItem>
                )}
                {/* Public actions shown in all environments. Keep these outside
                    any dev-only gate so production users always see them. */}
                <DropdownMenuItem
                  onClick={() =>
                    window.dispatchEvent(new Event("open-feedback"))
                  }
                >
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  Send Feedback
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    window.open("https://buymeacoffee.com/lrhvbjxzqr")
                  }
                >
                  <Coffee className="mr-2 h-4 w-4" />
                  Buy Me A Coffee
                </DropdownMenuItem>
                {/* Non-production tools for QA/reset workflows.
                    These are available in development-like envs (including
                    Vercel preview/main) and hidden on stable/production. */}
                {process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                      Dev Tools
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      disabled={isResettingKv}
                      onClick={() => {
                        runKvReset("onboarding");
                      }}
                    >
                      <Eraser className="mr-2 h-4 w-4" />
                      Clear KV onboarding state
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isResettingKv}
                      onClick={() => {
                        runKvReset("delete");
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete full KV user record
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    signOut();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
