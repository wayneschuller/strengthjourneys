"use client";

import * as React from "react";
import { useContext, useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { useSession, signIn, signOut } from "next-auth/react";
import useDrivePicker from "@fyelci/react-google-drive-picker";
import { handleOpenPicker } from "@/components/handleOpenPicker";
import { ParsedDataContext } from "@/pages/_app";
import { useLocalStorage } from "usehooks-ts";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AvatarDropdown() {
  const { setTheme } = useTheme();
  // const { data: session } = useSession();
  const { data: session } = useSession({ autoSignIn: false });

  const [openPicker, authResponse] = useDrivePicker();
  const { parsedData, setParsedData, ssid, setSsid } =
    useContext(ParsedDataContext);
  const [sheetURL, setSheetURL] = useLocalStorage("sheetURL", null);
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
  );

  if (!session)
    return (
      <Button variant="outline" onClick={() => signIn("google")}>
        Sign in to personalize
      </Button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar>
          <AvatarImage src={session.user.image} />
          <AvatarFallback>session.user.name</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!ssid && (
          <DropdownMenuItem
            onClick={() =>
              handleOpenPicker(
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
            onClick={() =>
              handleOpenPicker(
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
              localStorage.removeItem("ssid");
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
  );
}
