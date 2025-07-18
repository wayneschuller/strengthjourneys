/** @format */

"use client";

import "@/styles/globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/router";
import Script from "next/script";
import { devLog } from "@/lib/processing-utils";
import { TimerProvider } from "@/hooks/use-timer";
import { UserLiftingDataProvider } from "@/hooks/use-userlift-data";

export default function App({ Component, pageProps, session }) {
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS;
  const router = useRouter();

  useEffect(() => {
    // Don't gtag in dev
    if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
      return;
    }

    const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS; // Repeat in local scope to please eslint dep rules
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
      <Analytics />
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
      {/* Canny */}
      <Script id="canny" strategy="afterInteractive">
        {`!function(w,d,i,s){function l(){if(!d.getElementById(i)){var f=d.getElementsByTagName(s)[1],e=d.createElement(s);e.type="text/javascript",e.async=!0,e.src="https://canny.io/sdk.js",f.parentNode.insertBefore(e,f)}}if("function"!=typeof w.Canny){var c=function(){c.q.push(arguments)};c.q=[],w.Canny=c,"complete"===d.readyState?l():w.attachEvent?w.attachEvent("onload",l):w.addEventListener("load",l,!1)}}(window,document,"canny-jssdk","script");`}
      </Script>
    </>
  );
}
