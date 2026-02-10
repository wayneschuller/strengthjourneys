"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { devLog } from "@/lib/processing-utils";
import { NextSeo } from "next-seo";
import { sanityIOClient } from "@/lib/sanity-io.js";
import { RelatedArticles } from "@/components/article-cards";
import { UnitChooser } from "@/components/unit-type-chooser";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
  PageHeaderRight,
} from "@/components/page-header";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { BicepsFlexed } from "lucide-react";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { StandardsSlider } from "@/components/standards-slider";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { SignInInvite } from "@/components/instructions-cards";

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

// Strength Level Calculator
function StrengthLevelCalculatorMain({ relatedArticles }) {
  const {
    age,
    setAge,
    isMetric,
    setIsMetric,
    sex,
    setSex,
    bodyWeight,
    setBodyWeight,
    standards,
    toggleIsMetric,
  } = useAthleteBio();
  const { status: authStatus } = useSession();
  const [isYearly, setIsYearly] = useState(false);

  // devLog(standards[`Back Squat`].beginner);

  const unitType = isMetric ? "kg" : "lb";

  const bigFourURLs = {
    "Back Squat": "/barbell-squat-insights",
    "Bench Press": "/barbell-bench-press-insights",
    Deadlift: "/barbell-deadlift-insights",
    "Strict Press": "/barbell-strict-press-insights",
  };

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
          <div className="mb-10 flex flex-col items-start gap-4 md:mr-10 md:flex-row md:gap-8">
            <div className="md:min-w-1/5 flex w-full flex-col">
              <div className="py-2">
                <Label htmlFor="age" className="text-xl">
                  Age: {age}
                </Label>
              </div>
              <Slider
                min={13}
                max={100}
                step={1}
                value={[age]}
                onValueChange={(values) => setAge(values[0])}
                className="mt-2 min-w-40 flex-1"
                aria-label="Age"
                aria-labelledby="age"
              />
            </div>
            <div className="md:min-w-1/5 flex h-[4rem] w-full flex-col justify-between">
              <div className="flex flex-row items-center">
                <Label htmlFor="weight" className="mr-2 text-xl">
                  Bodyweight:
                </Label>
                <Label
                  htmlFor="weight"
                  className="mr-2 w-[3rem] text-right text-xl"
                >
                  {bodyWeight}
                </Label>
                <UnitChooser
                  isMetric={isMetric}
                  onSwitchChange={toggleIsMetric}
                />
              </div>
              <Slider
                min={isMetric ? 40 : 100}
                max={isMetric ? 230 : 500}
                step={1}
                value={[bodyWeight]}
                onValueChange={(values) => setBodyWeight(values[0])}
                className="mt-2 min-w-40 flex-1"
                aria-label={`Bodyweight in ${isMetric ? "kilograms" : "pounds"} `}
              />
            </div>
            <div className="flex h-[4rem] w-40 grow-0 items-center space-x-2">
              <Label htmlFor="sex" className="text-xl">
                Sex:
              </Label>
              <Select
                id="gender"
                value={sex}
                onValueChange={(value) => setSex(value)}
                className="min-w-52 text-xl"
              >
                <SelectTrigger aria-label="Select sex">
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {authStatus === "authenticated" && (
              <div>
                Select PR Period:
                <div className="mt-1 flex flex-row gap-4">
                  <RadioGroup
                    value={isYearly ? "true" : "false"} // Set the value as string for RadioGroupItem
                    onValueChange={(val) => setIsYearly(val === "true")} // Convert to boolean
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="lifetime" />
                      <Label htmlFor="lifetime">Lifetime</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="yearly" />
                      <Label htmlFor="yearly">12 Months</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-8 md:ml-4">
            {liftTypesFromStandards.map((liftType) => (
              <div key={liftType} className="">
                <Link href={bigFourURLs[liftType]}>
                  <h2 className="text-lg font-bold hover:underline">
                    {liftType} Standards:
                  </h2>
                </Link>
                <StandardsSlider
                  liftType={liftType}
                  isYearly={isYearly}
                  standards={standards}
                  isMetric={isMetric}
                />
                <Separator />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="text-sm">
          <div className="flex flex-col">
            <p className="">
              {" "}
              To see a strength rating for a particular set, e.g.: Squat 3x5
              {"@"}225lb, then use our{" "}
              <Link
                href="/calculator"
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                One Rep Max Calculator
              </Link>{" "}
              and click {`"`}Strength Level Insights{`"`}.
            </p>
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

const MiniCard = ({ levelString, weight, unitType }) => (
  <div className="flex-1 rounded-lg bg-card p-4">
    <h3 className="mb-2 text-sm font-medium">{levelString}</h3>
    <div className="text-2xl font-bold">
      {weight}
      {unitType}
    </div>
  </div>
);
