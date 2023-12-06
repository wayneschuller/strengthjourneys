/** @format */

"use client";

import * as React from "react";
import { useState, useEffect, useContext } from "react";
import { useSession, signIn, sgnOut } from "next-auth/react";
import { useReadLocalStorage } from "usehooks-ts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import MobileNav from "@/components/MobileNav";
import { AvatarDropdown } from "./AvatarDropdown";
import { ParsedDataContext } from "@/pages/_app";
import useUserLiftData from "@/lib/useUserLiftData";
import { Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { devLog } from "@/lib/SJ-utils";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// import Logo from "../../public/logo_transparent.png";
// import Image from "next/image";

export default function NavBar() {
  return (
    <div className="mx-3 flex items-center md:container">
      <DesktopNav />
      <MobileNav />
      <div className="mt-2 flex flex-1 items-center justify-end gap-2">
        <UserSheetIcon />
        <DarkModeToggle />
        <AvatarDropdown />
      </div>
    </div>
  );
}

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
const UserSheetIcon = () => {
  const {
    parsedData,
    setParsedData,
    ssid,
    setSsid,
    isDemoMode,
    setIsDemoMode,
  } = useContext(ParsedDataContext);
  const sheetFilename = useReadLocalStorage("sheetFilename");
  const sheetURL = decodeURIComponent(useReadLocalStorage("sheetURL"));
  const { data: session } = useSession();
  const { data, isError, isLoading } = useUserLiftData(session, ssid);

  return (
    !isLoading &&
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
              <Table2 className="h-[1.2rem] w-[1.2rem]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Click to open {sheetFilename} </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  );
};
