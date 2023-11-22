/** @format */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DarkModeToggle } from "@/components/DarkModeToggle";

export default function NavBar() {
  const pathname = usePathname();

  // {/* <div className="flex flex-1 flex-row gap-4 "> */}

  return (
    <>
      <div className="ml-4 mr-2 flex">
        <nav className="flex flex-1 items-center space-x-2 text-sm font-medium md:space-x-6">
          <Link
            href="/"
            className={cn(
              "transition-colors hover:text-foreground/80",
              pathname === "/" ? "text-foreground" : "text-foreground/60",
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
        <div className="p-2">
          <DarkModeToggle />
        </div>
      </div>
    </>
  );
}
