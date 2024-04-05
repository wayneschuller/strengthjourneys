/** @format */

"use client";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { GeistSans } from "geist/font/sans";

export function Layout({ children }) {
  return (
    <div className={`bg-background ${GeistSans.className}`}>
      <NavBar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
