/** @format */

"use client";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { useState, useEffect, useContext } from "react";
import { useSession, signIn, sgnOut } from "next-auth/react";
import { useLocalStorage } from "usehooks-ts";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DarkModeToggle, ThemeChooser } from "@/components/theme-chooser";
import { MobileNav } from "@/components/mobile-nav";
import { AvatarDropdown } from "@/components/avatar-menu";
import { Table2, Loader2, Github, Trophy, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog } from "@/lib/processing-utils";
import { MiniTimer } from "@/pages/timer";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useTheme } from "next-themes";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

import {
  Crown,
  Shield,
  Skull,
  Luggage,
  Calculator,
  BarChart,
  Anvil,
  Activity,
  Timer,
  Bot,
  Grid2x2Check,
  ChartColumnDecreasing,
  Bus,
  Flame,
  Sparkles,
} from "lucide-react";
import { bigFourLiftInsightData } from "@/lib/big-four-insight-data";

import { getLogoForTheme } from "@/lib/theme-logos";

import { SidePanelSelectLiftsButton } from "@/components/side-panel-lift-chooser";
import { AthleteBioQuickSettings } from "@/components/athlete-bio-quick-settings";

export function NavBar() {
  const pathname = usePathname();
  const { status: authStatus } = useSession();

  useEffect(() => {
    // Only run on client
    if (typeof window === "undefined") return;

    function initCannyChangelog() {
      window.Canny("initChangelog", {
        appID: "65ae4d4c921071bb0aae99c3",
        position: "bottom",
        align: "left",
        theme: "dark",
      });
    }

    if (!window.Canny) {
      // If SDK is not present, inject it, then init after load
      const script = document.createElement("script");
      script.src = "https://canny.io/sdk.js";
      script.async = true;
      script.onload = initCannyChangelog;
      document.body.appendChild(script);
    } else {
      // If SDK already there, just init as before
      initCannyChangelog();
    }
  }, []);

  return (
    <div className="mx-2 my-3 flex items-center rounded-lg bg-background/80 px-3 md:mx-10 md:px-6 xl:mx-24">
      <div className="flex items-center">
        <DesktopNav />
        <MobileNav />
      </div>
      <div className="ml-2 flex flex-1 flex-row items-center justify-end gap-2">
        {/* Only show the select lifts button on visualizer (barbell-strength-potential uses big four + dropdown; analyzer uses popular lifts by reps) */}
        {pathname === "/visualizer" && (
          <SidePanelSelectLiftsButton isIconMode={true} />
        )}
        <MiniTimer />
        {/* We used to show an icon to open the user google sheet */}
        {/* <UserSheetIcon /> */}

        {/* We used to show a github icon with xl:block*/}
        <div className="hidden">
          <GitHubButton />
        </div>

        {authStatus === "authenticated" && <AthleteBioQuickSettings />}
        <ThemeChooser />
        {/* <DarkModeToggle /> */}
        <AvatarDropdown />
      </div>
    </div>
  );
}

// FIXME: use the featurePages array in index.js?

export function DesktopNav() {
  const pathname = usePathname();
  const { isValidating } = useUserLiftingData();
  const { resolvedTheme, theme } = useTheme();
  const [logoSrc, setLogoSrc] = useState(() => {
    // Start with default theme for SSR/hydration consistency
    return getLogoForTheme("light");
  });

  // Set logo on mount and when theme changes
  useEffect(() => {
    let currentTheme = theme ?? resolvedTheme;
    
    // If theme not yet resolved, try to get from localStorage
    if (!currentTheme && typeof window !== "undefined") {
      const storedTheme = localStorage.getItem(LOCAL_STORAGE_KEYS.THEME);
      if (storedTheme) {
        currentTheme = storedTheme;
      }
    }
    
    setLogoSrc(getLogoForTheme(currentTheme || "light"));
  }, [theme, resolvedTheme]);

  return (
    <div className="hidden align-middle md:flex">
      <Link
        href="/"
        className={cn(
          "mr-10 flex items-center",
          isValidating && "animate-pulse",
        )}
      >
        <Image
          src={logoSrc}
          key={logoSrc}
          width={100}
          height="auto"
          alt="app logo"
          className="inline-block rounded-lg"
          priority={true}
        />
      </Link>

      <nav className="flex flex-1 items-center space-x-2 text-sm font-medium md:space-x-6">
        <BigFourBarbellInsightsMenu />

        <StrengthInsightsMenu />

        <CalculatorsMenu />

        <Link
          href="/gym-playlist-leaderboard"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/gym-playlist-leaderboard"
              ? "text-foreground"
              : "text-foreground/60",
            "hidden md:block",
          )}
        >
          Music
        </Link>
        <Link
          href="/articles"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname.startsWith("/articles")
              ? "text-foreground"
              : "text-foreground/60",
            "hidden lg:block", // Only show articles on LG
          )}
        >
          Articles
        </Link>
        <button
          data-canny-changelog
          className={cn(
            "text-muted-foreground hover:text-foreground/80",
            "hidden 2xl:block", // Only show articles on 2XL
          )}
        >
          What&apos;s New
        </button>
      </nav>
    </div>
  );
}

// When user is logged in with data, give a link to their google sheet
// Also we have a subtle pulse animation when we are trying to look for new data from google (via useSWR isValidating)
export function UserSheetIcon() {
  // We need the next 3 for the file picker button
  const [ssid, setSsid] = useLocalStorage(LOCAL_STORAGE_KEYS.SSID, null, {
    initializeWithValue: false,
  });
  const [sheetURL, setSheetURL] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHEET_URL,
    null,

    { initializeWithValue: false },
  );
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHEET_FILENAME,
    null,
    { initializeWithValue: false },
  );

  const { data: session, status: authStatus } = useSession();
  const { parsedData, isLoading, isValidating, isError } = useUserLiftingData();

  // devLog( `<UserSheetIcon /> isLoading: ${isLoading}, isValidating ${isValidating}, isError: ${isError}, authStatus: ${authStatus}`,);

  // Some guard rails
  if (authStatus !== "authenticated") return null;
  if (isLoading) return null;

  return (
    ssid &&
    sheetURL &&
    sheetFilename && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                devLog(sheetURL);
                window.open(decodeURIComponent(sheetURL));
              }}
            >
              {!isValidating && <Table2 className="h-[1.2rem] w-[1.2rem]" />}
              {isValidating && (
                <Table2 className="h-[1.2rem] w-[1.2rem] animate-pulse" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Click to open {sheetFilename} </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  );
}

export function GitHubButton() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              window.open(
                decodeURIComponent(
                  "https://github.com/wayneschuller/strengthjourneys",
                ),
              );
            }}
            aria-label="Open GitHub repository"
          >
            <Github className="h-[1.2rem] w-[1.2rem]" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View source code on Github</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BigFourBarbellInsightsMenu() {
  const pathname = usePathname();
  const lifts = bigFourLiftInsightData;

  const bigFourIcons = {
    "Back Squat": <Crown className="h-5 w-5" />,
    "Bench Press": <Shield className="h-5 w-5" />,
    Deadlift: <Skull className="h-5 w-5" />,
    "Strict Press": <Luggage className="h-5 w-5" />,
  };

  const ListItem = React.forwardRef(
    ({ className, title, children, ...props }, ref) => {
      return (
        <li>
          <NavigationMenuLink asChild>
            <Link
              ref={ref}
              className={cn(
                "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                className,
              )}
              {...props}
            >
              <div className="flex flex-row items-center gap-2 align-middle">
                {bigFourIcons[title]} {/* Icon based on lift title */}
                <div className="text-sm font-medium leading-none">{title}</div>
              </div>
              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                {children}
              </p>
            </Link>
          </NavigationMenuLink>
        </li>
      );
    },
  );
  ListItem.displayName = "ListItem";

  return (
    <>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger
              className={cn(
                "bg-transparent transition-colors hover:text-foreground/80",
                pathname.startsWith("/barbell")
                  ? "text-foreground"
                  : "text-foreground/60",
              )}
            >
              <>
                {/* Short title on small screens */}
                <span className="hidden md:block xl:hidden">Big Four</span>
                {/* Full title on larger screens */}
                <span className="hidden xl:block">Big Four Barbell Lifts</span>
              </>
            </NavigationMenuTrigger>
            <NavigationMenuContent className="">
              <ul className="grid w-[400px] gap-3 p-4 md:w-[400px] md:grid-cols-2 lg:w-[500px]">
                {lifts.map((lift) => (
                  <ListItem
                    key={lift.liftType}
                    title={lift.liftType}
                    href={"/" + lift.slug}
                  >
                    {/* {lift.pageTitle} */}
                  </ListItem>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </>
  );
}

function StrengthInsightsMenu() {
  const pathname = usePathname();

  const insights = [
    {
      title: "PR Analyzer",
      href: "/analyzer",
      icon: <Trophy className="h-5 w-5" />,
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
    },
    {
      title: "Barbell Strength Potential",
      href: "/barbell-strength-potential",
      icon: <ChartColumnDecreasing className="h-5 w-5" />,
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
  ];

  const ListItem = React.forwardRef(
    ({ className, title, children, ...props }, ref) => {
      return (
        <li>
          <NavigationMenuLink asChild>
            <Link
              ref={ref}
              className={cn(
                "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                className,
              )}
              {...props}
            >
              <div className="flex flex-row items-center gap-2 align-middle">
                {props.icon} {/* Icon based on title */}
                <div className="text-sm font-medium leading-none">{title}</div>
              </div>
              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                {children}
              </p>
            </Link>
          </NavigationMenuLink>
        </li>
      );
    },
  );
  ListItem.displayName = "ListItem";

  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              "bg-transparent transition-colors hover:text-foreground/80",
              pathname.startsWith("/analyzer") ||
                pathname.startsWith("/visualizer") ||
                pathname.startsWith("/ai-lifting-assistant")
                ? "text-foreground"
                : "text-foreground/60",
            )}
          >
            <>
              {/* Short title on small screens */}
              <span className="hidden md:block xl:hidden">Insights</span>
              {/* Full title on larger screens */}
              <span className="hidden xl:block">Strength Insights</span>
            </>
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 md:w-[400px] md:grid-cols-2 lg:w-[500px]">
              {insights.map((insight) => (
                <ListItem
                  key={insight.title}
                  title={insight.title}
                  href={insight.href}
                  icon={insight.icon}
                >
                  {/* {insight.pageTitle} */}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function CalculatorsMenu() {
  const pathname = usePathname();

  const calculators = [
    {
      title: "One Rep Max Calculator",
      href: "/calculator",
      icon: <Calculator className="h-5 w-5" />,
    },
    {
      title: "Warm Ups Calculator",
      href: "/warm-up-sets-calculator",
      icon: <Flame className="h-5 w-5" />,
    },
    {
      title: "Strength Level Calculator",
      href: "/strength-level-calculator",
      icon: <BarChart className="h-5 w-5" />,
    },
    {
      title: "1000lb Club Calculator",
      href: "/1000lb-club-calculator",
      icon: <Anvil className="h-5 w-5" />,
    },
    {
      title: "Lifting Set Timer",
      href: "/timer",
      icon: <Timer className="h-5 w-5" />,
    },
  ];

  const ListItem = React.forwardRef(
    ({ className, title, children, ...props }, ref) => {
      return (
        <li>
          <NavigationMenuLink asChild>
            <Link
              ref={ref}
              className={cn(
                "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                className,
              )}
              {...props}
            >
              <div className="flex flex-row items-center gap-2 align-middle">
                {props.icon} {/* Icon based on calculator title */}
                <div className="text-sm font-medium leading-none">{title}</div>
              </div>
              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                {children}
              </p>
            </Link>
          </NavigationMenuLink>
        </li>
      );
    },
  );
  ListItem.displayName = "ListItem";

  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger
            className={cn(
              "bg-transparent transition-colors hover:text-foreground/80",
              pathname.startsWith("/calculator") ||
                pathname.startsWith("/warm-up-sets-calculator") ||
                pathname.startsWith("/strength-level-calculator") ||
                pathname.startsWith("/timer")
                ? "text-foreground"
                : "text-foreground/60",
            )}
          >
            <>
              {/* Short title on small screens */}
              <span className="hidden md:block xl:hidden">Calculators</span>
              {/* Full title on larger screens */}
              <span className="hidden xl:block">Calculators</span>
            </>
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 md:w-[400px] md:grid-cols-2 lg:w-[500px]">
              {calculators.map((calculator) => (
                <ListItem
                  key={calculator.title}
                  title={calculator.title}
                  href={calculator.href}
                  icon={calculator.icon}
                >
                  {/* {calculator.pageTitle} */}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
