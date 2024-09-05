/** @format */

"use client";
import Image from "next/image";
import Script from "next/script";
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
import { Table2, Loader2, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { devLog } from "@/lib/processing-utils";
import { MiniTimer } from "@/pages/timer";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useTheme } from "next-themes";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import darkModeLogo from "/public/nav_logo_light.png";
import lightModeLogo from "/public/nav_logo_dark.png";

import { SidePanelSelectLiftsButton } from "@/components/side-panel-lift-chooser";

export function NavBar() {
  const pathname = usePathname();

  useEffect(() => {
    // Not proud of putting this in a timer but it makes it work
    const timer = setTimeout(() => {
      if (window?.Canny) {
        window.Canny("initChangelog", {
          appID: "65ae4d4c921071bb0aae99c3",
          position: "bottom",
          align: "left",
          theme: "dark",
        });
      }
    }, 1000); // 1 second timeout

    return () => clearTimeout(timer); // Cleanup timeout on unmount
  }, [pathname]);

  return (
    <div className="m-2 flex md:ml-10 md:max-w-[90vw] xl:ml-24">
      <div className="flex items-center">
        <DesktopNav />
        <MobileNav />
      </div>
      <div className="ml-2 flex flex-1 flex-row items-center justify-end gap-2">
        {/* Only show the select lifts button on the analyzer and visualizer pages */}
        {(pathname === "/analyzer" || pathname === "/visualizer") && (
          <SidePanelSelectLiftsButton isIconMode={true} />
        )}
        <MiniTimer />
        {/* <UserSheetIcon /> */}
        <div className="hidden xl:block">
          <GitHubButton />
        </div>
        <DarkModeToggle />
        <AvatarDropdown />
      </div>
    </div>
  );
}

// FIXME: use the featurePages array in index.js?

export function DesktopNav() {
  const pathname = usePathname();
  const { isValidating } = useUserLiftingData();

  return (
    <div className="hidden align-middle md:flex">
      <Link
        href="/"
        className={cn(
          "mr-10 flex items-center",
          isValidating && "animate-pulse",
        )}
      >
        <Image
          src={lightModeLogo}
          width={100}
          height="auto"
          alt="logo"
          className="inline-block dark:hidden"
          priority={true}
        />
        <Image
          src={darkModeLogo}
          width={100}
          height="auto"
          alt="logo"
          className="hidden dark:inline-block"
          priority={true}
        />
      </Link>
      {/* FIXME: we should loop over the feature pages array from the index here */}
      <nav className="flex flex-1 items-center space-x-2 text-sm font-medium md:space-x-6">
        <Link
          href="/analyzer"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/analyzer" ? "text-foreground" : "text-foreground/60",
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
          {/* Short title on small screens */}
          <span className="hidden md:block xl:hidden">Visualizer</span>
          {/* Full title on larger screens */}
          <span className="hidden xl:block">Strength Visualizer</span>
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
          {/* Short title on small screens */}
          <span className="hidden md:block xl:hidden">E1RM Calc</span>
          {/* Full title on larger screens */}
          <span className="hidden xl:block">One Rep Max Calculator</span>
        </Link>
        <Link
          href="/strength-level-calculator"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/strength-level-calculator"
              ? "text-foreground"
              : "text-foreground/60",
          )}
        >
          {/* Short title on small screens */}
          <span className="hidden md:block lg:hidden">Strength Calc</span>
          {/* Full title on larger screens */}
          <span className="hidden lg:block">Strength Level Calculator </span>
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
            "hidden md:block",
          )}
        >
          {/* Short title on small screens */}
          <span className="hidden md:block lg:hidden">Timer</span>
          {/* Full title on larger screens */}
          <span className="hidden lg:block">Lifting Set Timer</span>
        </Link>
        <Link
          href="/gym-playlist-leaderboard"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/gym-playlist-leaderboard"
              ? "text-foreground"
              : "text-foreground/60",
            "hidden md:block",
          )}
        >
          Music
        </Link>
        <Link
          href="/articles"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname.startsWith("/articles")
              ? "text-foreground"
              : "text-foreground/60",
            "hidden lg:block", // Only show articles on LG
          )}
        >
          Articles
        </Link>
        <button
          data-canny-changelog
          className={cn(
            "text-muted-foreground hover:text-foreground/80",
            "hidden 2xl:block", // Only show articles on 2XL
          )}
        >
          What&apos;s New
        </button>
      </nav>
    </div>
  );
}

// When user is logged in with data, give a link to their google sheet
// Also we have a subtle pulse animation when we are trying to look for new data from google (via useSWR isValidating)
export function UserSheetIcon() {
  // We need the next 3 for the file picker button
  const [ssid, setSsid] = useLocalStorage("ssid", null);
  const [sheetURL, setSheetURL] = useLocalStorage("sheetURL", null);
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
  );
  const { data: session, status: authStatus } = useSession();
  const { parsedData, isLoading, isValidating, isError } = useUserLiftingData();

  // devLog( `<UserSheetIcon /> isLoading: ${isLoading}, isValidating ${isValidating}, isError: ${isError}, authStatus: ${authStatus}`,);

  // Some guard rails
  if (authStatus !== "authenticated") return null;
  if (isLoading) return null;

  return (
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
                devLog(sheetURL);
                window.open(decodeURIComponent(sheetURL));
              }}
            >
              {!isValidating && <Table2 className="h-[1.2rem] w-[1.2rem]" />}
              {isValidating && (
                <Table2 className="h-[1.2rem] w-[1.2rem] animate-pulse" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Click to open {sheetFilename} </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  );
}

export function GitHubButton() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              window.open(
                decodeURIComponent(
                  "https://github.com/wayneschuller/strengthjourneys",
                ),
              );
            }}
            aria-label="Open GitHub repository"
          >
            <Github className="h-[1.2rem] w-[1.2rem]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View source code on Github</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
