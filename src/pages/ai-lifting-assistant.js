"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { useChat } from "ai/react";
import { devLog } from "@/lib/processing-utils";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useLocalStorage } from "usehooks-ts";
import {
  interpolateStandardKG,
  LiftingStandardsKG,
} from "@/lib/lifting-standards-kg";
import { Separator } from "@/components/ui/separator";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useSession } from "next-auth/react";
import { Checkbox } from "@/components/ui/checkbox";

const RELATED_ARTICLES_CATEGORY = "AI Lifting Assistant";

export default function AILiftingAssistantPage({ relatedArticles }) {
  // OG Meta Tags
  const canonicalURL = "https://www.strengthjourneys.xyz/ai-lifting-assistant";
  const description =
    "Discover your strength level with our free calculator. Compare lifts based on age, gender, and bodyweight. Instant results for multiple lifts. Optimize your training.";
  const title = "AI Lifting Assistant | Strength Journeys";
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
              alt: "Strength Journeys AI Lifting Assistant",
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
      <AILiftingAssistantMain relatedArticles={relatedArticles} />
    </>
  );
}

function AILiftingAssistantMain({ relatedArticles }) {
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

  return (
    // <main className="mx-4 flex flex-col items-center md:mx-[5vw]">
    <main className="mx-4 md:mx-[5vw]">
      <h1 className="py-5 text-center text-xl font-bold tracking-tight md:text-3xl">
        AI Lifting Assistant
      </h1>
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="flex-1">
          <AILiftingAssistantCard />
        </div>
        <div className="flex flex-col gap-5">
          <BioDetailsCard
            age={age}
            setAge={setAge}
            bodyWeight={bodyWeight}
            setBodyWeight={setBodyWeight}
            isMetric={isMetric}
            toggleIsMetric={toggleIsMetric}
            sex={sex}
            setSex={setSex}
          />
          <LiftingDataCard />
        </div>
      </div>
      <RelatedArticles articles={relatedArticles} />
    </main>
  );
}

function AILiftingAssistantCard() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Personal Lifting AI Assistant</CardTitle>
        <CardDescription>
          Discussions are shown on your device and not saved on our servers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex-grow overflow-auto rounded border p-2">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-2 ${message.role === "user" ? "text-right" : "text-left"}`}
            >
              <span
                className={`inline-block rounded-lg p-2 ${message.role === "user" ? "bg-blue-200" : "bg-gray-200"}`}
              >
                {message.content}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message here..."
            className="flex-grow rounded-l border p-2"
          />
          <Button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            Ask
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LiftingDataCard() {
  const { parsedData, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Lifting Data</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-x-2">
          <Checkbox />
          <span>Share a summary of my lifting data with the AI</span>
        </div>
        {authStatus === "unauthenticated" && "Sign in to share your data"}
        {authStatus === "authenticated" &&
        parsedData &&
        parsedData.length > 0 ? (
          <div>Data loaded.</div>
        ) : (
          <div>No data loaded</div>
        )}
      </CardContent>
    </Card>
  );
}

function BioDetailsCard({
  age,
  setAge,
  bodyWeight,
  isMetric,
  toggleIsMetric,
  setBodyWeight,
  sex,
  setSex,
}) {
  return (
    <Card className="">
      <CardHeader>
        <CardTitle>Tell us about yourself</CardTitle>
        <CardDescription>
          The AI will use this info to personalise the answer.
        </CardDescription>
      </CardHeader>
      <CardContent className="">
        <div className="space-x-2">
          <Checkbox />
          <span>Share this with the AI</span>
        </div>
        <div className="mb-10 flex flex-col items-start gap-4 md:mr-10 md:flex-col md:gap-8">
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
      </CardContent>
      <CardFooter className="text-sm"></CardFooter>
    </Card>
  );
}

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
