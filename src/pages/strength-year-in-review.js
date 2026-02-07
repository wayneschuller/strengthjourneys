"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useMemo, useState, useEffect } from "react";
import { NextSeo } from "next-seo";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { getYearsWithData } from "@/components/year-recap/year-selector";
import Link from "next/link";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
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
    } else if (
      authStatus === "authenticated" &&
      yearsWithData.length > 1 &&
      !selectedYear
    ) {
      setSelectedYear(Math.max(...yearsWithData));
    }
  }, [authStatus, yearFromQuery, yearsWithData, selectedYear]);

  const hasSingleYear = yearsWithData.length === 1;
  const hasMultipleYears = yearsWithData.length > 1;
  const effectiveYear =
    selectedYear ??
    yearFromQuery ??
    (hasSingleYear ? yearsWithData[0] : null);

  const showYearSelector =
    hasMultipleYears &&
    (authStatus === "authenticated" || !effectiveYear);
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
        {authStatus === "unauthenticated" && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
            <p className="text-sm font-medium">
              Sign in to connect your Google Sheet and see your own recap.
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Connect your Google Sheet (or try the demo below)</li>
              <li>Pick a year with data</li>
              <li>Swipe through your recap and share to Instagram</li>
            </ol>
            <Link href="/api/auth/signin">
              <Button variant="outline" size="sm" className="mt-3">
                Sign in with Google
              </Button>
            </Link>
          </div>
        )}

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

        {!isLoading && yearsWithData.length > 0 && showYearSelector && (
          <YearSelector
            years={yearsWithData}
            selectedYear={effectiveYear}
            onSelect={handleYearSelect}
          />
        )}

        {!isLoading && showCarousel && (
          <YearRecapCarousel
            year={effectiveYear}
            isDemo={authStatus === "unauthenticated"}
          />
        )}
      </section>
    </PageContainer>
  );
}
