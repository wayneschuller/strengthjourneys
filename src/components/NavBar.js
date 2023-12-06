/** @format */

"use client";

import * as React from "react";
import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import MobileNav from "@/components/MobileNav";
import { AvatarDropdown } from "./AvatarDropdown";
import { ParsedDataContext } from "@/pages/_app";
import { Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { devLog } from "@/lib/SJ-utils";
import { useReadLocalStorage } from "usehooks-ts";

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

// When user data is loaded, give a link to their google sheet
const UserSheetIcon = () => {
  const { parsedData, setParsedData, ssid, setSsid } =
    useContext(ParsedDataContext);
  // const [sheetFileName, setSheetFileName] = useLocalStorage("filename", null);
  // const [sheetURL, setSheetURL] = useLocalStorage("sheetURL", null);
  const sheetFileName = useReadLocalStorage("sheetFilename");
  const sheetURL = decodeURIComponent(useReadLocalStorage("sheetURL"));

  devLog(`ssid ${ssid} sheetFileName ${sheetFileName}`);
  // if (!ssid || !sheetFileName || !sheetURL) return;

  return (
    ssid &&
    sheetURL && (
      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          // devLog(`Opening ${sheetFileName}: ${sheetURL}`);
          window.open(sheetURL);
        }}
      >
        <Table2 className="h-[1.2rem] w-[1.2rem]" />
      </Button>
    )
  );
};
