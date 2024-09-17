"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useLocalStorage } from "usehooks-ts";
import {
  interpolateStandardKG,
  LiftingStandardsKG,
} from "@/lib/lifting-standards-kg";
import { Separator } from "@/components/ui/separator";
import { useIsClient } from "usehooks-ts";
import { BicepsFlexed } from "lucide-react";

const RELATED_ARTICLES_CATEGORY = "Strength Calculator";
export async function getStaticProps() {
  try {
    const relatedArticles = await sanityIOClient.fetch(
      `
      *[_type == "post" && publishedAt < now() && $category in categories[]->title] | order(publishedAt desc) {
        title,
        "slug": slug.current,
        publishedAt,
        categories[]-> {
          title
        },
        mainImage,
      }
    `,
      { category: RELATED_ARTICLES_CATEGORY },
    );

    return {
      props: {
        relatedArticles: relatedArticles || [],
      },
      revalidate: 60 * 60, // Revalidate every hour
    };
  } catch (error) {
    console.error("Error fetching related articles:", error);
    return {
      props: {
        relatedArticles: [],
      },
      revalidate: 60 * 60,
    };
  }
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
  const isClient = useIsClient();
  const [age, setAge] = useLocalStorage("AthleteAge", 30, {
    initializeWithValue: false,
  });
  const [isMetric, setIsMetric] = useLocalStorage("calcIsMetric", false, {
    initializeWithValue: false,
  });
  const [sex, setSex] = useLocalStorage("AthleteSex", "male", {
    initializeWithValue: false,
  });
  const [bodyWeight, setBodyWeight] = useLocalStorage(
    "AtheleteBodyWeight",
    200,
    {
      initializeWithValue: false,
    },
  );
  const [standards, setStandards] = useState({});

  useEffect(() => {
    const bodyWeightKG = isMetric
      ? bodyWeight
      : Math.round(bodyWeight / 2.2046);

    const uniqueLiftNames = Array.from(
      new Set(LiftingStandardsKG.map((item) => item.liftType)),
    );
    const newStandards = {};

    uniqueLiftNames.forEach((liftType) => {
      const standard = interpolateStandardKG(
        age,
        bodyWeightKG,
        sex,
        liftType,
        LiftingStandardsKG,
      );

      if (isMetric) {
        newStandards[liftType] = standard || {};
      } else {
        // Convert standard to lb
        newStandards[liftType] = {
          physicallyActive: Math.round(standard?.physicallyActive * 2.2046),
          beginner: Math.round(standard?.beginner * 2.2046),
          intermediate: Math.round(standard?.intermediate * 2.2046),
          advanced: Math.round(standard?.advanced * 2.2046),
          elite: Math.round(standard?.elite * 2.2046),
        };
      }
    });

    setStandards(newStandards);
  }, [age, sex, bodyWeight, isMetric]);

  const toggleIsMetric = (isMetric) => {
    let newBodyWeight;

    if (!isMetric) {
      // Going from kg to lb
      newBodyWeight = Math.round(bodyWeight * 2.2046);
      setIsMetric(false);
    } else {
      // Going from lb to kg
      newBodyWeight = Math.round(bodyWeight / 2.2046);
      setIsMetric(true);
    }

    setBodyWeight(newBodyWeight);
  };

  const unitType = isMetric ? "kg" : "lb";

  const liftTypesFromStandards = Object.keys(standards);

  return (
    <div className="container">
      <PageHeader>
        <PageHeaderHeading icon={BicepsFlexed}>
          Strength Level Calculator
        </PageHeaderHeading>
        <PageHeaderDescription>
          How strong am I? Estimate your strength level based on age, gender,
          and bodyweight.
        </PageHeaderDescription>
      </PageHeader>
      <Card className="pt-4">
        <CardContent className="">
          <div className="mb-10 flex flex-col items-start gap-4 md:mr-10 md:flex-row md:gap-8">
            <div className="flex w-full flex-col md:w-2/5">
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
            <div className="flex h-[4rem] w-full flex-col justify-between md:w-3/5">
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
          </div>
          <div className="flex flex-col gap-4 md:ml-4">
            {liftTypesFromStandards.map((liftType) => (
              <div key={liftType} className="">
                <h2 className="text-lg font-bold">{liftType} Standards:</h2>
                <div className="grid grid-cols-3 md:grid-cols-5">
                  <MiniCard
                    levelString="Physically Active"
                    weight={standards[liftType]?.physicallyActive}
                    unitType={unitType}
                  />
                  <MiniCard
                    levelString="Beginner"
                    weight={standards[liftType]?.beginner}
                    unitType={unitType}
                  />
                  <MiniCard
                    levelString="Intermediate"
                    weight={standards[liftType]?.intermediate}
                    unitType={unitType}
                  />
                  <MiniCard
                    levelString="Advanced"
                    weight={standards[liftType]?.advanced}
                    unitType={unitType}
                  />
                  <MiniCard
                    levelString="Elite"
                    weight={standards[liftType]?.elite}
                    unitType={unitType}
                  />
                </div>
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
    </div>
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
