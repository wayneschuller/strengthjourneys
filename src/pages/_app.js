/** @format */

"use client";

import "@/styles/globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Script from "next/script";
import { devLog } from "@/lib/processing-utils";
import {
  initializeUTMTracking,
  trackPageView,
  getUTMParamsForGA,
  trackSignIn,
  trackFeatureVisit,
} from "@/lib/ga-utils";
import { TimerProvider } from "@/hooks/use-timer";
import { UserLiftingDataProvider } from "@/hooks/use-userlift-data";
import { LiftColorsProvider } from "@/hooks/use-lift-colors";

// Fonts needed for themes defined in global.css
import "@fontsource/geist-sans/index.css"; // Default font
import "@fontsource/amiko/index.css";
import "@fontsource/dm-sans/index.css";
import "@fontsource/outfit/index.css"; // Needed for retro-arcade

// Feature pages that we want to track
const FEATURE_PAGES = [
  "/analyzer",
  "/visualizer",
  "/barbell-strength-potential",
  "/ai-lifting-assistant",
  "/calculator",
  "/strength-level-calculator",
  "/1000lb-club-calculator",
  "/tonnage",
  "/timer",
  "/gym-playlist-leaderboard",
  "/articles",
  "/barbell-squat-insights",
  "/barbell-bench-press-insights",
  "/barbell-deadlift-insights",
  "/barbell-strict-press-insights",
];

function AppContent({ Component, pageProps }) {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const hasTrackedSignIn = useRef(false);

  // Track sign-in when user becomes authenticated
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
      return;
    }

    if (
      authStatus === "authenticated" &&
      session &&
      !hasTrackedSignIn.current
    ) {
      trackSignIn("google");
      hasTrackedSignIn.current = true;
    }
  }, [authStatus, session]);

  // Initialize UTM tracking and track initial page view
  useEffect(() => {
    // Don't gtag in dev
    if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
      return;
    }

    // Initialize UTM tracking on mount
    initializeUTMTracking();

    // Track initial page load once router is ready
    if (router.isReady) {
      const fullURL = `https://www.strengthjourneys.xyz${router.asPath}`;
      trackPageView(fullURL);

      // Track initial feature page visit if applicable
      const isFeaturePage = FEATURE_PAGES.some((path) =>
        router.asPath.startsWith(path),
      );
      if (isFeaturePage) {
        const featureName = router.asPath.split("/")[1] || "unknown";
        trackFeatureVisit(featureName, router.asPath);
      }
    }
  }, [router.isReady, router.asPath]);

  // Handle route changes
  useEffect(() => {
    // Don't gtag in dev
    if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
      return;
    }

    const handleRouteChange = (url) => {
      const fullURL = `https://www.strengthjourneys.xyz${url}`;
      trackPageView(fullURL);

      // Track feature page visits
      const isFeaturePage = FEATURE_PAGES.some((path) => url.startsWith(path));
      if (isFeaturePage) {
        const featureName = url.split("/")[1] || "unknown";
        trackFeatureVisit(featureName, url);
      }

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
    <Layout>
      <Component {...pageProps} />
      <Toaster />
    </Layout>
  );
}

export default function App({ Component, pageProps, session }) {
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS;
  const isDev = process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";

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
        ]}
        // I'm not sure about the next two options. Commenting out for now.
        // enableSystem
        // disableTransitionOnChange
      >
        <SessionProvider session={session}>
          <UserLiftingDataProvider>
            <TimerProvider>
              <LiftColorsProvider>
                <AppContent Component={Component} pageProps={pageProps} />
              </LiftColorsProvider>
            </TimerProvider>
          </UserLiftingDataProvider>
        </SessionProvider>
      </ThemeProvider>
      <Analytics />
      <SpeedInsights />
      {!isDev && GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          
          // Enhanced GA configuration with better tracking
          gtag('config', '${GA_MEASUREMENT_ID}', {
            send_page_view: false, // We'll handle page views manually to include UTM params
            anonymize_ip: true,
            allow_google_signals: true,
            allow_ad_personalization_signals: true,
          });
        `}
          </Script>
        </>
      )}
    </>
  );
}
