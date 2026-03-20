import Image from "next/image";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { BicepsFlexed } from "lucide-react";

import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { RelatedArticles } from "@/components/article-cards";
import { SignInInvite } from "@/components/instructions-cards";
import {
  PageContainer,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderRight,
} from "@/components/page-header";
import { StandardsSlider } from "@/components/standards-slider";
import { Card, CardContent } from "@/components/ui/card";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { fetchRelatedArticles } from "@/lib/sanity-io";
import { STRENGTH_STANDARDS_LINKS } from "@/lib/strength-standards-pages";
import { getLiftSvgPath } from "@/components/year-recap/lift-svg";

const LIFT_CALC_URLS = {
  "Back Squat": "/calculator/squat-1rm-calculator",
  "Bench Press": "/calculator/bench-press-1rm-calculator",
  "Deadlift": "/calculator/deadlift-1rm-calculator",
  "Strict Press": "/calculator/strict-press-1rm-calculator",
};

export async function getStaticProps() {
  const relatedArticles = await fetchRelatedArticles("Strength Calculator");

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

export default function BigFourStrengthStandardsPage({ relatedArticles }) {
  const canonicalURL =
    "https://www.strengthjourneys.xyz/strength-standards/big-four";
  const title =
    "Big Four Strength Standards by Bodyweight, Age, and Sex";
  const description =
    "See big four strength standards for back squat, bench press, deadlift, and strict press. Check beginner, intermediate, advanced, and elite benchmarks by bodyweight, age, and sex in one place.";
  const keywords =
    "big four strength standards, squat bench deadlift press standards, strength standards by bodyweight, big four lifting standards, beginner intermediate advanced elite";

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
          site_name: "Strength Journeys",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content: keywords,
          },
        ]}
      />
      <BigFourStrengthStandardsMain relatedArticles={relatedArticles} />
    </>
  );
}

function BigFourStrengthStandardsMain({ relatedArticles }) {
  const { standards, isMetric } = useAthleteBio();
  const { getColor } = useLiftColors();
  const liftTypesFromStandards = Object.keys(standards ?? {});

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={BicepsFlexed}>
          Big Four Strength Standards
        </PageHeaderHeading>
        <PageHeaderDescription>
          See beginner, intermediate, advanced, and elite benchmarks for back
          squat, bench press, deadlift, and strict press based on age, sex, and
          bodyweight. <SignInInvite />
        </PageHeaderDescription>
        <PageHeaderRight>
          <div className="hidden gap-2 text-muted-foreground md:flex md:flex-col xl:flex-row">
            <Link
              href="/strength-standards"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">Standards Hub</h3>
              <p className="text-sm">
                Browse the single-lift standards pages.
              </p>
            </Link>
            <Link
              href="/calculator"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">E1RM Calculator</h3>
              <p className="text-sm">Estimate your one rep max.</p>
            </Link>
          </div>
        </PageHeaderRight>
      </PageHeader>

      <Card>
        <CardContent className="py-3">
          <AthleteBioInlineSettings />
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-col gap-3">
        {liftTypesFromStandards.map((liftType) => (
          <div
            key={liftType}
            className="flex items-start overflow-hidden rounded-lg border bg-card shadow-sm"
          >
            <div className="flex w-20 flex-shrink-0 flex-col items-center gap-2 self-stretch border-r bg-muted/40 px-3 py-4 sm:w-24">
              {getLiftSvgPath(liftType) ? (
                <Link
                  href={STRENGTH_STANDARDS_LINKS[liftType] ?? "#"}
                  tabIndex={-1}
                  aria-hidden
                  className="w-full"
                >
                  <Image
                    src={getLiftSvgPath(liftType)}
                    alt=""
                    width={96}
                    height={96}
                    className="w-full object-contain opacity-90 transition-opacity hover:opacity-50"
                  />
                </Link>
              ) : (
                <div className="aspect-square w-full" />
              )}
            </div>

            <div className="min-w-0 flex-1 p-4">
              <Link
                href={STRENGTH_STANDARDS_LINKS[liftType] ?? "#"}
                className="transition-opacity hover:opacity-70"
              >
                <h2
                  className="text-xl font-bold underline decoration-2 underline-offset-2"
                  style={{ textDecorationColor: getColor(liftType) }}
                >
                  {liftType} Strength Standards
                </h2>
              </Link>
              <StandardsSlider
                liftType={liftType}
                standards={standards}
                isMetric={isMetric}
                ratingRightSlot={
                  LIFT_CALC_URLS[liftType] && (
                    <Link
                      href={LIFT_CALC_URLS[liftType]}
                      className="whitespace-nowrap hover:text-foreground"
                    >
                      {liftType} 1RM Calculator →
                    </Link>
                  )
                }
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 px-1 text-sm text-muted-foreground">
        Our data model is a derivation of the excellent research of{" "}
        <a
          className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          target="_blank"
          rel="noreferrer"
          href="https://lonkilgore.com/"
        >
          Professor Lon Kilgore
        </a>
        . Any errors are our own.
      </p>

      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}
