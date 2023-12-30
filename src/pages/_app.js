/** @format */

"use client";

import "@/styles/globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "next-auth/react";
import { useState, useEffect, createContext } from "react";
import { useRouter } from "next/router";
import Script from "next/script";
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
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS;

  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url) => {
      window.gtag("config", `${GA_MEASUREMENT_ID}`, {
        page_path: url,
      });
    };

    // Add the event listeners
    router.events.on("routeChangeComplete", handleRouteChange);

    return () => {
      // Remove the event listener on unmount
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

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
            <Layout>
              <Component {...pageProps} />
              <Toaster />
            </Layout>
          </ParsedDataContext.Provider>
        </SessionProvider>
      </ThemeProvider>
      <SpeedInsights />

      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
