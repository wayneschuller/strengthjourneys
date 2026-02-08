"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useMemo, useState, useEffect } from "react";
import { NextSeo } from "next-seo";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { getYearsWithData } from "@/components/year-recap/year-selector";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { YearRecapCarousel } from "@/components/year-recap/year-recap-carousel";
import { YearSelector } from "@/components/year-recap/year-selector";

export async function getStaticProps() {
  return { props: {}, revalidate: 60 * 60 };
}

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

function StrengthYearInReviewMain() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const { parsedData, isLoading } = useUserLiftingData();

  const yearsWithData = useMemo(() => {
    if (!parsedData) return [];
    return getYearsWithData(parsedData);
  }, [parsedData]);

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
      <PageHeader>
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
          <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
            Loading your data...
          </div>
        )}

        {!isLoading && yearsWithData.length === 0 && (
          <div className="rounded-lg border p-6 text-center text-muted-foreground">
            <p>No training data yet. Connect your Google Sheet to get started.</p>
          </div>
        )}

        {!isLoading && yearsWithData.length > 0 && (showYearSelector || showCarousel) && (
          <div
            className={cn(
              "flex flex-col gap-6 md:gap-8 lg:gap-12 md:min-h-0",
              showCarousel
                ? "md:grid md:grid-cols-[13rem_1fr_minmax(12rem,14rem)] md:items-start"
                : "md:flex md:flex-row md:items-start",
            )}
          >
            {showCarousel && (
              <div className="order-1 md:order-2 md:col-start-2 flex justify-center md:min-w-0">
                <YearRecapCarousel
                  year={effectiveYear}
                  isDemo={authStatus === "unauthenticated"}
                />
              </div>
            )}
            {showYearSelector && (
              <div className="order-2 md:order-1 md:col-start-1 md:w-52 md:shrink-0 md:pt-2 md:flex md:justify-end">
                <YearSelector
                  years={yearsWithData}
                  selectedYear={effectiveYear}
                  onSelect={handleYearSelect}
                  variant={showCarousel ? "sidebar" : "default"}
                />
              </div>
            )}
            {showYearSelector && showCarousel && (
              <div className="hidden md:col-start-3 md:block" aria-hidden="true" />
            )}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
