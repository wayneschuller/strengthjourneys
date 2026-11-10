/**
 * Global application navigation and its desktop menus and utility actions.
 */

import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeChooser } from "@/components/ui-shell/theme-chooser";
import { MobileNav } from "@/components/ui-shell/mobile-nav";
import { AvatarDropdown } from "@/components/ui-shell/avatar-menu";
import {
  Layers,
  LineChart,
  NotebookText,
  Plus,
  Disc,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MiniTimer } from "@/components/timer/mini-timer";
import { useUserLiftingData, isOwnData } from "@/hooks/use-userlift-data";
import { useTheme } from "next-themes";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/sheet/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/sheet/open-sheet-setup";
import {
  getLastImportSourcePhrase,
  getRepeatImportHref,
} from "@/lib/import/import-sources";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible } from "@/components/ui/collapsible";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

import {
  Calculator,
  BarChart,
  Anvil,
  Timer,
  Bot,
  Bus,
  Flame,
  Sparkles,
  CircleDashed,
  Mountain,
} from "lucide-react";
import { LiftIcon } from "@/components/lift-icon";
import {
  BIG_FOUR_LIFTS,
  CURATED_LIFTS,
  getCuratedLift,
  getLiftGuidePath,
  isLiftGuideIndexable,
} from "@/lib/lifts/lift-registry";
import { GorillaIcon } from "@/components/gorilla-icon";

import { getLogoForTheme, getLogoHeight } from "@/lib/theme-logos";
import {
  EvergreenGapTwig,
  EvergreenNavLeaves,
} from "@/components/ui-shell/evergreen-nav-leaves";
import { EvergreenCardLeaves } from "@/components/ui-shell/evergreen-card-leaves";

import { AthleteBioQuickSettings } from "@/components/athlete-bio-quick-settings";
import { FreshPill } from "@/components/ui/fresh-pill";
import {
  useChangelogDot,
  WhatsNewIcon,
  WhatsNewHoverCard,
} from "@/components/ui-shell/whats-new";

/**
 * Top-level navigation bar. Composes the desktop logo/nav links, mobile nav,
 * mini timer, theme chooser, athlete bio quick-settings, and avatar dropdown.
 *
 * @param {Object} props - No props; reads auth status and pathname from context/hooks.
 */
export function NavBar() {
  const { status: authStatus } = useSession();
  const { importProfile, dataSource } = useUserLiftingData();
  const canOpenLog = dataSource === "sheet" || dataSource === "import";
  const hasImportRitual = Boolean(importProfile?.lastSourceId);
  const importHref = getRepeatImportHref(importProfile, "repeat-import-nav");

  return (
    <Collapsible className="app-nav bg-background/50 relative mx-2 my-3 rounded-lg md:mx-10 xl:mx-12 2xl:mx-24">
      <EvergreenNavLeaves />
      <EvergreenCardLeaves />
      <div className="flex items-center px-3 md:px-6">
        <div className="flex items-center">
          <DesktopNav />
          <MobileNav />
        </div>
        <div className="ml-2 flex flex-1 flex-row items-center justify-end gap-2 self-stretch py-3">
          <span
            aria-hidden
            className="app-nav-sprig relative -mt-6 -mb-3 hidden flex-1 self-stretch xl:block"
          >
            <EvergreenGapTwig />
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  size="sm"
                  className="log-pill mr-0 inline-flex h-9 shrink-0 rounded-full bg-zinc-700 px-3 text-zinc-50 shadow-sm transition-colors hover:bg-zinc-600 focus-visible:ring-zinc-700 md:mr-2 dark:bg-zinc-300 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  <Link href="/log" prefetch={false}>
                    {canOpenLog && dataSource !== "import" ? (
                      <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    ) : (
                      <NotebookText className="h-3.5 w-3.5" strokeWidth={2.5} />
                    )}
                    <span className="xl:hidden">
                      {canOpenLog && dataSource !== "import"
                        ? "Log"
                        : "Sessions"}
                    </span>
                    <span className="hidden xl:inline">
                      {canOpenLog && dataSource !== "import"
                        ? "Log Session"
                        : "Session Browser"}
                    </span>
                  </Link>
                </Button>
              </TooltipTrigger>
              {!canOpenLog && (
                <TooltipContent>
                  Browse sessions and log your workouts. Sign in to start
                  logging.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mr-2 hidden h-9 shrink-0 rounded-full px-3 xl:inline-flex"
                >
                  <Link
                    href={hasImportRitual ? importHref : "/import"}
                    prefetch={false}
                  >
                    <Upload className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Import / Export
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {hasImportRitual
                  ? `Your last import came from ${getLastImportSourcePhrase(importProfile)}. Update from there, switch to any supported format, or export your SJ data.`
                  : "Import from any supported app or spreadsheet, or export your Strength Journeys data."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {hasImportRitual && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mr-0 h-9 shrink-0 rounded-full px-2.5 md:mr-2 md:px-3 xl:hidden"
                  >
                    <Link href={importHref}>
                      <Upload className="h-3.5 w-3.5" strokeWidth={2.5} />
                      <span className="hidden sm:inline md:hidden">
                        Update Data
                      </span>
                      <span className="hidden md:inline">Update</span>
                      <span className="sr-only sm:hidden">Update data</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Your last import came from{" "}
                  {getLastImportSourcePhrase(importProfile)}. Upload a newer
                  file from there or any other supported export.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {authStatus === "authenticated" && !canOpenLog && (
            <Button
              size="sm"
              className="log-pill mr-2 h-9 shrink-0 rounded-full bg-zinc-700 px-3 text-zinc-50 shadow-sm transition-colors hover:bg-zinc-600 focus-visible:ring-zinc-700 dark:bg-zinc-300 dark:text-zinc-950 dark:hover:bg-zinc-200"
              onClick={() => {
                openSheetSetupDialog("bootstrap");
              }}
            >
              <img
                src={GOOGLE_SHEETS_ICON_URL}
                alt=""
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden
              />
              <span className="xl:hidden">Set Up</span>
              <span className="hidden xl:inline">Set Up Sheet</span>
            </Button>
          )}
          <MiniTimer />

          {/* Logged-in users always get the bio settings button. For guests we only show it on
              pages where bio data (age, sex, bodyweight) actively changes the output — we don't
              want the pulsing badge distracting first-time visitors on the landing page. */}
          <AthleteBioQuickSettings />
          <div className="hidden md:block">
            <ThemeChooser />
          </div>
          <AvatarDropdown />
        </div>
      </div>
    </Collapsible>
  );
}

// FIXME: use the featurePages array in lib/feature-pages.js?

const LOGO_WIDTH = 118;

/**
 * Desktop navigation area showing the logo and the main nav menus.
 * Shown from lg up, where the row has room for the logo at full size;
 * below that the mobile sheet takes over. The logo pulses while user data
 * is validating.
 *
 * @param {Object} props - No props; reads theme and validating state from context/hooks.
 */
export function DesktopNav() {
  const pathname = usePathname();
  const { isValidating } = useUserLiftingData();
  const { resolvedTheme, theme } = useTheme();
  const [logoSrc, setLogoSrc] = useState(() => getLogoForTheme("light"));
  const [isStarryNight, setIsStarryNight] = useState(false);

  // Update logo after mount and on theme changes to avoid hydration mismatch
  useEffect(() => {
    const activeTheme = theme ?? resolvedTheme ?? "light";

    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived client-only logo swap avoids hydration mismatch
    setLogoSrc(getLogoForTheme(activeTheme));
    setIsStarryNight(activeTheme.startsWith("starry-night"));
  }, [theme, resolvedTheme]);

  return (
    <div className="hidden align-middle lg:flex">
      <Link
        prefetch={false}
        href="/"
        className={cn(
          "mr-4 flex shrink-0 items-center xl:mr-6 2xl:mr-10",
          isValidating && "animate-pulse",
        )}
      >
        <Image
          src={logoSrc}
          key={logoSrc}
          width={LOGO_WIDTH}
          height={getLogoHeight(logoSrc, LOGO_WIDTH)}
          alt="Strength Journeys logo"
          className={cn(
            "inline-block h-auto w-[118px] shrink-0 rounded-lg",
            isStarryNight && "ring-border shadow-sm ring-1",
          )}
          priority={true}
        />
      </Link>

      <nav className="flex min-w-0 flex-1 items-center space-x-2 text-sm font-medium lg:space-x-4 2xl:space-x-6">
        <LiftsMenu />

        <StrengthInsightsMenu />

        <CalculatorsMenu />

        <Link
          prefetch={false}
          href="/gym-playlist-leaderboard"
          className={cn(
            "hover:text-foreground/80 transition-colors",
            pathname === "/gym-playlist-leaderboard"
              ? "text-foreground"
              : "text-foreground/60",
            "hidden min-[1700px]:block",
          )}
        >
          Music
        </Link>
        <Link
          prefetch={false}
          href="/articles"
          className={cn(
            "hover:text-foreground/80 transition-colors",
            pathname.startsWith("/articles")
              ? "text-foreground"
              : "text-foreground/60",
            "hidden min-[1700px]:block", // Room for articles once the row is wide
          )}
        >
          Articles
        </Link>
        <WhatsNewLink />
      </nav>
    </div>
  );
}

// Last link in, first to wait for room. Its megaphone shows when a changelog
// entry has shipped since this browser last opened /changelog, and hovering it
// previews the newest entry.
function WhatsNewLink() {
  const pathname = usePathname();
  const changelogDot = useChangelogDot();

  return (
    <WhatsNewHoverCard>
      <Link
        prefetch={false}
        href="/changelog"
        className={cn(
          "hover:text-foreground/80 items-center transition-colors",
          pathname === "/changelog" ? "text-foreground" : "text-foreground/60",
          "hidden min-[1800px]:inline-flex",
        )}
      >
        <span className="relative">
          What&apos;s New
          {changelogDot && <WhatsNewIcon />}
        </span>
      </Link>
    </WhatsNewHoverCard>
  );
}

// Whether the current route is one of a menu's pages or sits beneath one.
function isOnAnyPage(pathname, hrefs) {
  return hrefs.some(
    (href) => pathname === href || pathname.startsWith(href + "/"),
  );
}

// One menu entry: icon, title, optional fresh pill and a short description.
function MenuListItem({ href, title, icon, pill, children, className }) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          prefetch={false}
          href={href}
          className={cn(
            "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block space-y-1 rounded-md p-3 leading-none no-underline transition-colors outline-none select-none",
            className,
          )}
        >
          <div className="flex flex-row items-center gap-2 align-middle">
            {icon}
            <div className="text-sm leading-none font-medium">{title}</div>
            {pill && <FreshPill {...pill} />}
          </div>
          {children && (
            <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
              {children}
            </p>
          )}
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

// A hover-open dropdown with a two-column grid of links. Radix waits 200ms
// before opening by default; these open straight away. z-30 keeps the open
// menu above sticky page bars like the progress guide's section nav (z-20).
function NavDropdown({ isActive, shortLabel, fullLabel, fullFrom, children }) {
  return (
    <NavigationMenu delayDuration={0} className="z-30">
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              "hover:text-foreground/80 bg-transparent transition-colors",
              isActive ? "text-foreground" : "text-foreground/60",
            )}
          >
            <span
              className={cn(
                "hidden md:block",
                fullFrom === "2xl" && "2xl:hidden",
              )}
            >
              {shortLabel}
            </span>
            {fullFrom === "2xl" && (
              <span className="hidden 2xl:block">{fullLabel}</span>
            )}
          </NavigationMenuTrigger>
          <NavigationMenuContent>{children}</NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

// How many lifts the Lifts menu lists after the big four.
const MORE_LIFTS_COUNT = 10;

// The other lifts with a written guide, in registry order. Guests see these
// after the big four, and they top up an athlete's own list when it is short.
const OTHER_GUIDED_LIFTS = CURATED_LIFTS.filter(
  (lift) => !lift.bigFour && isLiftGuideIndexable(lift),
).map((lift) => ({
  name: lift.commonName,
  href: getLiftGuidePath(lift.liftType),
}));

// An athlete's most trained lifts beyond the big four, then curated guides to
// make up the count. liftTypes arrives sorted by set count, and a synonym
// ("Squat") counts as its curated lift so it is only listed once.
function getMoreLifts(liftTypes) {
  const lifts = [];
  const seen = new Set();
  const add = (lift) => {
    if (!lift.href || seen.has(lift.href)) return;
    seen.add(lift.href);
    lifts.push(lift);
  };

  for (const { liftType } of liftTypes ?? []) {
    if (lifts.length >= MORE_LIFTS_COUNT) break;
    const curated = getCuratedLift(liftType);
    // TEMPORARY: registry lifts only. Every lift has a guide page, but
    // bodyweight and cardio work (push ups, sit ups, running, rowing) has no
    // registry entry and no good way to show it yet, so a heavy runner's menu
    // would fill with it. This also drops uncurated barbell and machine
    // lifts. Lift the filter once the registry covers bodyweight and cardio.
    if (!curated || curated.bigFour) continue;
    add({ name: curated.commonName, href: getLiftGuidePath(curated.liftType) });
  }
  for (const lift of OTHER_GUIDED_LIFTS) {
    if (lifts.length >= MORE_LIFTS_COUNT) break;
    add(lift);
  }
  return lifts;
}

// Lifts menu: the big four lead as the main tiles, then a line of ten more
// (an athlete's own most trained lifts, or curated guides for guests), and Lift Explorer closes it as the way to every
// lift in the log.
function LiftsMenu() {
  const pathname = usePathname();
  const { liftTypes, dataSource } = useUserLiftingData();
  const moreLifts = useMemo(
    () => getMoreLifts(isOwnData(dataSource) ? liftTypes : null),
    [liftTypes, dataSource],
  );

  return (
    <NavDropdown
      isActive={isOnAnyPage(pathname, ["/progress-guide", "/lift-explorer"])}
      shortLabel="Lifts"
      fullLabel="Barbell Lifts"
      fullFrom="2xl"
    >
      <div className="w-[400px] p-4 lg:w-[500px]">
        <ul className="grid grid-cols-2 gap-3">
          {BIG_FOUR_LIFTS.map((lift) => (
            <MenuListItem
              key={lift.slug}
              title={lift.liftType}
              href={getLiftGuidePath(lift.liftType)}
              icon={<LiftIcon liftType={lift.liftType} className="h-5 w-5" />}
            >
              {lift.tagline}
            </MenuListItem>
          ))}
        </ul>
        {moreLifts.length > 0 && (
          <ul className="border-border mt-3 flex flex-wrap gap-x-1 gap-y-1 border-t px-1 pt-3">
            {moreLifts.map((lift) => (
              <li key={lift.href}>
                <NavigationMenuLink asChild>
                  <Link
                    prefetch={false}
                    href={lift.href}
                    className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block rounded-md px-2 py-1 text-sm transition-colors outline-none"
                  >
                    {lift.name}
                  </Link>
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
        )}
        <ul className="border-border mt-3 border-t pt-3">
          <MenuListItem
            title="Lift Explorer"
            href="/lift-explorer"
            icon={<Layers className="h-5 w-5" />}
            pill={{ kind: "updated", date: "2026-09-14" }}
          >
            Every lift in your log, each with its own progress guide.
          </MenuListItem>
        </ul>
      </div>
    </NavDropdown>
  );
}

// Strength insight tools (Visualizer, AI assistant, tonnage and so on).
function StrengthInsightsMenu() {
  const pathname = usePathname();
  const { status: authStatus } = useSession();

  const insights = [
    {
      title: "Strength Levels",
      href: "/strength-levels",
      icon: <BarChart className="h-5 w-5" />,
    },
    {
      title: "Strength Visualizer",
      href: "/visualizer",
      icon: <LineChart className="h-5 w-5" />,
    },
    {
      title: "AI Lifting Assistant",
      href: "/ai-lifting-assistant",
      icon: <Bot className="h-5 w-5" />,
      pill: { kind: "updated", date: "2026-09-26" },
    },
    {
      title: "Tonnage Metrics",
      href: "/tonnage",
      icon: <Bus className="h-5 w-5" />,
    },
    {
      title: "Strength Unwrapped",
      href: "/strength-year-in-review",
      icon: <Sparkles className="h-5 w-5" />,
    },
    {
      title:
        authStatus === "authenticated" ? "Import / Merge Data" : "Import Data",
      href: "/import",
      icon: <Upload className="h-5 w-5" />,
    },
  ];

  return (
    <NavDropdown
      isActive={isOnAnyPage(
        pathname,
        insights.map((item) => item.href),
      )}
      shortLabel="Insights"
      fullLabel="Strength Insights"
      fullFrom="2xl"
    >
      <ul className="grid w-[400px] grid-cols-2 gap-3 p-4 lg:w-[500px]">
        {insights.map((item) => (
          <MenuListItem key={item.href} {...item} />
        ))}
      </ul>
    </NavDropdown>
  );
}

const CALCULATORS = [
  {
    title: "One Rep Max Calculator",
    href: "/calculator",
    icon: <Calculator className="h-5 w-5" />,
  },
  {
    title: "How Strong Am I?",
    href: "/how-strong-am-i",
    icon: <CircleDashed className="h-5 w-5" />,
    pill: { kind: "updated", date: "2026-09-17" },
  },
  {
    title: "Warm Ups Calculator",
    href: "/warm-up-sets-calculator",
    icon: <Flame className="h-5 w-5" />,
  },
  {
    title: "1000lb Club Calculator",
    href: "/1000lb-club-calculator",
    icon: <Anvil className="h-5 w-5" />,
  },
  {
    title: "200/300/400/500 Club",
    href: "/200-300-400-500-strength-club-calculator",
    icon: <Mountain className="h-5 w-5" />,
  },
  {
    title: "Plate Milestones",
    href: "/plate-milestones",
    icon: <Disc className="h-5 w-5" />,
  },
  {
    title: "Lifting Set Timer",
    href: "/timer",
    icon: <Timer className="h-5 w-5" />,
  },
  {
    title: "How Strong Is a Gorilla?",
    href: "/how-strong-is-a-gorilla",
    icon: <GorillaIcon className="h-5 w-5" />,
  },
];

// Calculator tools (1RM, warm-ups, clubs, timer and so on).
function CalculatorsMenu() {
  const pathname = usePathname();

  return (
    <NavDropdown
      isActive={isOnAnyPage(
        pathname,
        CALCULATORS.map((item) => item.href),
      )}
      shortLabel="Calculators"
    >
      <ul className="grid w-[400px] grid-cols-2 gap-3 p-4 lg:w-[500px]">
        {CALCULATORS.map((item) => (
          <MenuListItem key={item.href} {...item} />
        ))}
      </ul>
    </NavDropdown>
  );
}
