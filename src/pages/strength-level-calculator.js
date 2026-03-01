
import Link from "next/link";
import { devLog } from "@/lib/processing-utils";
import { NextSeo } from "next-seo";
import { sanityIOClient } from "@/lib/sanity-io.js";
import { RelatedArticles } from "@/components/article-cards";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
  PageHeaderRight,
} from "@/components/page-header";


import { Separator } from "@/components/ui/separator";
import { BicepsFlexed } from "lucide-react";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { StandardsSlider } from "@/components/standards-slider";
import { bigFourURLs } from "@/components/lift-type-indicator";

const LIFT_CALC_URLS = {
  "Back Squat": "/calculator/squat-1rm-calculator",
  "Bench Press": "/calculator/bench-press-1rm-calculator",
  "Deadlift": "/calculator/deadlift-1rm-calculator",
  "Strict Press": "/calculator/strict-press-1rm-calculator",
};

import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { SignInInvite } from "@/components/instructions-cards";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Strength Calculator";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

/**
 * Strength Level Calculator page. Renders SEO metadata and delegates rendering to StrengthLevelCalculatorMain.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles related to the Strength Calculator topic, fetched via ISR.
 */
export default function StrengthLevelCalculator({ relatedArticles }) {
  // OG Meta Tags
  const canonicalURL =
    "https://www.strengthjourneys.xyz/strength-level-calculator";
  const description =
    "Discover your strength level with our free calculator. Compare lifts based on age, gender, and bodyweight. Instant results for multiple lifts.";
  const title =
    "Strength Level Test: Free Tool for Lifters. No login required.";
  const keywords =
    "Strength level calculator, strength test, strength standards, powerlifting benchmarks, weightlifting performance, how strong am I, one-rep max (1RM), squat rating, bench press rating, deadlift rating, overhead press rating, strength comparison, bodyweight ratio, age-adjusted strength, gender-specific strength levels, beginner to elite lifter, strength training progress, fitness assessment tool, weightlifting goals, strength sports";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_strength_levels_calculator_og.png";

  return (
    <>
      <NextSeo
        title={title}
        description={description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: title,
          description: description,
          type: "website",
          images: [
            {
              url: ogImageURL,
              alt: "Strength Journeys Strength Level Calculator",
            },
          ],
          site_name: "Strength Journeys",
        }}
        twitter={{
          handle: "@wayneschuller",
          site: "@wayneschuller",
          cardType: "summary_large_image",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content: keywords,
          },
        ]}
      />
      {/* Keep the main component separate. I learned the hard way if it breaks server rendering you lose static metadata tags */}
      <StrengthLevelCalculatorMain relatedArticles={relatedArticles} />
    </>
  );
}

/**
 * Inner client component for the Strength Level Calculator page. Provides age, bodyweight, and sex
 * sliders and displays Lon Kilgore strength standards for every lift type as interactive slider bars.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles to display in the related articles section.
 */
function StrengthLevelCalculatorMain({ relatedArticles }) {
  const { standards, isMetric } = useAthleteBio();
  const { getColor } = useLiftColors();

  const unitType = isMetric ? "kg" : "lb";
  const liftTypesFromStandards = Object.keys(standards);

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={BicepsFlexed}>
          Strength Level Calculator
        </PageHeaderHeading>
        <PageHeaderDescription>
          How strong am I? Estimate your strength level based on age, gender,
          and bodyweight. <SignInInvite />
        </PageHeaderDescription>
        <PageHeaderRight>
          {/* <div className="hidden space-x-4 text-muted-foreground md:flex"> */}
          <div className="hidden gap-2 text-muted-foreground md:flex md:flex-col xl:flex-row">
            <Link
              href="/calculator"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">E1RM Calculator</h3>
              <p className="text-sm">Estimate your one rep max.</p>
            </Link>
            <Link
              href="/1000lb-club-calculator"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">
                1000-lb Club Calculator
              </h3>
              <p className="text-sm">Can you hit the 1000-lb club?</p>
            </Link>
          </div>
        </PageHeaderRight>
      </PageHeader>
      <Card className="pt-4">
        <CardContent className="">
          <div className="mb-6">
            <AthleteBioInlineSettings />
          </div>
          <div className="flex flex-col gap-8 md:ml-4">
            {liftTypesFromStandards.map((liftType) => (
              <div key={liftType} className="">
                <Link href={bigFourURLs[liftType]} className="transition-opacity hover:opacity-70">
                  <h2
                    className="text-xl font-bold underline decoration-2 underline-offset-2"
                    style={{ textDecorationColor: getColor(liftType) }}
                  >
                    {liftType} Strength Standards:
                  </h2>
                </Link>
                <StandardsSlider
                  liftType={liftType}
                  standards={standards}
                  isMetric={isMetric}
                  ratingRightSlot={LIFT_CALC_URLS[liftType] && (
                    <Link
                      href={LIFT_CALC_URLS[liftType]}
                      className="whitespace-nowrap hover:text-foreground"
                    >
                      {liftType} 1RM Calculator →
                    </Link>
                  )}
                />
                <Separator />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="text-sm">
          <div className="flex flex-col">
            <p className="">
              Our data model is a derivation of the excellent research of{" "}
              <a
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
                target="_blank"
                href="https://lonkilgore.com/"
              >
                Professor Lon Kilgore
              </a>
              . Any errors are our own.
            </p>
          </div>
        </CardFooter>
      </Card>
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}

// Small card displaying a single strength level label and its corresponding weight threshold.
const MiniCard = ({ levelString, weight, unitType }) => (
  <div className="flex-1 rounded-lg bg-card p-4">
    <h3 className="mb-2 text-sm font-medium">{levelString}</h3>
    <div className="text-2xl font-bold">
      {weight}
      {unitType}
    </div>
  </div>
);
