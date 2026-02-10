/** @format */

"use client";

import "@/styles/globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { AnalyticsSession } from "@/components/analytics-session";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/router";
import Script from "next/script";
import { devLog } from "@/lib/processing-utils";
import { pageView, captureUtmFromUrl } from "@/lib/analytics";
import { TimerProvider } from "@/hooks/use-timer";
import { UserLiftingDataProvider } from "@/hooks/use-userlift-data";
import { LiftColorsProvider } from "@/hooks/use-lift-colors";
import { AthleteBioProvider } from "@/hooks/use-athlete-biodata";

// Fonts needed for themes defined in global.css
import "@fontsource/geist-sans/index.css"; // Used in: light, dark
import "@fontsource/dm-sans/index.css"; // Used in: neo-brutalism, neo-brutalism-dark
import "@fontsource/outfit/index.css"; // Used in: retro-arcade, retro-arcade-dark
import "@fontsource/libre-baskerville/index.css"; // Used in: starry-night, starry-night-dark

export default function App({ Component, pageProps, session }) {
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS;
  const router = useRouter();

  useEffect(() => {
    captureUtmFromUrl(); // Google Analytics: persist UTM from URL for session
    const handleRouteChange = () => {
      pageView(typeof window !== "undefined" ? window.location.href : ""); // Google Analytics: send page_view with full URL
      devLog("Google Analytics pageView:", typeof window !== "undefined" ? window.location.href : "");
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  return (
    <>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        // New themes added to globals.css get added here
        themes={[
          "light",
          "dark",
          "neo-brutalism",
          "neo-brutalism-dark",
          "retro-arcade",
          "retro-arcade-dark",
          "starry-night",
          "starry-night-dark",
        ]}
        // I'm not sure about the next two options. Commenting out for now.
        // enableSystem
        // disableTransitionOnChange
      >
        <SessionProvider session={session}>
          <AnalyticsSession />
          <UserLiftingDataProvider>
            <TimerProvider>
              <LiftColorsProvider>
                <AthleteBioProvider>
                  <Layout>
                    <Component {...pageProps} />
                    <Toaster />
                  </Layout>
                </AthleteBioProvider>
              </LiftColorsProvider>
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
    </>
  );
}
