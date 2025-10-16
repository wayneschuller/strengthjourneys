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
import { LiftColorsProvider } from "@/hooks/use-lift-colors";

// Fonts needed for themes defined in global.css
import "@fontsource/geist-sans/index.css"; // Default font
import "@fontsource/amiko/index.css";
import "@fontsource/dm-sans/index.css";
import "@fontsource/outfit/index.css"; // Needed for retro-arcade

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
        defaultTheme="light"
        // enableSystem
        // New themes added to globals.css get added here and theme-chooser.js
        // Darkish themes should also be added to layout.js
        value={{
          light: "light",
          dark: "dark",
          "neo-brutalism": "neo-brutalism",
          "neo-brutalism-dark": "neo-brutalism-dark",
          "retro-arcade": "retro-arcade",
          "retro-arcade-dark": "retro-arcade-dark",
        }}
        disableTransitionOnChange
      >
        <SessionProvider session={session}>
          <UserLiftingDataProvider>
            <TimerProvider>
              <LiftColorsProvider>
                <Layout>
                  <Component {...pageProps} />
                  <Toaster />
                </Layout>
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
