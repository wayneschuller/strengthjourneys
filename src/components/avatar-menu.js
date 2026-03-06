import { useState, useCallback } from "react";
import { useRouter } from "next/router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession, signIn, signOut } from "next-auth/react";
import { gaTrackSignInClick } from "@/lib/analytics";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { devLog } from "@/lib/processing-utils";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LogOut,
  Table2,
  MessageSquarePlus,
  Coffee,
  Eraser,
  Trash2,
  Unplug,
} from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";

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
  const [isDisconnectingSheet, setIsDisconnectingSheet] = useState(false);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const { setTheme, theme } = useTheme();

  const {
    sheetInfo,
    clearSheet,
    enterSignedInDemoMode,
  } = useUserLiftingData();

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

  const disconnectCurrentSheet = useCallback(async () => {
    setIsDisconnectingSheet(true);
    try {
      const response = await fetch("/api/clear-sheet-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to disconnect current sheet");
      }
      devLog("[sheet-flow] disconnected current sheet from avatar menu", payload);
      clearSheet();
      enterSignedInDemoMode();
      setIsDisconnectDialogOpen(false);
      router.push("/");
    } catch (error) {
      console.error("[sheet-flow] disconnect current sheet failed:", error);
    } finally {
      setIsDisconnectingSheet(false);
    }
  }, [clearSheet, enterSignedInDemoMode, router]);

  if (authStatus !== "authenticated")
    return (
      <Button
        variant="outline"
        onClick={() => {
          gaTrackSignInClick(router.pathname, "nav_avatar");
          signIn("google", { callbackUrl: router.asPath || "/" });
        }}
      >
        Google Sign in
      </Button>
    );

  // I don't know how we could be authenticated and not have session.user.image but it happens occasionally
  // Possibly due to stale next-auth JWT token
  // Forced signOut() seems to reset everything
  if (authStatus === "authenticated" && !session?.user?.image) {
    console.error(`Next-auth being a silly-billy again.`);
    clearSheet();
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
                      <p className="pl-2 text-xs leading-none text-muted-foreground">
                        {sheetInfo.filename}
                      </p>
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
                {sheetInfo?.ssid && sheetInfo?.url && (
                  <DropdownMenuItem
                    onClick={() => window.open(sheetInfo.url)}
                  >
                    <Table2 className="mr-2 h-4 w-4" />
                    Open Google Sheet
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
                    Switch Sheets
                  </DropdownMenuItem>
                )}
                {sheetInfo?.ssid && (
                  <DropdownMenuItem onClick={() => setIsDisconnectDialogOpen(true)}>
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect Sheet
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
                    clearSheet();
                    signOut();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect your sheet?</DialogTitle>
            <DialogDescription>
              This removes your current spreadsheet from Strength Journeys and stops
              future reads of your lifting data. You&apos;ll stay signed in and return
              to demo mode until you reconnect a sheet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDisconnectDialogOpen(false)}
              disabled={isDisconnectingSheet}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void disconnectCurrentSheet();
              }}
              disabled={isDisconnectingSheet}
            >
              {isDisconnectingSheet ? "Disconnecting..." : "Disconnect Sheet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
