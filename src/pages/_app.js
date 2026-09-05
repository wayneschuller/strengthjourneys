/**
 * Composes the global providers and app shell shared by every Pages Router page.
 * Provider order is intentional because downstream app state depends on auth and data.
 */

import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/ui-shell/theme-provider";
import { Layout } from "@/components/ui-shell/layout";
import { Toaster } from "@/components/ui/toaster";
import { AnalyticsSession } from "@/components/ui-shell/analytics-session";
import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { useRouter } from "next/router";
import Script from "next/script";
import { devLog } from "@/lib/processing-utils";
import { pageView, captureUtmFromUrl } from "@/lib/analytics";
import {
  REDDIT_PIXEL_ID,
  isRedditPixelEnabled,
  rdtTrackPageVisit,
} from "@/lib/reddit-pixel";
import { TimerProvider } from "@/hooks/use-timer";
import { UserLiftingDataProvider } from "@/hooks/use-userlift-data";
import { LiftColorsProvider } from "@/hooks/use-lift-colors";
import { AthleteBioProvider } from "@/hooks/use-athlete-biodata";

// Fonts needed for themes defined in global.css
import "@fontsource/geist-sans/index.css"; // Used in: light, dark
import "@fontsource/dm-sans/index.css"; // Used in: neo-brutalism, neo-brutalism-dark
import "@fontsource/outfit/index.css"; // Used in: retro-arcade, retro-arcade-dark
import "@fontsource/ibm-plex-sans-condensed/index.css"; // Used in: blueprint, blueprint-dark
import "@fontsource/libre-baskerville/index.css"; // Used in: starry-night, starry-night-dark (400 weight)
import "@fontsource/libre-baskerville/500.css"; // font-medium
import "@fontsource/libre-baskerville/600.css"; // font-semibold
import "@fontsource/libre-baskerville/700.css"; // font-bold — without these, bold text fell back to browser-faked bold

export default function App({ Component, pageProps, session }) {
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS;
  const router = useRouter();

  useEffect(() => {
    captureUtmFromUrl(); // Google Analytics: persist UTM from URL for session
    // Shallow route changes are query-string updates on the same page (calculator
    // sliders sync their state into the URL via useStateFromQueryOrLocalStorage).
    // They are not navigations, so sending page_view for them inflates GA4 views
    // by 10-20x on the calculator pages.
    const handleRouteChange = (url, { shallow } = {}) => {
      if (shallow) return;
      pageView(typeof window !== "undefined" ? window.location.href : ""); // Google Analytics: send page_view with full URL
      devLog(
        "Google Analytics pageView:",
        typeof window !== "undefined" ? window.location.href : "",
      );
      rdtTrackPageVisit(); // Reddit Ads: the base pixel only counts the landing page itself
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  return (
    <>
      <MotionConfig reducedMotion="user">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          // New themes added to globals.css get added here.
          // Order matters twice over: the theme pickers render this list in
          // order, and it should match the reward ladder in lib/rewards/catalog.js
          // so an unlocked theme never sits below a locked one.
          themes={[
            "light",
            "dark",
            "blueprint",
            "blueprint-dark",
            "retro-arcade",
            "retro-arcade-dark",
            "starry-night",
            "starry-night-dark",
            "neo-brutalism",
            "neo-brutalism-dark",
          ]}
          // Keep theme changes instant; transitions remain enabled for now.
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
      </MotionConfig>
      <Analytics />
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
      {/* Reddit Ads pixel. Reddit's own base snippet, verbatim apart from the
          pixel ID, so it keeps working if they change what pixel.js expects.
          Skipped entirely in development. See lib/reddit-pixel.js. */}
      {isRedditPixelEnabled() && (
        <Script id="reddit-pixel" strategy="afterInteractive">
          {`
            !function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);
            rdt('init','${REDDIT_PIXEL_ID}');
            rdt('track','PageVisit');
          `}
        </Script>
      )}
    </>
  );
}
