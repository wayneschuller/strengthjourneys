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
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/sheet/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/sheet/open-sheet-setup";
import { useUserLiftingData, isOwnData } from "@/hooks/use-userlift-data";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics/analytics";
import { SloganCarousel } from "@/components/homepage/slogan-carousel";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Landing page hero section. Renders the slogan carousel as a full-width band,
 * then the headline stack and primary CTAs beside the product showcase.
 *
 * @param {Object} props - No props.
 */
export function HeroSection() {
  return (
    <div>
      <div className="mb-8 flex flex-row justify-center">
        <SloganCarousel />
      </div>
      <div className="grid grid-cols-1 items-center gap-8 xl:grid-cols-2 xl:gap-12">
        <div>
          <div className="flex justify-center lg:justify-start">
            <a
              href="#free-tools"
              className="bg-background/85 text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm transition-colors"
            >
              <span
                className="bg-chart-2 h-1.5 w-1.5 rounded-full"
                aria-hidden
              />
              Free barbell log, plus a full rack of free tools
              <ArrowRight className="h-3 w-3" aria-hidden />
            </a>
          </div>
          <h1 className="mt-3 mb-4 text-center text-3xl leading-tight font-extrabold tracking-tight text-balance md:mb-5 lg:text-left lg:text-4xl xl:text-5xl">
            Every barbell set you&rsquo;ve ever lifted, in one place
            you&rsquo;ll never lose.
          </h1>
          <p className="text-muted-foreground mb-6 max-w-xl text-center text-base leading-relaxed text-pretty md:text-lg lg:text-left">
            Log today&rsquo;s session in seconds, watch your estimated one rep
            max climb, and keep the whole history in a Google Sheet you own.
          </p>
          <HeroPrimaryCta />
        </div>
        <ProductShowcase />
      </div>
    </div>
  );
}

// Internal helper: prominent hero CTA area for unauthenticated visitors and
// authenticated demo-mode users who still need to set up a sheet.
function HeroPrimaryCta() {
  const { status: authStatus } = useSession();
  const { dataSource, sheetInfo } = useUserLiftingData();

  if (isOwnData(dataSource)) return null;

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
      {/* Primary + secondary CTAs side by side on sm+, stacked on mobile.
          Once side by side the columns must top-align: the two descriptions
          wrap to different line counts, so centering them vertically pushes the
          buttons out of line with each other. */}
      <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center lg:justify-start">
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

const SLIDE_DURATION = 5000; // ms per slide

// Product-only rotation. Order is deliberate: the log is what a lifter touches
// every session, so it leads; the all-time chart is the payoff for logging; then
// free tools a stranger can try right now; then the depth behind them. Each slide
// links to the feature it shows, so the showcase doubles as a way into the product.
//
// The slides are real captures of a real training history, each in a different
// theme, because a decade of data sells what sample data cannot and the themes
// are a reward lifters earn. Weights are shown in lb for our mostly US audience.
// To add a feature, drop a 16:9 WebP in /public and add an entry.
const SHOWCASE_SLIDES = [
  {
    src: "/hero-log.webp",
    alt: "Workout log in the Evergreen theme showing a deadlift session building to a lifetime best single of 463 pounds, with the lifter's notes and personal record badges",
    caption: "Log today's session in seconds",
    themeName: "Evergreen",
    href: "/log",
    linkLabel: "Explore the live demo",
  },
  {
    src: "/hero-all-time-chart.webp",
    alt: "Blueprint Dark theme chart of estimated one rep max for squat, bench and deadlift from 2014 to 2026, with five meets marked by gold medals",
    caption: "Twelve years of lifting, every meet marked in gold",
    themeName: "Blueprint Dark",
    href: "/visualizer",
    linkLabel: "Open the strength visualizer",
  },
  {
    src: "/hero-how-strong.webp",
    alt: "How Strong Am I page in the Starry Night Dark theme, with four percentile rings and a strength story beside them",
    caption: "See how strong you really are. Free, no sign-in",
    themeName: "Starry Night Dark",
    href: "/how-strong-am-i",
    linkLabel: "Try How Strong Am I?",
  },
  {
    src: "/hero-plate-milestones.webp",
    alt: "Plate Milestones page in the Neo Brutalism theme, showing one to four plates earned across press, bench, squat and deadlift, with the date of each",
    caption: "Plates get dates. Free, no sign-in",
    themeName: "Neo Brutalism",
    href: "/plate-milestones",
    linkLabel: "Check your plate milestones",
  },
  {
    src: "/hero-lift-explorer.webp",
    alt: "Lift Explorer in the Retro Arcade theme, with an illustrated tile for each barbell lift",
    caption: "Every lift you train, with a guide of its own",
    themeName: "Retro Arcade",
    href: "/lift-explorer",
    linkLabel: "Open the lift explorer",
  },
  {
    src: "/hero-ai-coach.webp",
    alt: "AI Lifting Assistant in the Retro Arcade Dark theme, with a robot coach greeting the athlete above a message box and suggested questions",
    caption: "An AI coach who reads your training",
    themeName: "Retro Arcade Dark",
    href: "/ai-lifting-assistant",
    linkLabel: "Talk to the AI coach",
  },
];

// Show a slide and mount the one after it, so its image is already loaded by the
// time the crossfade reaches it instead of fading in over an empty frame. Slides
// stay mounted once seen, which keeps the first paint to two images.
function showSlide(previous, nextIndex) {
  return {
    index: nextIndex,
    mounted: new Set(previous.mounted)
      .add(nextIndex)
      .add((nextIndex + 1) % SHOWCASE_SLIDES.length),
  };
}

/**
 * Product screenshot slideshow for the hero. Crossfades real captures in the
 * frame, with the caption underneath so it never covers the screenshot, over a
 * data-ownership strip and slide dots.
 *
 * Auto-advance pauses on hover/focus and is disabled entirely under
 * prefers-reduced-motion, where the dots become the only way to change slide.
 *
 * @param {Object} props - No props.
 */
export default function ProductShowcase() {
  const [{ index, mounted }, setShow] = useState(() =>
    showSlide({ mounted: [] }, 0),
  );
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion || isPaused) return;
    const timer = setInterval(() => {
      setShow((previous) =>
        showSlide(previous, (previous.index + 1) % SHOWCASE_SLIDES.length),
      );
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, [prefersReducedMotion, isPaused]);

  const handleSlideClick = useCallback((href) => {
    gaEvent(GA_EVENT_TAGS.HERO_DEMO_CLICK, { page: "/", destination: href });
  }, []);

  const slide = SHOWCASE_SLIDES[index];

  return (
    <div className="relative isolate flex flex-col items-center gap-3 md:py-4">
      {/* A soft colour wash behind the frame lifts the screenshots off the page,
          the same glow the getting started card uses further down. */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-visible"
        aria-hidden
      >
        <div className="from-chart-1/20 absolute -top-10 -left-10 h-64 w-64 rounded-full bg-gradient-to-br to-transparent blur-3xl" />
        <div className="from-chart-2/20 absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-gradient-to-tl to-transparent blur-3xl" />
      </div>
      <Link
        href={slide.href}
        onClick={() => handleSlideClick(slide.href)}
        aria-label={`${slide.linkLabel}: ${slide.caption}`}
        className="ring-primary/60 block w-full max-w-2xl rounded-2xl transition hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <div className="border-border/60 bg-card relative aspect-video w-full overflow-hidden rounded-2xl border shadow-lg">
          {SHOWCASE_SLIDES.map(
            (item, i) =>
              mounted.has(i) && (
                <motion.div
                  key={item.src}
                  initial={false}
                  animate={{ opacity: i === index ? 1 : 0 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.7,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0"
                >
                  <Image
                    src={item.src}
                    alt={i === index ? item.alt : ""}
                    fill
                    sizes="(max-width: 672px) 100vw, 672px"
                    className="object-cover"
                    priority={i === 0}
                  />
                </motion.div>
              ),
          )}
        </div>
      </Link>

      {/* Controls and the ownership strip live outside the link so the dots stay
          independently operable. The caption sits here too, since the old floating
          pill covered part of every screenshot and most of a phone-sized one. The
          Google Sheet claim reads as a caption to the whole showcase: "everything
          you just saw is stored in your own sheet", on screen the whole rotation. */}
      <div className="flex w-full max-w-2xl flex-col items-center gap-2">
        <p className="min-h-11 text-center text-sm font-semibold text-balance sm:min-h-6 md:text-base">
          {slide.caption}
          <span className="text-muted-foreground ml-2 text-xs font-medium whitespace-nowrap">
            {slide.themeName} theme
          </span>
        </p>
        <div className="flex items-center gap-1.5">
          {SHOWCASE_SLIDES.map((item, i) => (
            <button
              key={item.src}
              type="button"
              aria-label={`Show slide ${i + 1}: ${item.caption}`}
              aria-current={i === index}
              onClick={() => setShow((previous) => showSlide(previous, i))}
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
            href={slide.href}
            onClick={() => handleSlideClick(slide.href)}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium underline-offset-4 transition-colors hover:underline"
          >
            {slide.linkLabel}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
