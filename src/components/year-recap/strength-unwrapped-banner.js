import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { motion, useReducedMotion } from "motion/react";
import { useIsClient, useLocalStorage, useReadLocalStorage } from "usehooks-ts";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { APP_BANNER_STRIP_INSET } from "@/components/ui/app-banner";
import { useUserLiftingData, isOwnData } from "@/hooks/use-userlift-data";
import {
  computeLifterTypeForYear,
  computeMostTrainedLiftForYear,
  computeSessionStatsForYear,
} from "@/lib/year-recap-stats";
import { getLifetimePRsAchievedInYear } from "@/lib/processing-utils";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { getLiftArtwork } from "@/components/lift-artwork";
import { getRecapFirstName } from "@/components/year-recap/cards/title-card";

// Wrapped season runs through December, and people are still looking back in
// the first fortnight of January, so the banner stays up for last year's recap.
const JANUARY_DAYS_IN_SEASON = 15;
const MIN_SESSIONS_FOR_TEASER = 3;
// Closing the banner hides it this long. Short enough that it comes back
// before the season slips away, since a lifter who closed it meant "later".
const SNOOZE_MS = 4 * 24 * 60 * 60 * 1000;

/**
 * Which year's recap is in season, or null outside the season.
 * @param {Date} [now]
 * @returns {number|null}
 */
export function getRecapSeasonYear(now = new Date()) {
  if (now.getMonth() === 11) return now.getFullYear();
  if (now.getMonth() === 0 && now.getDate() <= JANUARY_DAYS_IN_SEASON) {
    return now.getFullYear() - 1;
  }
  return null;
}

/**
 * Seasonal top banner for Strength Unwrapped, from December 1 to January 15
 * (or anytime with ?showRecapBanner=1). A lifter with their own data sees a
 * teaser of their year on every page: sessions, lifetime PRs, and their lifter
 * type blurred until they open it. Closing it hides it for four days; it keeps
 * coming back until they have watched their recap. Visitors without their
 * own data get the invitation on the home page only, under the demo banner.
 */
export function StrengthUnwrappedBanner() {
  const router = useRouter();
  const isClient = useIsClient();
  const { data: session } = useSession();
  const { parsedData, meetDays, dataSource } = useUserLiftingData();
  const [snoozedAt, setSnoozedAt] = useLocalStorage(
    LOCAL_STORAGE_KEYS.RECAP_BANNER_SNOOZED_AT,
    null,
    { initializeWithValue: false },
  );
  const viewedYear = useReadLocalStorage(LOCAL_STORAGE_KEYS.RECAP_VIEWED_YEAR, {
    initializeWithValue: false,
  });

  // The preview flag beats a snooze or a viewing, so it always shows.
  const forceShow = router.query?.showRecapBanner === "1";
  const seasonYear =
    getRecapSeasonYear() ?? (forceShow ? new Date().getFullYear() : null);
  const ownData = isOwnData(dataSource);
  // Client only, since the season depends on today and the snooze on storage.
  // Wait for the lifter's data too, so they never see the generic version
  // flash before their own.
  const shouldShow =
    isClient &&
    seasonYear != null &&
    router.pathname !== "/strength-year-in-review" &&
    (forceShow ||
      (!(snoozedAt && Date.now() - snoozedAt < SNOOZE_MS) &&
        viewedYear !== seasonYear &&
        (ownData || router.pathname === "/"))) &&
    dataSource !== "loading" &&
    dataSource !== "restoring" &&
    !(ownData && !parsedData);

  const teaser = useMemo(() => {
    if (!shouldShow || !ownData) return null;
    const sessions = computeSessionStatsForYear(parsedData, seasonYear);
    if (sessions.count < MIN_SESSIONS_FOR_TEASER) return null;
    return {
      sessionCount: sessions.count,
      prCount: getLifetimePRsAchievedInYear(parsedData, seasonYear).length,
      lifterType: computeLifterTypeForYear(parsedData, seasonYear, meetDays),
      mostTrainedLift: computeMostTrainedLiftForYear(parsedData, seasonYear)
        .mostTrainedLift,
    };
  }, [shouldShow, ownData, parsedData, seasonYear, meetDays]);

  if (!shouldShow) return null;

  const firstName = teaser ? getRecapFirstName(session) : null;
  const href = `/strength-year-in-review?year=${seasonYear}`;
  const title = teaser
    ? firstName
      ? `${firstName}, your ${seasonYear} is ready to unwrap`
      : `Your ${seasonYear} is ready to unwrap`
    : `Strength Unwrapped ${seasonYear}`;

  return (
    <motion.section
      aria-label="Strength Unwrapped"
      className="bg-card relative mb-3 w-full overflow-hidden border-y"
      // Slides open rather than shoving the page down when the data lands.
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 26 }}
    >
      <BannerGlow />
      <motion.div
        className={cn(
          "relative flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-center sm:gap-8",
          APP_BANNER_STRIP_INSET,
        )}
        initial="stacked"
        animate="fanned"
        whileHover="spread"
      >
        <Link
          href={href}
          className="flex min-w-0 flex-1 items-center gap-4 sm:flex-none"
          aria-label={`${title}. Open your Strength Unwrapped recap.`}
        >
          <MiniDeck year={seasonYear} liftType={teaser?.mostTrainedLift} />
          <div className="min-w-0">
            <p className="text-foreground text-base leading-tight font-bold tracking-tight md:text-lg">
              {title}
            </p>
            {teaser ? (
              <TeaserChips teaser={teaser} />
            ) : (
              <p className="text-muted-foreground mt-0.5 text-sm">
                A year of lifting as a story you can share: sessions, PRs,
                strength gains and your lifter type.
              </p>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-1 self-end sm:self-center">
          <Button asChild size="sm" className="relative overflow-hidden">
            <Link href={href}>
              <ShimmerSweep />
              {teaser ? "Unwrap it" : "Take a look"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground h-8 w-8"
            aria-label="Hide Strength Unwrapped for a few days"
            onClick={() => setSnoozedAt(Date.now())}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </motion.section>
  );
}

// The recap deck's own backdrop: soft pools of the theme's chart colours.
function BannerGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute -top-full -left-[10%] h-[300%] w-1/2 opacity-30"
        style={{
          background:
            "radial-gradient(closest-side, var(--chart-1), transparent)",
        }}
      />
      <div
        className="absolute -top-full left-1/3 h-[300%] w-1/3 opacity-15"
        style={{
          background:
            "radial-gradient(closest-side, var(--chart-3), transparent)",
        }}
      />
      <div
        className="absolute -top-full -right-[10%] h-[300%] w-1/2 opacity-25"
        style={{
          background:
            "radial-gradient(closest-side, var(--chart-4), transparent)",
        }}
      />
    </div>
  );
}

// A band of light that crosses the button every few seconds.
function ShimmerSweep() {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
      initial={{ left: "-60%" }}
      animate={{ left: "130%" }}
      transition={{
        duration: 1.1,
        ease: "easeInOut",
        repeat: Infinity,
        repeatDelay: 3.5,
        delay: 1,
      }}
    />
  );
}

const BACK_CARDS = [
  { fanned: -14, spread: -22, x: -8, gradient: [2, 5] },
  { fanned: 9, spread: 16, x: 8, gradient: [3, 1] },
];

// Three little story cards that fan out on arrival and spread on hover, with
// the year and the lifter's most trained lift on the front one.
function MiniDeck({ year, liftType }) {
  const prefersReducedMotion = useReducedMotion();
  const artwork = getLiftArtwork(liftType) ?? getLiftArtwork("Back Squat");
  const spring = { type: "spring", stiffness: 200, damping: 14 };

  return (
    <div aria-hidden className="relative h-16 w-14 shrink-0">
      {BACK_CARDS.map((card) => (
        <motion.div
          key={card.fanned}
          className="absolute inset-x-[10px] inset-y-0 rounded-md shadow-md"
          style={{
            background: `linear-gradient(160deg, var(--chart-${card.gradient[0]}), var(--chart-${card.gradient[1]}))`,
          }}
          variants={{
            stacked: { rotate: 0, x: 0 },
            fanned: {
              rotate: card.fanned,
              x: card.x * 0.6,
              transition: spring,
            },
            spread: { rotate: card.spread, x: card.x, transition: spring },
          }}
        />
      ))}
      <motion.div
        className="bg-card absolute inset-x-[10px] inset-y-0 flex flex-col items-center justify-center overflow-hidden rounded-md border shadow-lg"
        variants={{
          stacked: { y: 0 },
          fanned: prefersReducedMotion
            ? { y: 0 }
            : {
                y: [0, -3, 0],
                transition: {
                  duration: 3.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              },
          spread: { y: -4, transition: spring },
        }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, var(--chart-4), transparent 70%)",
          }}
        />
        <img
          src={artwork}
          alt=""
          className="relative h-[18px] w-auto max-w-[90%] object-contain"
        />
        <span className="text-chart-4 relative mt-0.5 text-[9px] leading-none font-extrabold tabular-nums">
          {year}
        </span>
      </motion.div>
    </div>
  );
}

function TeaserChips({ teaser }) {
  const chips = [
    `${teaser.sessionCount.toLocaleString()} sessions`,
    teaser.prCount > 0
      ? `${teaser.prCount} lifetime PR${teaser.prCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip}
          className="bg-background/70 text-foreground rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums"
        >
          {chip}
        </span>
      ))}
      {teaser.lifterType && (
        <span className="bg-background/70 text-foreground ring-chart-1/50 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1">
          <Sparkles className="text-chart-1 h-3 w-3" />
          Lifter type:
          <span aria-hidden className="blur-[3px] select-none">
            {teaser.lifterType.title}
          </span>
          <span className="sr-only">revealed inside</span>
        </span>
      )}
    </div>
  );
}
