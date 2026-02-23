
import * as React from "react";
import { useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession, signIn, signOut } from "next-auth/react";
import { gaTrackSignInClick } from "@/lib/analytics";
import { DrivePickerContainer } from "@/components/drive-picker-container";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { devLog } from "@/lib/processing-utils";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  FolderX,
  LogOut,
  Table2,
  MessageSquarePlus,
  Coffee,
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
  const [openPicker, setOpenPicker] = useState(null);
  const [shouldLoadPicker, setShouldLoadPicker] = useState(false);
  const { setTheme, theme } = useTheme();

  const {
    sheetInfo,
    selectSheet,
    clearSheet,
    parsedData,
    isLoading,
    isValidating,
    isError,
  } = useUserLiftingData();

  // Initialize picker when needed (only loads when user might use it)
  const handlePickerReady = useCallback((picker) => {
    setOpenPicker(() => picker);
  }, []);

  // Load picker when user opens dropdown menu (anticipate they might use it)
  // Or when they need to choose a sheet (ssid is missing)
  useEffect(() => {
    if (authStatus === "authenticated" && (!sheetInfo?.ssid || shouldLoadPicker)) {
      setShouldLoadPicker(true);
    }
  }, [authStatus, sheetInfo?.ssid, shouldLoadPicker]);

  if (authStatus !== "authenticated")
    return (
      <Button
        variant="outline"
        onClick={() => {
          gaTrackSignInClick(router.pathname);
          signIn("google");
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
      {/* Only load picker when needed - this defers ~163 KiB of Google API scripts */}
      {shouldLoadPicker && (
        <DrivePickerContainer
          onReady={handlePickerReady}
          trigger={shouldLoadPicker}
          oauthToken={session?.accessToken}
          selectSheet={selectSheet}
        />
      )}
      <DropdownMenu
        onOpenChange={(open) => {
          // Load picker when dropdown opens (user might use it)
          if (open && !shouldLoadPicker) {
            setShouldLoadPicker(true);
          }
        }}
      >
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
                      if (openPicker) handleOpenFilePicker(openPicker);
                    }}
                    disabled={!openPicker}
                    title={
                      !openPicker
                        ? "Loading Google Picker… (allow Google scripts if blocked)"
                        : undefined
                    }
                  >
                    <img
                      src={GOOGLE_SHEETS_ICON_URL}
                      alt=""
                      className="mr-2 h-4 w-4 shrink-0"
                      aria-hidden
                    />
                    {openPicker ? "Choose Google Sheet" : "Choose Google Sheet (loading…)"}
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
                      if (openPicker) handleOpenFilePicker(openPicker);
                    }}
                    disabled={!openPicker}
                    title={
                      !openPicker
                        ? "Loading Google Picker… (allow Google scripts if blocked)"
                        : undefined
                    }
                  >
                    <img
                      src={GOOGLE_SHEETS_ICON_URL}
                      alt=""
                      className="mr-2 h-4 w-4 shrink-0"
                      aria-hidden
                    />
                    {openPicker ? "Choose New Google Sheet" : "Choose New Google Sheet (loading…)"}
                  </DropdownMenuItem>
                )}

                {/* In dev environment offer a 'forget sheet' menu option. Good for testing onboarding. */}
                {process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV ===
                  "development" &&
                  sheetInfo?.ssid && (
                    <DropdownMenuItem
                      onClick={() => {
                        clearSheet();
                      }}
                    >
                      <FolderX className="mr-2 h-4 w-4" />
                      <span>Forget Google Sheet</span>
                    </DropdownMenuItem>
                  )}
                {process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development" && (
                  <DropdownMenuItem
                    onClick={() =>
                      window.dispatchEvent(new Event("open-feedback"))
                    }
                  >
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Send Feedback
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() =>
                    window.open("https://buymeacoffee.com/lrhvbjxzqr")
                  }
                >
                  <Coffee className="mr-2 h-4 w-4" />
                  Buy Me A Coffee
                </DropdownMenuItem>
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
    </>
  );
}
