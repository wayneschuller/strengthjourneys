/** @format */

/**
 * Custom 404 page.
 *
 * Two jobs. First, catch stray traffic and hand it back to something real:
 * mistyped URLs, stale links from old forum posts, and the long tail of paths
 * Google still remembers all land here, and the stock Next.js 404 sends every
 * one of them straight back out again.
 *
 * Second, tell us which links are broken. Vercel's per-path 404 breakdown sits
 * behind the Pro tier, so the page reports the missing path to GA4 itself,
 * reusing dimensions that are already registered there.
 *
 * Note on hydration: pages/404.js is statically generated, so the requested URL
 * is only knowable in the browser. Anything derived from it is held back until
 * after mount rather than rendered during SSG, which is why the quip fades in
 * instead of being part of the first paint.
 */

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { motion } from "motion/react";
import {
  Anvil,
  BicepsFlexed,
  Calculator,
  LineChart,
  Mountain,
  NotebookText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-header";
import { QuickLinkCard } from "@/components/quick-link-card";
import { getNotFoundLine } from "@/lib/not-found-lines";
import { gaTrackPageNotFound } from "@/lib/analytics";

/**
 * Where to send a lost visitor. Logging leads because it is the thing the site
 * actually does, and someone who arrived on a dead URL has probably never seen
 * it. The rest follow the share of search traffic they carry.
 */
const RESCUE_LINKS = [
  {
    href: "/log",
    title: "Log & Session Browser",
    description:
      "Log a set, browse past sessions, and get your warm-up loading worked out. Open it on the demo data.",
    icon: <NotebookText className="h-5 w-5" />,
  },
  {
    href: "/how-strong-am-i",
    title: "How Strong Am I",
    description:
      "See where your squat, bench, deadlift, and press sit against everyone else's.",
    icon: <BicepsFlexed className="h-5 w-5" />,
  },
  {
    href: "/strength-levels",
    title: "Strength Levels",
    description:
      "Standards for the big four by bodyweight, age, and sex, with the full percentile curve.",
    icon: <Mountain className="h-5 w-5" />,
  },
  {
    href: "/1000lb-club-calculator",
    title: "1000lb Club Calculator",
    description:
      "Squat plus bench plus deadlift. Find out how far off the thousand you are.",
    icon: <Anvil className="h-5 w-5" />,
  },
  {
    href: "/calculator",
    title: "One Rep Max Calculator",
    description:
      "Estimate a 1RM from any set you have actually done. No login.",
    icon: <Calculator className="h-5 w-5" />,
  },
  {
    href: "/lift-explorer",
    title: "Lift Explorer",
    description:
      "Walk through a lifting history one lift at a time. Try it with the demo data.",
    icon: <LineChart className="h-5 w-5" />,
  },
];

export default function NotFound() {
  // The address bar is an external store here: this page was prerendered at
  // build time, so the path that actually 404ed exists only in the browser.
  // useSyncExternalStore gives React a null server snapshot to hydrate against,
  // which is cleaner than setting state from an effect and then patching it up.
  const requestedPath = useSyncExternalStore(
    subscribeToLocation,
    () => window.location.pathname,
    () => null,
  );

  useEffect(() => {
    gaTrackPageNotFound(
      window.location.pathname,
      referrerSurface(document.referrer),
    );
  }, []);

  return (
    <PageContainer>
      <NextSeo
        title="Page Not Found | Strength Journeys"
        description="That page does not exist. Here is the way back to the calculators, standards, and lifting tools."
        noindex={true}
        nofollow={true}
      />

      <section className="flex flex-col items-center py-10 text-center md:py-16">
        <div className="relative flex items-center justify-center">
          <span
            aria-hidden="true"
            className="from-foreground/20 to-foreground/5 pointer-events-none bg-gradient-to-b bg-clip-text text-[7rem] leading-none font-black tracking-tighter text-transparent select-none sm:text-[11rem] md:text-[15rem]"
          >
            404
          </span>
          {/* The lifter is the most obvious thing on the page, so it may as
              well be a way out. The link carries the sizing and the figure
              fills it, keeping the hit area to the figure itself. */}
          <Link
            href="/"
            aria-label="Back to the main page"
            className="absolute h-36 w-36 sm:h-52 sm:w-52 md:h-64 md:w-64"
          >
            <motion.img
              src="/deadlift.svg"
              alt=""
              aria-hidden="true"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="h-full w-full object-contain dark:invert"
            />
          </Link>
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">
          There is nothing on this bar.
        </h1>

        {/* Reserve the height so the fade-in does not shove the buttons down. */}
        <div className="mt-4 flex min-h-14 max-w-xl items-start justify-center">
          {requestedPath && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              className="text-muted-foreground text-lg text-balance"
            >
              {getNotFoundLine(requestedPath)}
            </motion.p>
          )}
        </div>

        {requestedPath && (
          <p className="text-muted-foreground/80 max-w-full truncate text-sm">
            You asked for{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono">
              {requestedPath}
            </code>
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/">Back to the main page</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/log" prefetch={false}>
              Look at a real training log
            </Link>
          </Button>
        </div>
      </section>

      <section className="pb-16">
        <h2 className="text-muted-foreground mb-4 text-center text-sm font-medium tracking-wide uppercase">
          Somewhere that does exist
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESCUE_LINKS.map((link) => (
            <QuickLinkCard key={link.href} {...link} />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}

/**
 * Bucket the referrer into something worth reporting. An external host is the
 * useful answer, because that is the site carrying the broken link. Our own
 * host means a bad internal link, which is ours to fix.
 *
 * @param {string} referrer - document.referrer, often an empty string.
 * @returns {string} A hostname, or "direct" / "internal".
 */
function referrerSurface(referrer) {
  if (!referrer) return "direct";
  try {
    const { host } = new URL(referrer);
    return host === window.location.host ? "internal" : host;
  } catch {
    return "direct";
  }
}

/**
 * A 404's URL cannot change without a full navigation, which remounts the page,
 * so there is genuinely nothing to subscribe to.
 */
function subscribeToLocation() {
  return () => {};
}
