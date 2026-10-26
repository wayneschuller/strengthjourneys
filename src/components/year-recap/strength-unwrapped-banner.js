import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { motion, useReducedMotion } from "motion/react";
import { useIsClient, useLocalStorage, useReadLocalStorage } from "usehooks-ts";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
 * Seasonal promo for Strength Unwrapped. Shows from December 1 to January 15,
 * or anytime with ?showRecapBanner=1. A lifter with their own data gets a
 * teaser of their year (sessions, lifetime PRs, and their lifter type blurred
 * until they open it); everyone else gets the invitation.
 *
 * The lifter can hide it for the season. Once they have watched their recap it
 * leaves page headers and stays only on the home page, revealing their type.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes for the wrapper element.
 * @param {boolean} [props.hidden] - When true, forces the banner to be hidden regardless of date or query params.
 * @param {"home"|"header"} [props.placement] - Header placements step aside once the recap has been watched.
 */
export function StrengthUnwrappedBanner({
  className,
  hidden,
  placement = "home",
}) {
  const router = useRouter();
  const isClient = useIsClient();
  const { data: session } = useSession();
  const { parsedData, meetDays, dataSource } = useUserLiftingData();
  const [dismissedYear, setDismissedYear] = useLocalStorage(
    LOCAL_STORAGE_KEYS.RECAP_BANNER_DISMISSED_YEAR,
    null,
    { initializeWithValue: false },
  );
  const viewedYear = useReadLocalStorage(LOCAL_STORAGE_KEYS.RECAP_VIEWED_YEAR, {
    initializeWithValue: false,
  });

  const forceShow = router.query?.showRecapBanner === "1";
  const seasonYear =
    getRecapSeasonYear() ?? (forceShow ? new Date().getFullYear() : null);
  const hasViewed = viewedYear === seasonYear;
  // Client only: the season depends on today and the dismissal on storage, and
  // waiting for the data source means a lifter never sees the generic version
  // flash before their own.
  const shouldShow =
    isClient &&
    !hidden &&
    seasonYear != null &&
    dismissedYear !== seasonYear &&
    !(placement === "header" && hasViewed && !forceShow) &&
    dataSource !== "loading" &&
    dataSource !== "restoring";

  const teaser = useMemo(() => {
    if (!shouldShow || !isOwnData(dataSource) || !parsedData) return null;
    const sessions = computeSessionStatsForYear(parsedData, seasonYear);
    if (sessions.count < MIN_SESSIONS_FOR_TEASER) return null;
    return {
      sessionCount: sessions.count,
      prCount: getLifetimePRsAchievedInYear(parsedData, seasonYear).length,
      lifterType: computeLifterTypeForYear(parsedData, seasonYear, meetDays),
      mostTrainedLift: computeMostTrainedLiftForYear(parsedData, seasonYear)
        .mostTrainedLift,
    };
  }, [shouldShow, dataSource, parsedData, seasonYear, meetDays]);

  if (!shouldShow) return null;

  const firstName = teaser ? getRecapFirstName(session) : null;
  const href = `/strength-year-in-review?year=${seasonYear}`;

  let title;
  let description;
  let cta;
  if (teaser && hasViewed) {
    title = firstName
      ? `${firstName}'s ${seasonYear}, unwrapped`
      : `Your ${seasonYear}, unwrapped`;
    description = "Share the whole deck with your training crew.";
    cta = "Watch again";
  } else if (teaser) {
    title = firstName
      ? `${firstName}, your ${seasonYear} is ready to unwrap`
      : `Your ${seasonYear} is ready to unwrap`;
    description = "Your year in cards, made to share.";
    cta = "Unwrap it";
  } else {
    title = `Strength Unwrapped ${seasonYear}`;
    description =
      "A year of lifting as a story you can share: sessions, PRs, strength gains and your lifter type.";
    cta = "Take a look";
  }

  return (
    <motion.div
      className={cn("relative w-full", className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <Link href={href} className="group block">
        <motion.div
          className="border-border bg-card group-hover:border-primary/50 relative overflow-hidden rounded-xl border p-4 transition-colors md:p-5"
          initial="stacked"
          animate="fanned"
          whileHover="spread"
        >
          <BannerGlow />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:pr-6">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <MiniDeck year={seasonYear} liftType={teaser?.mostTrainedLift} />
              <div className="min-w-0">
                <p className="text-foreground text-lg leading-tight font-bold tracking-tight md:text-xl">
                  {title}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {description}
                </p>
                {teaser && (
                  <TeaserChips teaser={teaser} isRevealed={hasViewed} />
                )}
              </div>
            </div>
            <Button size="sm" className="shrink-0 self-start md:self-center">
              {cta}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground absolute top-1.5 right-1.5 h-7 w-7"
        aria-label="Hide Strength Unwrapped for this season"
        onClick={() => setDismissedYear(seasonYear)}
      >
        <X className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}

// The recap deck's own backdrop: two soft pools of the theme's chart colours.
function BannerGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute -top-1/2 -left-1/4 h-[200%] w-3/4 opacity-25"
        style={{
          background:
            "radial-gradient(closest-side, var(--chart-1), transparent)",
        }}
      />
      <div
        className="absolute -right-1/4 -bottom-1/2 h-[200%] w-3/4 opacity-20"
        style={{
          background:
            "radial-gradient(closest-side, var(--chart-4), transparent)",
        }}
      />
    </div>
  );
}

const BACK_CARDS = [
  { stacked: 0, fanned: -14, spread: -22, x: -10, gradient: [2, 5] },
  { stacked: 0, fanned: 9, spread: 16, x: 10, gradient: [3, 1] },
];

// Three little story cards that fan out on arrival and spread on hover, with
// the year and the lifter's most trained lift on the front one.
function MiniDeck({ year, liftType }) {
  const prefersReducedMotion = useReducedMotion();
  const artwork = getLiftArtwork(liftType) ?? getLiftArtwork("Back Squat");
  const spring = { type: "spring", stiffness: 200, damping: 14 };

  return (
    <div aria-hidden className="relative h-[88px] w-[72px] shrink-0">
      {BACK_CARDS.map((card) => (
        <motion.div
          key={card.fanned}
          className="absolute inset-x-[12px] inset-y-0 rounded-md shadow-md"
          style={{
            background: `linear-gradient(160deg, var(--chart-${card.gradient[0]}), var(--chart-${card.gradient[1]}))`,
          }}
          variants={{
            stacked: { rotate: card.stacked, x: 0 },
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
        className="bg-card absolute inset-x-[12px] inset-y-0 flex flex-col items-center justify-center overflow-hidden rounded-md border shadow-lg"
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
          className="relative h-6 w-auto max-w-[90%] object-contain"
        />
        <span className="text-chart-4 relative mt-1 text-[11px] leading-none font-extrabold tabular-nums">
          {year}
        </span>
      </motion.div>
    </div>
  );
}

function TeaserChips({ teaser, isRevealed }) {
  const chips = [
    `${teaser.sessionCount.toLocaleString()} sessions`,
    teaser.prCount > 0
      ? `${teaser.prCount} lifetime PR${teaser.prCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip}
          className="bg-background/70 text-foreground rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums"
        >
          {chip}
        </span>
      ))}
      {teaser.lifterType && (
        <span className="bg-chart-1/15 text-foreground ring-chart-1/40 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1">
          <Sparkles className="text-chart-1 h-3 w-3" />
          {isRevealed ? (
            teaser.lifterType.title
          ) : (
            <>
              <span aria-hidden className="blur-[4px] select-none">
                {teaser.lifterType.title}
              </span>
              <span className="sr-only">Your lifter type is inside</span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
