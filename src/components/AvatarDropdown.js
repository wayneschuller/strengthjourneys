"use client";

import * as React from "react";
import { useContext, useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { useSession, signIn, signOut } from "next-auth/react";
import useDrivePicker from "@fyelci/react-google-drive-picker";
import { handleOpenPicker } from "@/components/handleOpenPicker";
import { ParsedDataContext } from "@/pages/_app";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AvatarDropdown() {
  const { setTheme } = useTheme();
  const { data: session } = useSession();
  const [openPicker, authResponse] = useDrivePicker();
  const { parsedData, setParsedData, ssid, setSsid } =
    useContext(ParsedDataContext);

  if (!session)
    return <Button onClick={() => signIn("google")}>Sign in</Button>;

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
              handleOpenPicker(openPicker, session.accessToken, setSsid)
            }
          >
            Choose Google Sheet
          </DropdownMenuItem>
        )}
        {ssid && (
          <DropdownMenuItem
            onClick={() =>
              handleOpenPicker(openPicker, session.accessToken, setSsid)
            }
          >
            Choose New Google Sheet
          </DropdownMenuItem>
        )}
        {ssid && (
          <DropdownMenuItem
            onClick={() => {
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
            setParsedData(null); // FIXME: do we need this? does it help?
          }}
        >
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// {
//   session && !ssid && (
//     <Button
//       onClick={() => handleOpenPicker(openPicker, session.accessToken, setSsid)}
//     >
//       Choose Google Sheet
//     </Button>
//   );
// }
// {
//   session && (
//     <Avatar onClick={() => signOut()}>
//       <AvatarImage src={session.user.image} />
//       <AvatarFallback>session.user.name</AvatarFallback>
//     </Avatar>
//   );
// }
// {
//   !session && <Button onClick={() => signIn()}>Sign in</Button>;
// }
