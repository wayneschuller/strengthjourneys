/** @format */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import MobileNav from "@/components/MobileNav";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import useDrivePicker from "@fyelci/react-google-drive-picker";

// import Logo from "../../public/logo_transparent.png";
// import Image from "next/image";

export default function NavBar() {
  const { data: session } = useSession();
  const [openPicker, authResponse] = useDrivePicker();

  // session.accessToken
  // console.log(session);
  const handleOpenPicker = () => {
    openPicker({
      clientId:
        "666675096917-bnglrufs6q2q0gmpdof0cjks6pjbchoc.apps.googleusercontent.com",
      developerKey: "AIzaSyB1bu2k6O_v2-1LRVeOfgh5r-KZfgxABTI",
      viewId: "DOCS",
      token: session.accessToken, // pass oauth token in case you already have one
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: true,
      // customViews: customViewsArray, // custom view
      callbackFunction: (data) => {
        if (data.action === "cancel") {
          console.log("User clicked cancel/close button");
        }
        console.log(data);
        localStorage.setItem("SJ_googleSheetId", data.ssid);
      },
    });
  };

  return (
    <div className="mx-3 flex items-center md:container">
      <DesktopNav />
      <MobileNav />
      <div className="mt-2 flex flex-1 items-center justify-end gap-2">
        {session && (
          <Button onClick={() => handleOpenPicker()}>
            Choose Google Sheet
          </Button>
        )}
        {session && (
          <Avatar onClick={() => signOut()}>
            <AvatarImage src={session.user.image} />
            <AvatarFallback>session.user.name</AvatarFallback>
          </Avatar>
        )}
        {!session && <Button onClick={() => signIn()}>Sign in</Button>}
        <DarkModeToggle />
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
