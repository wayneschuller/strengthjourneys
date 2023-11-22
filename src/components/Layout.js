/** @format */

"use client";
import Navbar from "@/components/NavBar";
import Footer from "@/components/Footer";

export function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main className={`mt-6 flex justify-center`}>{children}</main>
      <Footer />
    </>
  );
}
