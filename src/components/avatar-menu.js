"use client";

import * as React from "react";
import { useContext, useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSession, signIn, signOut } from "next-auth/react";
import useDrivePicker from "../../dependencies/react-google-drive-picker/dist";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { useLocalStorage } from "usehooks-ts";
import { devLog } from "@/lib/processing-utils";
import { Button } from "@/components/ui/button";
import {
  FolderX,
  LogOut,
  Table2,
  FolderOpenDot,
  Mail,
  Bug,
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

export function AvatarDropdown() {
  const { data: session, status: authStatus } = useSession();
  const [openPicker, authResponse] = useDrivePicker();

  const [ssid, setSsid] = useLocalStorage("ssid", null, {
    initializeWithValue: false,
  });
  const [sheetURL, setSheetURL] = useLocalStorage(
    "sheetURL",
    null,

    { initializeWithValue: false },
  );
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
    { initializeWithValue: false },
  );

  const { parsedData, isLoading, isValidating, isError } = useUserLiftingData();

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
              <Avatar className="ml-2 h-8 w-8 ring-muted-foreground hover:ring-2">
                <AvatarImage src={session.user.image} />
                <AvatarFallback>session.user.name</AvatarFallback>
                <span className="sr-only">Logged in user menu</span>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="font-bold">Athlete: </p>
                  {/* <p className="flex-row text-sm font-medium leading-none"> {session.user.name} </p> */}
                  <p className="pl-2 text-xs leading-none text-muted-foreground">
                    {session.user.email}
                  </p>
                  {sheetFilename && (
                    <>
                      <p className="font-bold">Data source loaded: </p>
                      <p className="pl-2 text-xs leading-none text-muted-foreground">
                        {sheetFilename}
                      </p>
                    </>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
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
                    <FolderOpenDot className="mr-2 h-4 w-4" />
                    Choose Google Sheet
                  </DropdownMenuItem>
                )}
                {ssid && (
                  <DropdownMenuItem
                    onClick={() => window.open(decodeURIComponent(sheetURL))}
                  >
                    <Table2 className="mr-2 h-4 w-4" />
                    Open Google Sheet
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
                    <FolderOpenDot className="mr-2 h-4 w-4" />
                    Choose New Google Sheet
                  </DropdownMenuItem>
                )}
                {/* Not sure about the next option - false for now */}
                {false && ssid && (
                  <DropdownMenuItem
                    onClick={() => {
                      setSheetURL(null);
                      setSheetFilename(null);
                      setSsid(null);
                    }}
                  >
                    <FolderX className="mr-2 h-4 w-4" />
                    <span>Forget Google Sheet</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() =>
                    window.open(
                      "https://strengthjourneys.canny.io/feature-requests",
                    )
                  }
                >
                  <Bug className="mr-2 h-4 w-4" />
                  Report bugs or feature requests
                </DropdownMenuItem>
                {/* <DropdownMenuItem
                  onClick={() =>
                    window.open(
                      "https://github.com/wayneschuller/strengthjourneys/issues",
                    )
                  }
                >
                  <Bug className="mr-2 h-4 w-4" />
                  Report Issue via Github
                </DropdownMenuItem> */}
                <DropdownMenuItem
                  onClick={() =>
                    window.open(
                      "mailto:info@strengthjourneys.xyz?subject=Thank you for Strength Journeys it is the best!",
                    )
                  }
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Email Feedback
                </DropdownMenuItem>
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
        </TooltipTrigger>
        <TooltipContent>
          <p>Open user menu</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
