"use client";

import * as React from "react";
import { useContext, useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { useSession, signIn, signOut } from "next-auth/react";
import useDrivePicker from "../../dependencies/react-google-drive-picker/dist";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { useLocalStorage } from "usehooks-ts";
import { devLog } from "@/lib/processing-utils";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AvatarDropdown() {
  const { setTheme } = useTheme();
  const { data: session, status: authStatus } = useSession();
  const [openPicker, authResponse] = useDrivePicker();
  const [ssid, setSsid] = useLocalStorage("ssid", null);
  const [sheetURL, setSheetURL] = useLocalStorage("sheetURL", null);
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
  );

  if (authStatus !== "authenticated")
    return (
      <Button variant="outline" onClick={() => signIn("google")}>
        Google Sign in
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-8 w-8 ring-muted-foreground hover:ring-2">
                <AvatarImage src={session.user.image} />
                <AvatarFallback>session.user.name</AvatarFallback>
                <span className="sr-only">Logged in user menu</span>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!ssid && (
                <DropdownMenuItem
                  onClick={() =>
                    handleOpenFilePicker(
                      openPicker,
                      session.accessToken,
                      setSsid,
                      setSheetURL,
                      setSheetFilename,
                    )
                  }
                >
                  Choose Google Sheet
                </DropdownMenuItem>
              )}
              {ssid && (
                <DropdownMenuItem
                  onClick={() => window.open(decodeURIComponent(sheetURL))}
                >
                  Open Google Sheet in new tab
                </DropdownMenuItem>
              )}
              {ssid && (
                <DropdownMenuItem
                  onClick={() =>
                    handleOpenFilePicker(
                      openPicker,
                      session.accessToken,
                      setSsid,
                      setSheetURL,
                      setSheetFilename,
                    )
                  }
                >
                  Choose New Google Sheet
                </DropdownMenuItem>
              )}
              {ssid && (
                <DropdownMenuItem
                  onClick={() => {
                    setSheetURL(null);
                    setSheetFilename(null);
                    setSsid(null);
                  }}
                >
                  Forget Google Sheet
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() =>
                  window.open(
                    "https://github.com/wayneschuller/strengthjourneys/issues",
                  )
                }
              >
                Report Issue
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  window.open(
                    "mailto:info@strengthjourneys.xyz?subject=Thank you for Strength Journeys it is the best!",
                  )
                }
              >
                Email Author
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  signOut();
                }}
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>
          <p>Open user menu</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
