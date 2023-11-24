/** @format */

"use client";
import Navbar from "@/components/NavBar";
import Footer from "@/components/Footer";
import MobileNav from "./mobile-nav";

export function Layout({ children }) {
  return (
    <>
      <Navbar />
      <MobileNav />
      <main className={`mt-4 flex justify-center`}>{children}</main>
      <Footer />
    </>
  );
}
