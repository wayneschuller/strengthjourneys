/**
 * Landing-page hero for Strength Journeys.
 * Keep the CTA branching aligned with auth + sheet-link state so setup and
 * import actions feel consistent with the rest of the onboarding flow.
 *
 * Positioning note: the Google Sheet is the *guarantee*, not the *demo*. It is
 * stated once, permanently, in the strip under the showcase rather than given
 * slides of its own — a picture of raw spreadsheet rows sells the old data-entry
 * chore instead of the log, and burns hero slots doing it. Keep sheet imagery
 * out of the rotation and let every slide show the app working for the lifter.
 */

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Upload, ArrowRight } from "lucide-react";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";
import { SloganCarousel } from "@/components/homepage/slogan-carousel";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Landing page hero section. Renders the headline stack, the primary CTAs, and
 * the product showcase slideshow side by side, with the slogan carousel
 * demoted below the fold-level content as brand texture.
 *
 * @param {Object} props - No props.
 */
export function HeroSection() {
  return (
    <div>
      <div className="grid grid-cols-1 items-center gap-8 xl:grid-cols-2 xl:gap-12">
        <div>
          <p className="text-muted-foreground text-center text-sm font-semibold tracking-wide uppercase lg:text-left">
            Free barbell lifting log &amp; analysis
          </p>
          <h1 className="mt-3 mb-4 text-center text-3xl leading-tight font-extrabold tracking-tight text-balance md:mb-5 lg:text-left lg:text-4xl xl:text-5xl">
            Every barbell set you&rsquo;ve ever lifted, in one place you&rsquo;ll
            never lose.
          </h1>
          <p className="text-muted-foreground mb-6 max-w-xl text-center text-base leading-relaxed text-pretty lg:text-left md:text-lg">
            Log today&rsquo;s session in seconds, watch your estimated one rep
            max climb, and keep the whole history in a Google Sheet you own.
          </p>
          <HeroPrimaryCta />
        </div>
        <ProductShowcase />
      </div>
      <div className="mt-10 flex flex-row justify-center">
        <SloganCarousel />
      </div>
    </div>
  );
}

// Internal helper: prominent hero CTA area for unauthenticated visitors and
// authenticated demo-mode users who still need to set up a sheet.
function HeroPrimaryCta() {
  const { status: authStatus } = useSession();
  const { hasUserData, sheetInfo } = useUserLiftingData();

  if (hasUserData) return null;

  // Treat "loading" the same as "unauthenticated" — this matches SSR output so
  // there's no hydration mismatch, then React updates once auth resolves.
  const isAuthed = authStatus === "authenticated";
  const hasSsid = isAuthed && !!sheetInfo?.ssid;
  const importCtaLabel = hasSsid
    ? "Import More Lifting History"
    : "Import From Another App";
  // Name the source apps for unauthenticated visitors: "another fitness app" is
  // abstract, while seeing their own app named is what makes the merge story
  // land — and those are the words people actually search for.
  const importCtaDescription = isAuthed
    ? hasSsid
      ? "Instant preview first. Merge new entries into your linked sheet when you're ready."
      : "Instant preview first. Save your data into a free Google Sheet when you're ready."
    : "Hevy, Strong, Wodify, or a spreadsheet. No sign-in required.";

  return (
    <div className="flex flex-col items-center gap-4 md:items-start">
      {/* Primary + secondary CTAs side by side on sm+, stacked on mobile */}
      <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
        {/* Primary CTA column */}
        <div className="flex w-full flex-col items-center sm:w-auto">
          {isAuthed ? (
            <Button
              size="lg"
              className="w-full hover:ring-2 sm:w-auto"
              onClick={() => {
                openSheetSetupDialog("bootstrap");
              }}
            >
              <img
                src={GOOGLE_SHEETS_ICON_URL}
                alt=""
                className="h-5 w-5 shrink-0"
                aria-hidden
              />
              Set Up Your Free Lifting Log
            </Button>
          ) : (
            <GoogleSignInButton
              size="lg"
              className="w-full hover:ring-2 sm:w-auto"
              cta="hero"
            >
              <span className="hidden sm:inline">
                Start Your Strength Journey
              </span>
              <span className="sm:hidden">Start Your Journey</span>
            </GoogleSignInButton>
          )}
          <p className="mt-1.5 text-xs text-slate-500">
            Free forever. Your data stays yours.
          </p>
        </div>

        {/* Secondary CTA column */}
        <div className="flex w-full flex-col items-center sm:w-auto">
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            asChild
            onClick={() =>
              gaEvent(GA_EVENT_TAGS.HERO_IMPORT_CLICK, { page: "/" })
            }
          >
            <Link
              href={{
                pathname: "/import",
                query: { from: "hero", returnTo: "/" },
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importCtaLabel}
            </Link>
          </Button>
          <p className="mt-1.5 max-w-[16rem] text-center text-xs text-slate-500 sm:text-left">
            {importCtaDescription}
          </p>
        </div>
      </div>
    </div>
  );
}

const SLIDE_DURATION = 3500; // ms per slide

// Product-only rotation. Order is deliberate: the log is what a lifter touches
// every session, so it leads; the E1RM chart is the payoff for logging; the
// heatmap is the long-game payoff that only a permanent data store can offer.
const SHOWCASE_SLIDES = [
  {
    src: "/log-hero.png",
    alt: "Strength Journeys workout log showing a barbell session with sets, reps, lifter notes and personal record badges",
    caption: "Log today's session in seconds",
  },
  {
    src: "/app1.png",
    alt: "Chart of estimated one rep max trending upward for back squat, bench press, deadlift and power clean",
    caption: "Watch your one rep max climb, lift by lift",
  },
  {
    src: "/app3.png",
    alt: "Multi-year heatmap of every lifting session with personal records highlighted",
    caption: "Ten years of training in one picture",
  },
];

/**
 * Product screenshot slideshow for the hero. Cycles app screenshots with a
 * crossfade and a floating outcome caption, over a data-ownership strip and
 * slide dots. The whole frame links through to the live demo on /log.
 *
 * Auto-advance pauses on hover/focus and is disabled entirely under
 * prefers-reduced-motion, where the dots become the only way to change slide.
 *
 * @param {Object} props - No props.
 */
export default function ProductShowcase() {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion || isPaused) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SHOWCASE_SLIDES.length);
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, [prefersReducedMotion, isPaused]);

  const handleDemoClick = useCallback(() => {
    gaEvent(GA_EVENT_TAGS.HERO_DEMO_CLICK, { page: "/" });
  }, []);

  const slide = SHOWCASE_SLIDES[index];
  // Under reduced motion the scale push is dropped and the transitions run at
  // zero duration, so a dot press swaps the slide instantly with no movement.
  const enter = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 1.05 };
  const active = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, scale: 1 };
  const leave = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.95 };

  return (
    <div className="flex flex-col items-center gap-3 md:py-4">
      <Link
        href="/log"
        onClick={handleDemoClick}
        aria-label="Open the live Strength Journeys workout log demo"
        className="ring-primary/60 block w-full max-w-2xl rounded-2xl transition hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <div className="border-border/60 bg-card relative aspect-video w-full overflow-hidden rounded-2xl border shadow-lg">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={slide.src}
              initial={enter}
              animate={active}
              exit={leave}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.6,
                ease: "easeInOut",
              }}
              className="absolute inset-0"
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                sizes="(max-width: 900px) 100vw, 900px"
                className="object-cover"
                priority={index === 0}
              />
            </motion.div>
          </AnimatePresence>

          <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 md:bottom-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={slide.caption}
                initial={
                  prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }
                }
                animate={
                  prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
                }
                exit={
                  prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }
                }
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.4,
                  delay: prefersReducedMotion ? 0 : 0.3,
                  ease: "easeOut",
                }}
                className="border-border bg-card w-max max-w-[calc(100vw-3rem)] rounded-full border px-6 py-3 text-center shadow-lg"
              >
                <p className="text-foreground text-xs font-semibold md:text-sm">
                  {slide.caption}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Link>

      {/* Controls and the ownership strip live outside the link so the dots stay
          independently operable. The Google Sheet claim sits here rather than as
          an overlay chip because no corner of the frame is free across all three
          screenshots — and read as a caption to the whole showcase it says
          "everything you just saw is stored in your own sheet", which is exactly
          the promise. It is on screen for 100% of the rotation either way. */}
      <div className="flex w-full max-w-2xl flex-col items-center gap-2">
        <div className="flex items-center gap-1.5">
          {SHOWCASE_SLIDES.map((item, i) => (
            <button
              key={item.src}
              type="button"
              aria-label={`Show slide ${i + 1}: ${item.caption}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index
                  ? "bg-foreground/70 w-5"
                  : "bg-foreground/25 hover:bg-foreground/45 w-2",
              )}
            />
          ))}
        </div>
        <div className="flex flex-col items-center gap-x-4 gap-y-1 sm:flex-row sm:justify-center">
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
            <img
              src={GOOGLE_SHEETS_ICON_URL}
              alt=""
              className="h-4 w-4 shrink-0"
              aria-hidden
            />
            Stored in a Google Sheet you own
          </span>
          <Link
            href="/log"
            onClick={handleDemoClick}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium underline-offset-4 transition-colors hover:underline"
          >
            Explore the live demo
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
