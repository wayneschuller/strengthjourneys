/** @format */

"use client";
import Navbar from "./NavBar";
import Footer from "@/components/Footer";
import { SessionProvider } from "next-auth/react";
import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { parseGSheetData } from "@/lib/parseGSheetData";
import { useSession, signIn, signOut } from "next-auth/react";
import useUserLiftData from "@/lib/useUserLiftData";
import { devLog } from "@/lib/SJ-utils";
import { sampleParsedData } from "@/lib/sampleParsedData";

export function Layout({ children }) {
  const { parsedData, setParsedData, ssid, setSsid } =
    useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { data, isError, isLoading } = useUserLiftData(session, ssid);

  // When the user has gsheet data here were parse it for the components
  useEffect(() => {
    // devLog(`<Layout /> useEffect[data]:`);
    // devLog(data);

    let localParsedData = null;

    // Get some parsedData
    if (data?.values) {
      localParsedData = parseGSheetData(data.values);
    } else {
      localParsedData = sampleParsedData;
    }

    setParsedData(localParsedData);
  }, [data]);

  return (
    <>
      <Navbar />
      <main className={`mt-4 flex justify-center`}>{children}</main>
      <Footer />
    </>
  );
}
