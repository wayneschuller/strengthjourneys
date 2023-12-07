/** @format */

"use client";

import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/toaster";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
import { SessionProvider } from "next-auth/react";
import { useState, useEffect, createContext } from "react";
import useUserLiftData from "@/lib/useUserLiftData";
import { devLog } from "@/lib/SJ-utils";
import { sampleParsedData } from "@/lib/sampleParsedData";

export const ParsedDataContext = createContext(null); // Internal SJ format of user gsheet (see sampleData.js for design)

export default function App({ Component, pageProps, session }) {
  // These are our key global state variables.
  // Keep this as minimal as possible. Don't put things here that can be derived.
  // We do keep liftTypes (lift names and frequency) here as an exception to save processing it too often
  const [liftTypes, setLiftTypes] = useState([]); // Array of {liftType: "Deadlift", frequency: 232} objects
  const [selectedLiftTypes, setSelectedLiftTypes] = useState([]); // Array of liftType strings - syncs to localStorage
  const [parsedData, setParsedData] = useState(null); // Our main big set of data that components look for
  const [isDemoMode, setIsDemoMode] = useState(true); // needed for lift selector modes (FIXME: find a way to not need it?)

  return (
    <>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SessionProvider session={session}>
          <ParsedDataContext.Provider
            value={{
              parsedData,
              setParsedData,
              isDemoMode,
              setIsDemoMode,
              liftTypes,
              setLiftTypes,
              selectedLiftTypes,
              setSelectedLiftTypes,
            }}
          >
            <div className={`min-h-screen bg-background ${inter.className}`}>
              <Layout>
                <Component {...pageProps} />
              </Layout>
              <Toaster />
            </div>
          </ParsedDataContext.Provider>
        </SessionProvider>
      </ThemeProvider>
      <Analytics />
    </>
  );
}
