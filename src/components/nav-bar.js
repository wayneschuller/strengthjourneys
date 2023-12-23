/** @format */

"use client";

import * as React from "react";
import { useState, useEffect, useContext } from "react";
import { useSession, signIn, sgnOut } from "next-auth/react";
import { useLocalStorage } from "usehooks-ts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { MobileNav } from "@/components/mobile-nav";
import { AvatarDropdown } from "@/components/avatar-menu";
import { useUserLiftData } from "@/lib/use-userlift-data";
import { Table2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { devLog } from "@/lib/processing-utils";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidePanelSelectLiftsButton } from "@/components/side-panel-lift-chooser";

// import Logo from "../../public/logo_transparent.png";
// import Image from "next/image";

export function NavBar() {
  const pathname = usePathname();

  return (
    <div className="mx-3 flex items-center xl:mx-16">
      <DesktopNav />
      <MobileNav />
      <div className="ml-2 mt-3 flex flex-1 items-center justify-end gap-3">
        {(pathname === "/analyzer" || pathname === "/visualizer") && (
          <SidePanelSelectLiftsButton isIconMode={true} />
        )}
        <UserSheetIcon />
        <AvatarDropdown />
        <DarkModeToggle />
      </div>
    </div>
  );
}

// FIXME: make the menu nav options an array and reuse in MobileNav

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <>
      <div className="ml-4 hidden md:flex">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          {/* <Image src={Logo} className="h-10 w-10" alt="Logo" /> */}
          <span className="inline-block font-bold">Strength Journeys</span>
        </Link>
        <nav className="flex flex-1 items-center space-x-2 text-sm font-medium md:space-x-6">
          <Link
            href="/analyzer"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/analyzer"
                ? "text-foreground"
                : "text-foreground/60",
            )}
          >
            PR Analyzer
          </Link>
          <Link
            href="/visualizer"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/visualizer"
                ? "text-foreground"
                : "text-foreground/60",
            )}
          >
            Strength Visualizer
          </Link>
          <Link
            href="/calculator"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/calculator"
                ? "text-foreground"
                : "text-foreground/60",
            )}
          >
            One Rep Max Calculator
          </Link>
          {/* <Link
            href="/warmups"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/timer" ? "text-foreground" : "text-foreground/60",
            )}
          >
            Warm Up Sets
          </Link> */}
          <Link
            href="/timer"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/timer" ? "text-foreground" : "text-foreground/60",
            )}
          >
            Lifting Set Timer
          </Link>
        </nav>
      </div>
    </>
  );
}

// When user is logged in with data, give a link to their google sheet
// This is also a subtle spot to indicate when we are trying to look for new data from google
export function UserSheetIcon() {
  // We need the next 3 for the file picker button
  const [ssid, setSsid] = useLocalStorage("ssid", null);
  const [sheetURL, setSheetURL] = useLocalStorage("sheetURL", null);
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
  );
  const { data: session, status: authStatus } = useSession();
  const { data, isError, isLoading, isValidating } = useUserLiftData();

  return (
    session?.user &&
    ssid &&
    sheetURL &&
    sheetFilename && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                window.open(sheetURL);
              }}
            >
              {!isValidating && <Table2 className="h-[1.2rem] w-[1.2rem]" />}
              {isValidating && (
                <Loader2 className="h-[1.2rem] w-[1.2rem] animate-spin" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Click to open {sheetFilename} </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  );
}
