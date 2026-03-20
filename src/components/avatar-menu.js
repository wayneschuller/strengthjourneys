import { useState, useCallback } from "react";
import { useLocalStorage } from "usehooks-ts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession, signOut } from "next-auth/react";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog } from "@/lib/processing-utils";
import { useDevActivityMonitor } from "@/hooks/use-dev-activity-monitor";
import {
  LogOut,
  MessageSquarePlus,
  Coffee,
  Eraser,
  Trash2,
  Activity,
  Check,
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
  const { data: session, status: authStatus } = useSession();
  const [isResettingKv, setIsResettingKv] = useState(false);
  const { sheetInfo } = useUserLiftingData();
  const { entries } = useDevActivityMonitor();
  const [isActivityMonitorVisible, setIsActivityMonitorVisible] = useLocalStorage(
    LOCAL_STORAGE_KEYS.DEV_ACTIVITY_MONITOR_VISIBLE,
    false,
    { initializeWithValue: false },
  );

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
      <GoogleSignInButton
        variant="outline"
        cta="nav_avatar"
      >
        <span className="sm:hidden">Sign in</span>
        <span className="hidden sm:inline">Sign in with Google</span>
      </GoogleSignInButton>
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
                    <DropdownMenuItem
                      onClick={() => {
                        setIsActivityMonitorVisible((current) => !current);
                      }}
                    >
                      <Activity className="mr-2 h-4 w-4" />
                      {isActivityMonitorVisible ? "Hide" : "Show"} log activity monitor
                      <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{entries.length}</span>
                        {isActivityMonitorVisible && <Check className="h-3.5 w-3.5" />}
                      </span>
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
