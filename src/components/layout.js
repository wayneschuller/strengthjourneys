/** @format */

"use client";

import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { AppBackground } from "@/components/app-background";

export function Layout({ children }) {
  return (
    <div className="relative min-h-screen w-full bg-background">
      <AppBackground />

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
