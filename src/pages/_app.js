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

let didInit = false;

export default function App({ Component, pageProps, session }) {
  const [parsedData, setParsedData] = useState(null);
  const [ssid, setSsid] = useState(null); // FIXME: convert to useLocalStorage hook
  const [isDemoMode, setIsDemoMode] = useState(false); // needed for lift selector modes

  useEffect(() => {
    const initSsid = localStorage.getItem("ssid");
    if (!didInit && initSsid) {
      didInit = true;
      setSsid(initSsid);
      devLog(`App didInit set ssid: ${initSsid}`);
    }
  }, []);

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
              ssid,
              setSsid,
              isDemoMode,
              setIsDemoMode,
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
