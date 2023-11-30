"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { useSession, signIn, signOut } from "next-auth/react";
import useDrivePicker from "@fyelci/react-google-drive-picker";
import { handleOpenPicker } from "@/components/handleOpenPicker";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AvatarDropdown({ ssid, setSsid }) {
  const { setTheme } = useTheme();
  const { data: session } = useSession();
  const [openPicker, authResponse] = useDrivePicker();

  if (!session) return <Button onClick={() => signIn()}>Sign in</Button>;

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
          <DropdownMenuItem onClick={() => setTheme("light")}>
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
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Report Issue
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Email Author
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => signOut()}>Sign Out</DropdownMenuItem>
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
