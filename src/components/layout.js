/** @format */

"use client";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { GeistSans } from "geist/font/sans";

import GridPattern from "./magicui/grid-pattern";
import { cn } from "@/lib/utils";

export function Layout({ children }) {
  return (
    <div
      className={`relative min-h-screen w-full bg-background ${GeistSans.className}`}
    >
      {/* Container to hold the fixed background */}
      <div className="fixed inset-0 z-0">
        {/* GridPattern as background */}
        <GridPattern
          squares={[
            [0, 3],
            [4, 5],
            [10, 6],
            [6, 7],
            [22, 7],
            [1, 8],
            [16, 10],
            [0, 11],
            [3, 14],
            [8, 15],
            [14, 16],
          ]}
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full fill-gray-400/30 stroke-gray-800/30 dark:stroke-gray-200/30",
            "[mask-image:radial-gradient(1200px_circle_at_top_left,white,transparent)]",
            "inset-x-0 inset-y-[-30%] h-[200%] -skew-y-12",
          )}
        />
      </div>
      <div className="relative z-10">
        <NavBar />
        <main className="mx-0 md:mx-[3vw] lg:mx-[4vw] xl:mx-[5vw]">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
