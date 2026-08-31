
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useMemo, useState, useEffect } from "react";
import { NextSeo } from "next-seo";
import { useTheme } from "next-themes";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { getYearsWithData } from "@/components/year-recap/year-selector";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Sparkles, Palette, Share2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { YearRecapCarousel } from "@/components/year-recap/year-recap-carousel";
import { YearSelector } from "@/components/year-recap/year-selector";
import { DemoModeSignInCard, ConnectSheetRecapCard } from "@/components/onboarding/instructions-cards";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRewardProgress } from "@/hooks/use-reward-progress";
import {
  getThemeUnlockSentence,
  getUnlockedThemes,
  isThemeLocked,
} from "@/lib/rewards/theme-unlocks";

export async function getStaticProps() {
  return { props: {}, revalidate: 60 * 60 };
}

/**
 * Strength Year in Review page. Renders SEO metadata and delegates rendering to StrengthYearInReviewMain.
 * Has no dynamic props — all data is loaded client-side from the user's lifting context.
 */
export default function StrengthYearInReview() {
  const title = "Strength Year in Review | Your Lifting Recap | Strength Journeys";
  const description =
    "See your year of strength training in a Spotify Wrapped-style recap. Sessions, tonnage, PRs, and more. Free.";
  const canonicalURL = "https://www.strengthjourneys.xyz/strength-year-in-review";
  const ogImageURL = "https://www.strengthjourneys.xyz/202409-og-image.png";
  const keywords =
    "strength year in review, lifting recap, workout year in review, strength training recap";

  return (
    <>
      <NextSeo
        title={title}
        description={description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title,
          description,
          type: "website",
          images: [{ url: ogImageURL, alt: "Strength Year in Review" }],
          site_name: "Strength Journeys",
        }}
        twitter={{
          handle: "@wayneschuller",
          site: "@wayneschuller",
          cardType: "summary_large_image",
        }}
        additionalMetaTags={[{ name: "keywords", content: keywords }]}
      />
      <StrengthYearInReviewMain />
    </>
  );
}

// Skeleton placeholder for the year selector panel shown while lifting data is loading.
function YearSelectorSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-24" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex h-11 w-full items-center gap-2 rounded-lg border border-input px-4 py-2">
            <Skeleton className="h-4 w-4 shrink-0" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton placeholder for the year recap carousel shown while lifting data is loading.
function CarouselSkeleton() {
  return (
    <div className="relative mx-auto w-full max-w-[360px] rounded-xl border bg-card overflow-hidden">
      <Skeleton className="aspect-9/16 w-full rounded-xl" />
      <div className="flex items-center justify-between border-t px-4 py-3">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
    </div>
  );
}

function formatThemeLabel(theme) {
  return theme
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Sidebar panel (visible at xl breakpoint) that lets lifters restyle their recap
 * before sharing it.
 *
 * Themes are earned from real training history, so this panel has to gate them
 * exactly the way the nav-bar ThemeChooser does. It sets the app theme globally
 * (that is how the recap cards pick up the palette), and ThemeChooser demotes an
 * unearned theme back to light on the next load — so offering a locked theme
 * here would hand out something the app immediately takes back.
 */
function RecapCustomiseSidebar() {
  const { theme, setTheme, themes } = useTheme();
  const { rewards, unlockedRewardIds, nextReward, isProgressLoading } =
    useRewardProgress("theme");

  const customThemes = useMemo(
    () => (themes || []).filter((t) => t !== "system"),
    [themes],
  );
  const unlockedThemes = useMemo(
    () => getUnlockedThemes(rewards, unlockedRewardIds),
    [rewards, unlockedRewardIds],
  );

  if (customThemes.length === 0) return null;

  return (
    <div className="hidden xl:flex xl:flex-col xl:gap-5 xl:w-full">
      <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <h3 className="flex items-center gap-2 font-semibold text-foreground tracking-tight">
          <Palette className="h-4 w-4 text-primary" aria-hidden />
          Customise & share your recap
        </h3>
        <p className="text-sm text-muted-foreground leading-snug">
          Choose a theme below to match your style, then use <Share2 className="inline h-3.5 w-3.5 mx-0.5 -mt-0.5" aria-hidden /> on any card to copy it, save it as a 1080&times;1920 image, or grab a text summary.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Theme
        </span>
        <TooltipProvider>
          <div className="grid grid-cols-1 gap-1.5">
            {customThemes.map((t) => {
              const isLocked = isThemeLocked(t, {
                unlockedThemes,
                isProgressLoading,
                activeTheme: theme,
              });
              const requirement = isLocked
                ? getThemeUnlockSentence(t, rewards)
                : null;

              const button = (
                <Button
                  variant={theme === t ? "secondary" : "outline"}
                  size="sm"
                  disabled={isLocked}
                  aria-label={
                    isLocked
                      ? `${formatThemeLabel(t)} (locked)`
                      : formatThemeLabel(t)
                  }
                  className={cn(
                    "w-full justify-start gap-2 font-normal",
                    isLocked && "opacity-50",
                  )}
                  onClick={() => !isLocked && setTheme(t)}
                >
                  <span className="flex-1 text-left">{formatThemeLabel(t)}</span>
                  {isLocked && <Lock className="h-3 w-3 shrink-0" aria-hidden />}
                </Button>
              );

              if (!requirement) return <div key={t}>{button}</div>;

              return (
                <Tooltip key={t}>
                  {/* A disabled button fires no pointer events, so the trigger
                      wraps it rather than replacing it. */}
                  <TooltipTrigger asChild>
                    <div>{button}</div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-56">
                    {requirement}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
        {nextReward && !isProgressLoading && (
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Next up:{" "}
            <span className="font-medium text-foreground">
              {nextReward.label}
            </span>{" "}
            — {getThemeUnlockSentence(nextReward.value, rewards)}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Inner client component for the Strength Year in Review page. Resolves which years have lifting data,
 * manages year selection state (including URL sync), and renders the recap carousel with optional
 * year selector and customisation sidebar.
 */
function StrengthYearInReviewMain() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const { parsedData, isDemoMode, isLoading, sheetInfo, hasUserData } = useUserLiftingData();

  // Signed in but no sheet connected: we still have demo data in parsedData.
  // Treat as "no data" and show connect-sheet instructions instead of demo recap.
  const needsToConnectSheet =
    authStatus === "authenticated" && !sheetInfo?.ssid && !isDemoMode;

  const yearsWithData = useMemo(() => {
    if (!parsedData || needsToConnectSheet) return [];
    return getYearsWithData(parsedData);
  }, [parsedData, needsToConnectSheet]);

  const yearFromQuery = router.query?.year
    ? parseInt(router.query.year, 10)
    : null;
  const [selectedYear, setSelectedYear] = useState(null);

  useEffect(() => {
    if (yearFromQuery && yearsWithData.includes(yearFromQuery)) {
      setSelectedYear(yearFromQuery);
    } else if (yearsWithData.length > 1 && !selectedYear) {
      setSelectedYear(Math.max(...yearsWithData));
    }
  }, [authStatus, yearFromQuery, yearsWithData, selectedYear]);

  const hasSingleYear = yearsWithData.length === 1;
  const hasMultipleYears = yearsWithData.length > 1;
  const effectiveYear =
    selectedYear ??
    yearFromQuery ??
    (hasSingleYear ? yearsWithData[0] : null);

  const showYearSelector = hasMultipleYears;
  const showCarousel = !!effectiveYear;

  const handleYearSelect = (year) => {
    setSelectedYear(year);
    router.replace(
      { pathname: router.pathname, query: { ...router.query, year } },
      undefined,
      { shallow: true },
    );
  };

  return (
    <PageContainer>
      <PageHeader hideRecapBanner>
        <PageHeaderHeading icon={Sparkles}>
          Your Strength Year in Review
        </PageHeaderHeading>
        <PageHeaderDescription>
          See your year of strength training in a Spotify Wrapped-style recap.
          Sessions, tonnage, PRs, and more.
        </PageHeaderDescription>
      </PageHeader>

      <section className="mt-6 space-y-6 px-3 sm:px-[2vw] md:px-[3vw]">
        {isLoading && (
          <div className="flex flex-col gap-6 xl:gap-8 xl:min-h-0 xl:grid xl:grid-cols-[13rem_1fr_minmax(18rem,22rem)] xl:items-start">
            <div className="order-2 xl:order-1 xl:col-start-1 xl:w-52 xl:shrink-0 xl:pt-2 xl:flex xl:justify-end">
              <YearSelectorSkeleton />
            </div>
            <div className="order-1 xl:order-2 xl:col-start-2 flex justify-center xl:min-w-0">
              <CarouselSkeleton />
            </div>
            <div className="order-3 flex flex-col pt-2 xl:col-start-3 xl:pt-2" />
          </div>
        )}

        {!isLoading && yearsWithData.length === 0 && !needsToConnectSheet && (
          <div className="rounded-lg border p-6 text-center text-muted-foreground">
            <p>No training data yet. Set up your Google Sheet to get started.</p>
          </div>
        )}

        {!isLoading && needsToConnectSheet && (
          <div className="flex flex-col gap-6 xl:gap-8 xl:grid xl:grid-cols-[13rem_1fr_minmax(18rem,22rem)] xl:items-start">
            <div className="xl:col-start-2 flex flex-col items-center justify-center rounded-lg border p-6 text-center text-muted-foreground xl:min-h-[280px]">
              <p>
                Set up your Google Sheet using the button above to load your
                lifting history. Your year in review will appear here once the
                setup is done.
              </p>
            </div>
            <div className="flex flex-col gap-6 pt-2 xl:col-start-3 xl:pt-2">
              <ConnectSheetRecapCard />
            </div>
          </div>
        )}

        {!isLoading && yearsWithData.length > 0 && (showYearSelector || showCarousel) && (
          <div
            className={cn(
              "flex flex-col gap-6 xl:gap-8 xl:min-h-0",
              showCarousel
                ? "xl:grid xl:grid-cols-[13rem_1fr_minmax(18rem,22rem)] xl:items-start"
                : "xl:flex xl:flex-row xl:items-start",
            )}
          >
            {showCarousel && (
              <div className="order-1 flex justify-center xl:order-2 xl:col-start-2 xl:min-w-0">
                <YearRecapCarousel year={effectiveYear} isDemo={isDemoMode} />
              </div>
            )}
            {showYearSelector && (
              <div className="order-2 xl:order-1 xl:col-start-1 xl:w-52 xl:shrink-0 xl:pt-2 xl:flex xl:justify-end">
                <YearSelector
                  years={yearsWithData}
                  selectedYear={effectiveYear}
                  onSelect={handleYearSelect}
                  variant={showCarousel ? "sidebar" : "default"}
                />
              </div>
            )}
            {showCarousel && (
              <div className="order-3 flex flex-col gap-6 pt-2 xl:col-start-3 xl:pt-2">
                {hasUserData && (
                  <RecapCustomiseSidebar />
                )}
                {authStatus === "authenticated" && !sheetInfo?.ssid ? (
                  <ConnectSheetRecapCard />
                ) : isDemoMode ? (
                  <DemoModeSignInCard />
                ) : null}
              </div>
            )}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
