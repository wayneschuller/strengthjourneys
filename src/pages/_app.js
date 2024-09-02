/** @format */

"use client";

import "@/styles/globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/router";
import Script from "next/script";
import { devLog } from "@/lib/processing-utils";
import { TimerProvider } from "@/lib/timer-context";
import { UserLiftingDataProvider } from "@/lib/use-userlift-data";

export default function App({ Component, pageProps, session }) {
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS;
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url) => {
      let fullURL = `https://www.strengthjourneys.xyz${url}`;
      window.gtag("config", `${GA_MEASUREMENT_ID}`, {
        page_location: fullURL,
      });
      devLog(`gtagged url: ${fullURL}`);
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
        //defaultTheme="light"
        // enableSystem
        disableTransitionOnChange
      >
        <SessionProvider session={session}>
          <UserLiftingDataProvider>
            <TimerProvider>
              <Layout>
                <Component {...pageProps} />
                <Toaster />
              </Layout>
            </TimerProvider>
          </UserLiftingDataProvider>
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
      <Script
        strategy="lazyOnload"
        data-domain="strengthjourneys.xyz"
        src="https://plausible.io/js/script.js"
      />
    </>
  );
}
