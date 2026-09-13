/**
 * The Lift Explorer directory: every lift, in three tiers, each linking to its
 * /progress-guide/ page.
 *
 *  1. The big four, as large artwork tiles. They are the lifts with standards,
 *     the full editorial guide, and their own icons, and they always lead.
 *  2. Every other lift we have drawn, as smaller tiles. A drawing is our
 *     commitment to a lift, so these show whether or not the lifter has logged
 *     them yet, which also makes them a menu of lifts worth trying.
 *  3. Everything else in the lifter's data, as a compact text list. A long
 *     history runs to hundreds of names, so artwork would not scale here.
 *
 * Tiers 1 and 2 come from the registry, so they render on the server and give
 * crawlers real links before any lifting data arrives. The sort lenses and the
 * search apply inside each tier; a tier never mixes into another.
 */

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { LiftIcon } from "@/components/lift-icon";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  formatDateToYmdLocal,
  getCompactAgeFromYmd,
  getLongReadableDateString,
} from "@/lib/date-utils";
import {
  BIG_FOUR_LIFTS,
  DRAWN_LIFTS,
  getCuratedLift,
  getLiftGuidePath,
} from "@/lib/lift-registry";
import { cn } from "@/lib/utils";

const SORT_MODES = [
  { value: "sets", label: "Top", title: "Most trained" },
  { value: "recent", label: "Recent", title: "Most recently trained" },
  { value: "stale", label: "Stale", title: "Longest since you trained it" },
  { value: "alpha", label: "A–Z", title: "Alphabetical" },
];

const OTHER_DRAWN_LIFTS = DRAWN_LIFTS.filter((lift) => !lift.bigFour);

// A lift needs some history before "you haven't touched this in a while" is
// interesting, otherwise one-off experiments crowd out the real dropped lifts.
const STALE_LENS_MIN_SETS = 5;

// The text list starts short enough to see the whole page, and expands.
const DEFAULT_VISIBLE_TEXT_LIFTS = 48;

export function LiftGrid() {
  const { liftTypes, isDemoMode } = useUserLiftingData();
  const { getColor } = useLiftColors();
  const [sortMode, setSortMode] = useState("sets");
  const [query, setQuery] = useState("");
  const [isTextListExpanded, setIsTextListExpanded] = useState(false);
  // Read the clock once on mount so relative ages stay pure across renders.
  const [todayYmd] = useState(() => formatDateToYmdLocal(new Date()));

  const hasLoaded = Boolean(liftTypes);

  // Stats keyed by canonical name, so a lift logged under a synonym ("Squat")
  // lights up its curated tile. liftTypes arrives sorted by set count, so the
  // first spelling seen is the most trained one.
  const { statsByLiftType, uncuratedStats } = useMemo(() => {
    const topSets = liftTypes?.[0]?.totalSets ?? 0;
    const byName = new Map();
    const uncurated = [];

    for (const entry of liftTypes ?? []) {
      const curated = getCuratedLift(entry.liftType);
      const stats = {
        liftType: entry.liftType,
        sets: entry.totalSets,
        lastDate: entry.newestDate,
        age: getCompactAgeFromYmd(entry.newestDate, todayYmd),
        // Floor the width so the rarest lifts still show a sliver of colour.
        barPercent:
          topSets > 0 ? Math.max((entry.totalSets / topSets) * 100, 2) : 0,
      };
      if (curated) {
        if (!byName.has(curated.liftType)) byName.set(curated.liftType, stats);
      } else {
        uncurated.push(stats);
      }
    }

    return { statsByLiftType: byName, uncuratedStats: uncurated };
  }, [liftTypes, todayYmd]);

  const normalizedQuery = query.trim().toLowerCase();

  const bigFour = useMemo(
    () =>
      sortTiles(
        filterByQuery(BIG_FOUR_LIFTS, normalizedQuery),
        statsByLiftType,
        sortMode,
      ),
    [normalizedQuery, sortMode, statsByLiftType],
  );

  const drawn = useMemo(
    () =>
      sortTiles(
        filterByQuery(OTHER_DRAWN_LIFTS, normalizedQuery),
        statsByLiftType,
        sortMode,
      ),
    [normalizedQuery, sortMode, statsByLiftType],
  );

  const textLifts = useMemo(() => {
    let pool = uncuratedStats.filter((item) =>
      item.liftType.toLowerCase().includes(normalizedQuery),
    );
    if (sortMode === "stale") {
      const established = pool.filter((item) => item.sets >= STALE_LENS_MIN_SETS);
      if (established.length > 0) pool = established;
    }
    return sortStats(pool, sortMode);
  }, [normalizedQuery, sortMode, uncuratedStats]);

  // Searching shows every match; there is nothing to expand into.
  const showAllText = isTextListExpanded || normalizedQuery.length > 0;
  const visibleTextLifts = showAllText
    ? textLifts
    : textLifts.slice(0, DEFAULT_VISIBLE_TEXT_LIFTS);
  const hiddenTextCount = textLifts.length - visibleTextLifts.length;

  const nothingMatches =
    normalizedQuery && !bigFour.length && !drawn.length && !textLifts.length;

  return (
    <section className="mt-4 flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {isDemoMode && <DemoModeBadge />}
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a lift"
            aria-label="Find a lift"
            className="pl-9"
          />
        </div>
        <Tabs value={sortMode} onValueChange={setSortMode} className="sm:ml-auto">
          <TabsList className="grid h-9 w-full grid-cols-4 sm:w-auto">
            {SORT_MODES.map((mode) => (
              <TabsTrigger
                key={mode.value}
                value={mode.value}
                title={mode.title}
                className="px-3 text-xs"
              >
                {mode.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {nothingMatches && (
        <p className="text-muted-foreground py-6 text-center">
          No lifts match &ldquo;{query.trim()}&rdquo;.
        </p>
      )}

      {bigFour.length > 0 && (
        <LiftTier title="The Big Four">
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {bigFour.map((lift, index) => (
              <LiftTile
                key={lift.liftType}
                lift={lift}
                stats={statsByLiftType.get(lift.liftType)}
                hasLoaded={hasLoaded}
                color={getColor(lift.liftType)}
                index={index}
                size="large"
              />
            ))}
          </ul>
        </LiftTier>
      )}

      {drawn.length > 0 && (
        <LiftTier title="More barbell lifts">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {drawn.map((lift, index) => (
              <LiftTile
                key={lift.liftType}
                lift={lift}
                stats={statsByLiftType.get(lift.liftType)}
                hasLoaded={hasLoaded}
                color={getColor(lift.liftType)}
                index={index + bigFour.length}
                size="small"
              />
            ))}
          </ul>
        </LiftTier>
      )}

      {textLifts.length > 0 && (
        <LiftTier title="Everything else you log">
          <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleTextLifts.map((item) => (
              <TextLiftRow
                key={item.liftType}
                item={item}
                color={getColor(item.liftType)}
              />
            ))}
          </ul>
          {(hiddenTextCount > 0 || (isTextListExpanded && !normalizedQuery)) && (
            <button
              type="button"
              onClick={() => setIsTextListExpanded((expanded) => !expanded)}
              className="text-muted-foreground hover:text-foreground mt-2 text-sm underline-offset-2 hover:underline"
            >
              {hiddenTextCount > 0
                ? `Show all ${textLifts.length} lifts`
                : "Show fewer lifts"}
            </button>
          )}
        </LiftTier>
      )}
    </section>
  );
}

/** A labelled tier of the directory. */
function LiftTier({ title, children }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-muted-foreground text-[11px] font-semibold tracking-[0.2em] uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * One artwork tile. Large tiles are the big four; small ones the other drawn
 * lifts. `layout` lets tiles glide into place when the sort lens changes.
 */
function LiftTile({ lift, stats, hasLoaded, color, index, size }) {
  const isLarge = size === "large";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 26,
        delay: Math.min(index * 0.04, 0.5),
      }}
    >
      <Link
        href={getLiftGuidePath(lift.liftType)}
        className="group bg-card focus-visible:ring-ring relative flex h-full flex-col overflow-hidden rounded-xl border shadow-sm transition-[transform,box-shadow] duration-300 outline-none hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2"
        style={{ "--lift": color }}
      >
        {/* A pool of the lift's colour under the figures, brightening on hover. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 100%, color-mix(in srgb, var(--lift) 28%, transparent), transparent 70%)",
          }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 origin-left scale-x-50 transition-transform duration-500 ease-out group-hover:scale-x-100"
          style={{ backgroundColor: "var(--lift)" }}
        />
        <div
          className={cn(
            "relative flex flex-1 items-end justify-center",
            isLarge ? "px-4 pt-6 pb-2" : "px-3 pt-4 pb-1",
          )}
        >
          <Image
            src={lift.artwork.src}
            alt={`${lift.liftType} diagram`}
            width={1000}
            height={600}
            // Lift artwork is always served straight from public/; see the
            // rendering note at the top of components/lift-artwork.js.
            unoptimized
            className={cn(
              "w-auto max-w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105",
              isLarge ? "h-24 sm:h-32 lg:h-36" : "h-16 sm:h-20",
            )}
          />
        </div>
        <div
          className={cn(
            "bg-card/70 relative flex flex-col border-t backdrop-blur-sm",
            isLarge ? "gap-1 px-4 py-3" : "gap-0.5 px-3 py-2",
          )}
        >
          <span
            className={cn(
              "flex items-center gap-2 leading-tight",
              isLarge ? "text-base font-semibold sm:text-lg" : "text-sm font-medium",
            )}
          >
            {isLarge && (
              <LiftIcon
                liftType={lift.liftType}
                className="text-muted-foreground size-4 shrink-0"
              />
            )}
            <span className="min-w-0 truncate">{lift.liftType}</span>
          </span>
          <TileStats stats={stats} hasLoaded={hasLoaded} isLarge={isLarge} />
        </div>
      </Link>
    </motion.li>
  );
}

/** Sets and last trained, or a gentle note for a lift not yet logged. */
function TileStats({ stats, hasLoaded, isLarge }) {
  const className = cn(
    "text-muted-foreground tabular-nums",
    isLarge ? "text-sm" : "text-xs",
  );

  // Hold the line's height while data arrives so tiles do not jump.
  if (!hasLoaded) return <span className={className}>&nbsp;</span>;
  if (!stats) return <span className={className}>Not in your log yet</span>;

  return (
    <span
      className={className}
      title={`Last trained ${getLongReadableDateString(stats.lastDate) ?? stats.lastDate}`}
    >
      {stats.sets.toLocaleString()} {stats.sets === 1 ? "set" : "sets"}
      {stats.age ? ` · ${stats.age === "today" ? "today" : `${stats.age} ago`}` : ""}
    </span>
  );
}

/** One uncurated lift: colour swatch, name, and a faint volume bar behind. */
function TextLiftRow({ item, color }) {
  return (
    <li>
      <Link
        href={getLiftGuidePath(item.liftType)}
        className="group hover:bg-muted/50 focus-visible:bg-muted/60 relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 rounded-md opacity-15 dark:opacity-25"
          style={{ width: `${item.barPercent}%`, background: color }}
        />
        <span
          aria-hidden="true"
          className="relative size-2.5 shrink-0 rounded-[2px]"
          style={{ background: color }}
        />
        <span className="relative min-w-0 flex-1 truncate group-hover:underline">
          {item.liftType}
        </span>
        {item.age && (
          <span
            className="text-muted-foreground relative shrink-0 text-[10px] tabular-nums"
            title={`Last trained ${getLongReadableDateString(item.lastDate) ?? item.lastDate}`}
          >
            {item.age}
          </span>
        )}
      </Link>
    </li>
  );
}

/** Curated lifts whose name or synonyms contain the query. */
function filterByQuery(lifts, normalizedQuery) {
  if (!normalizedQuery) return lifts;
  return lifts.filter((lift) =>
    [lift.liftType, ...(lift.synonyms ?? [])].some((name) =>
      name.toLowerCase().includes(normalizedQuery),
    ),
  );
}

/**
 * Orders tiles by the lens. Unlogged lifts keep registry order at the end of
 * every lens except A–Z, so a lifter's own lifts always come first.
 */
function sortTiles(lifts, statsByLiftType, sortMode) {
  if (sortMode === "alpha") {
    return [...lifts].sort((a, b) => a.liftType.localeCompare(b.liftType));
  }
  const logged = lifts.filter((lift) => statsByLiftType.has(lift.liftType));
  const unlogged = lifts.filter((lift) => !statsByLiftType.has(lift.liftType));
  const statsOf = (lift) => statsByLiftType.get(lift.liftType);
  const sortedLogged = sortStats(logged.map(statsOf), sortMode).map((stats) =>
    logged.find((lift) => statsOf(lift) === stats),
  );
  return [...sortedLogged, ...unlogged];
}

/** Orders stat rows by the lens. YYYY-MM-DD sorts lexically, so no Dates. */
function sortStats(items, sortMode) {
  const sorted = [...items];
  if (sortMode === "alpha") {
    sorted.sort((a, b) => a.liftType.localeCompare(b.liftType));
  } else if (sortMode === "recent") {
    sorted.sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));
  } else if (sortMode === "stale") {
    sorted.sort((a, b) => (a.lastDate ?? "").localeCompare(b.lastDate ?? ""));
  } else {
    sorted.sort((a, b) => b.sets - a.sets);
  }
  return sorted;
}
