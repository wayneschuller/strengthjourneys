/** @format */

"use client";

import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
import { SessionProvider } from "next-auth/react";
import { useState, createContext } from "react";
import { devLog } from "@/lib/processing-utils";

export const ParsedDataContext = createContext(null); // Internal SJ format of user gsheet (see sampleData.js for design)

export default function App({ Component, pageProps, session }) {
  // These are our key global state variables.
  // Keep this as minimal as possible. Don't put things here that can be derived.
  // We do keep liftTypes (lift names and frequency) here as an exception to save processing it too often
  const [liftTypes, setLiftTypes] = useState([]); // see @/lib/processing-utils.js for data structure design
  const [selectedLiftTypes, setSelectedLiftTypes] = useState([]); // see Layout useEffect for how we create this
  const [parsedData, setParsedData] = useState(null); // see @/lib/sample-parsed-data.js for data structure design
  const [topLiftsByTypeAndReps, setTopLiftsByTypeAndReps] = useState(null); // see @/lib/processing-utils.js for data structure design

  return (
    <>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        // enableSystem
        disableTransitionOnChange
      >
        <SessionProvider session={session}>
          <ParsedDataContext.Provider
            value={{
              parsedData,
              setParsedData,
              liftTypes,
              setLiftTypes,
              selectedLiftTypes,
              setSelectedLiftTypes,
              topLiftsByTypeAndReps,
              setTopLiftsByTypeAndReps,
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
      <SpeedInsights />
    </>
  );
}
