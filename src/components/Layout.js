/** @format */

"use client";
import Navbar from "./NavBar";
import Footer from "@/components/Footer";

export function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main className={`mt-4 flex justify-center`}>{children}</main>
      <Footer />
    </>
  );
}
