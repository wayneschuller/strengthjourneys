"use client";

import { useState, useEffect, useRef } from "react";
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
import { Check, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import FlickeringGrid from "@/components/magicui/flickering-grid";

const RELATED_ARTICLES_CATEGORY = "AI Lifting Assistant";

export default function AILiftingAssistantPage({ relatedArticles }) {
  // OG Meta Tags
  const canonicalURL = "https://www.strengthjourneys.xyz/ai-lifting-assistant";
  const description =
    "Free AI Lifting Assistant. Talk to your lifting Data. Receive tailored recommendations to boost your strength training.";
  const title = "AI Lifting Assistant | Strength Journeys";
  const keywords =
    "AI lifting assistant, personalized lifting advice, strength training, lifting progress tracker, weightlifting analysis, barbell lifting, strength goals, fitness AI";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_ai_lifting_assistant.png";

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
  const [height, setHeight] = useLocalStorage("AthleteHeight", 170, {
    initializeWithValue: false,
  }); // Default height in cm
  const [userLiftingMetadata, setUserLiftingMetaData] = useLocalStorage(
    "userLiftingMetadata-selected-options",
    {
      all: false,
      records: false,
      frequency: false,
      consistency: false,
      sessionData: false,
    },
    { initializeWithValue: false },
  );

  const {
    parsedData,
    isLoading,
    liftTypes,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const [standards, setStandards] = useState({});
  const [shareBioDetails, setShareBioDetails] = useLocalStorage(
    "SJ_ShareBioDetailsAI",
    false,
    { initializeWithValue: false },
  );

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

  let userProvidedProfileData = "";
  if (shareBioDetails) {
    userProvidedProfileData +=
      `Some background information: ` +
      `I am a ${age} year old ${sex}, my weight is ${bodyWeight}${isMetric ? "kg" : "lb"}, ` +
      `I prefer to use ${isMetric ? "metric units" : "lb units"}, ` +
      `My height is ${height}cm, `;

    let standardsMetadata = "";

    Object.entries(standards).forEach(([lift, levels]) => {
      standardsMetadata += `For ${lift} the kg standards are:\n`;
      Object.entries(levels).forEach(([level, weight]) => {
        standardsMetadata += `- ${level.charAt(0).toUpperCase() + level.slice(1)}: ${weight}kg+\n`;
      });
      standardsMetadata += `\n`;
    });

    userProvidedProfileData +=
      "To help you assess my progress, here are the Lon Kilgore lifting standards interpolated for my age/sex/weight: ";

    userProvidedProfileData += standardsMetadata;
  }

  const slicedLiftTypes = liftTypes.slice(0, 10); // Just the top 10 lifts

  if (userLiftingMetadata.records) {
    devLog(topLiftsByTypeAndReps);
    slicedLiftTypes.forEach((entry) => {
      const liftType = entry.liftType;

      // Tell the AI our best single ever and last 12 months
      const single = topLiftsByTypeAndReps[liftType]?.[0]?.[0];
      if (single !== undefined) {
        userProvidedProfileData += `My best ever ${liftType} single was ${single.weight}${single.unitType} on ${single.date}, `;
      }
      const singleYear = topLiftsByTypeAndRepsLast12Months[liftType]?.[0]?.[0];
      if (singleYear !== undefined) {
        userProvidedProfileData += `My best ${liftType} single in the last 12 months was ${singleYear.weight}${singleYear.unitType} on ${singleYear.date}, `;
      }

      // FIXME: Tell the AI our best 3RM ever and last 12 months

      // Tell the AI our best 5RM ever and last 12 months
      const fiveRM = topLiftsByTypeAndReps[liftType]?.[4]?.[0];
      if (fiveRM !== undefined) {
        userProvidedProfileData += `My best ever ${liftType} 5RM was ${fiveRM.weight}${fiveRM.unitType} on ${fiveRM.date}, `;
      }
      const fiveRMYear = topLiftsByTypeAndRepsLast12Months[liftType]?.[4]?.[0];
      if (fiveRMYear !== undefined) {
        userProvidedProfileData += `My best ${liftType} 5RM in the last 12 months was ${fiveRMYear.weight}${fiveRMYear.unitType} on ${fiveRMYear.date}, `;
      }
    });
  }

  if (userLiftingMetadata.frequency) {
    const formattedString = slicedLiftTypes
      .map(
        ({ liftType, totalSets, totalReps, newestDate, oldestDate }) =>
          `${liftType}: ${totalSets} sets, ${totalReps} reps (from ${oldestDate} to ${newestDate})`,
      )
      .join("; ");

    userProvidedProfileData +=
      "Here are my statistics for each lift type: " + formattedString + ", ";
  }

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
      <h1 className="flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight">
        AI Lifting Assistant{" "}
      </h1>
      <h3 className="text-center">
        This new feature is still being tested. Please leave{" "}
        <a
          href="https://strengthjourneys.canny.io/"
          className="hover:underline"
        >
          feedback
        </a>
        !
      </h3>
      <div className="mt-8 flex flex-col gap-5 lg:flex-row">
        <div className="h-dvh flex-1 lg:flex lg:flex-col">
          <AILiftingAssistantCard
            userProvidedProfileData={userProvidedProfileData}
          />
        </div>
        <div className="md:max-w-2/5 flex flex-col gap-5">
          <BioDetailsCard
            age={age}
            setAge={setAge}
            bodyWeight={bodyWeight}
            setBodyWeight={setBodyWeight}
            isMetric={isMetric}
            toggleIsMetric={toggleIsMetric}
            sex={sex}
            setSex={setSex}
            height={height}
            setHeight={setHeight}
            shareBioDetails={shareBioDetails}
            setShareBioDetails={setShareBioDetails}
          />
          <LiftingDataCard
            selectedOptions={userLiftingMetadata}
            setSelectedOptions={setUserLiftingMetaData}
          />
        </div>
      </div>
      <RelatedArticles articles={relatedArticles} />
    </main>
  );
}

const defaultMessages = [
  "Ask anything about barbell lifting and fitness.",
  "What should I do in my first gym session?",
  "How often should I deadlift?",
  "Am I strong for my age?",
];

// -----------------------------------------------------------------------------------------------------
// AILiftingAssistantCard - chatbot
// -----------------------------------------------------------------------------------------------------
function AILiftingAssistantCard({ userProvidedProfileData }) {
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const {
    messages,
    input,
    setInput,
    append,
    handleInputChange,
    handleSubmit,
    isLoading,
  } = useChat({
    onFinish: (message, { usage, finishReason }) => {
      // devLog("Finished streaming message:", message);
      devLog("Token usage:", usage);
    },
    onError: (error) => {
      console.error("An error occurred:", error);
    },
    onResponse: (response) => {
      // devLog("Received HTTP response from server:", response);
    },
    body: { userProvidedMetadata: userProvidedProfileData }, // Share the user selected metadata with the AI temporarily
  });
  const scrollRef = useChatScroll(messages);

  return (
    <Card className="max-h-full bg-background text-foreground">
      <CardHeader className="flex flex-1 flex-row">
        <div className="flex flex-1 flex-col">
          <CardTitle className="text-balance text-2xl font-bold">
            Your Personal Lifting AI Assistant
          </CardTitle>
          <CardDescription className="text-balance text-muted-foreground">
            Discussions are streamed to your device and not stored on our
            servers.
          </CardDescription>
        </div>
        <FlickeringGridDemo />
      </CardHeader>
      <CardContent className="flex flex-col justify-between">
        <div
          ref={scrollRef}
          className="mb-4 h-[30rem] space-y-4 overflow-auto scroll-smooth rounded-lg border border-border p-4"
        >
          {messages.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center space-y-2 text-center">
              {defaultMessages.map((message, index) => (
                <p
                  key={index}
                  className="cursor-pointer italic text-muted-foreground"
                  onClick={() => {
                    setInput(message);
                    // handleSubmit(); // FIXME: Get it to auto submit when they click a suggested default
                  }}
                >
                  {message}
                </p>
              ))}
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <span
                  className={`inline-block max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {message.content.split("\n").map((line, lineIndex) => (
                    <p key={lineIndex}>{line}</p>
                  ))}
                </span>
              </div>
            ))
          )}
          <LoaderCircle className={cn(isLoading ? "animate-spin" : "hidden")} />
        </div>
      </CardContent>
      <CardFooter className="">
        <div className="flex-1 flex-row">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Type your question here..."
              className="flex-grow rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <Button type="submit" className="rounded-r-lg">
              Ask
            </Button>
          </form>
        </div>
      </CardFooter>
    </Card>
  );
}

export function LiftingDataCard({ selectedOptions, setSelectedOptions }) {
  const { parsedData, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();

  const handleSelectAll = () => {
    const allChecked = !selectedOptions.all;
    setSelectedOptions({
      all: allChecked,
      records: allChecked,
      frequency: allChecked,
      consistency: allChecked,
      sessionData: allChecked,
    });
  };

  const handleOptionChange = (key) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
      all: false, // Uncheck 'Check All' if individual option is toggled
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Talk To Your Lifting Data</CardTitle>
        <CardDescription>
          {authStatus === "unauthenticated" && "Sign in to share your data"}
          {authStatus === "authenticated" && parsedData && parsedData.length > 0
            ? "Data successfully loaded and available."
            : "No data loaded"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-2 text-muted-foreground">
          Select the lifting info to share with the AI:
        </div>
        <div className="space-y-2">
          <div className="group flex items-center gap-2">
            <Checkbox
              id="select-all-checkbox"
              checked={selectedOptions.all}
              onCheckedChange={handleSelectAll}
              className="group-hover:border-blue-500"
            />
            <Label
              htmlFor="select-all-checkbox"
              className="cursor-pointer group-hover:underline"
            >
              {selectedOptions.all ? "Unshare All" : "Share All"}
            </Label>
          </div>

          <Separator />
          <div className="group flex items-center gap-2">
            <Checkbox
              id="records-checkbox"
              checked={selectedOptions.records}
              onCheckedChange={() => handleOptionChange("records")}
              className="group-hover:border-blue-500"
            />
            <Label
              htmlFor="records-checkbox"
              className={cn(
                "cursor-pointer hover:underline",
                !selectedOptions.records && "text-muted-foreground/50",
              )}
            >
              Personal records, lifetime and yearly
            </Label>
          </div>
          <div className="group flex items-center gap-2">
            <Checkbox
              id="frequency-checkbox"
              checked={selectedOptions.frequency}
              onCheckedChange={() => handleOptionChange("frequency")}
              className="group-hover:border-blue-500"
            />
            <Label
              htmlFor="frequency-checkbox"
              className={cn(
                "cursor-pointer hover:underline",
                !selectedOptions.frequency && "text-muted-foreground/50",
              )}
            >
              Lift frequency and timeline metadata
            </Label>
          </div>
          <div className="group flex items-center gap-2">
            <Checkbox
              id="consistency-checkbox"
              checked={selectedOptions.consistency}
              onCheckedChange={() => handleOptionChange("consistency")}
              className="group-hover:border-blue-500"
            />
            <Label
              htmlFor="consistency-checkbox"
              className={cn(
                "cursor-pointer hover:underline",
                !selectedOptions.consistency && "text-muted-foreground/50",
              )}
            >
              Consistency ratings (coming soon)
            </Label>
          </div>
          <div className="group flex items-center gap-2">
            <Checkbox
              id="session-data-checkbox"
              checked={selectedOptions.sessionData}
              onCheckedChange={() => handleOptionChange("sessionData")}
              className="group-hover:border-blue-500"
            />
            <Label
              htmlFor="session-data-checkbox"
              className={cn(
                "cursor-pointer hover:underline",
                !selectedOptions.sessionData && "text-muted-foreground/50",
              )}
            >
              Previous two weeks detailed session data (coming soon)
            </Label>
          </div>
        </div>
        <div className="mt-5 text-sm text-muted-foreground">
          <p>
            For more information read our{" "}
            <Link
              href="/privacy-policy.html"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
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
  height,
  setHeight,
  shareBioDetails,
  setShareBioDetails,
}) {
  return (
    <Card className="">
      <CardHeader>
        <CardTitle>Tell us about yourself</CardTitle>
        <CardDescription>
          Enhance the AI by providing your basic details
        </CardDescription>
      </CardHeader>
      <CardContent className="">
        <div className="group mb-5 flex flex-row space-x-2 align-middle">
          <Checkbox
            id="shareBioDetails"
            checked={shareBioDetails}
            onCheckedChange={setShareBioDetails}
            className="group-hover:border-blue-500"
          />
          <Label
            htmlFor="shareBioDetails"
            className="cursor-pointer text-sm font-medium leading-none group-hover:underline peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Share this with the AI
          </Label>
        </div>

        <div
          className={cn(
            "flex flex-col items-start gap-4 md:flex-col md:gap-8",
            !shareBioDetails && "text-muted-foreground/40",
          )}
        >
          <div className="flex w-full flex-col">
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
          <div className="flex h-[4rem] w-full flex-col justify-between">
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
          <div>
            <HeightWidget height={height} setHeight={setHeight} />
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
      {/* <CardFooter className="text-sm"></CardFooter> */}
    </Card>
  );
}

function FlickeringGridDemo() {
  return (
    <FlickeringGrid
      squareSize={4}
      gridGap={6}
      color="#6B7280"
      maxOpacity={0.5}
      flickerChance={0.2}
      height={70}
      width={70}
    />
  );
}

function useChatScroll(dep) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [dep]);
  return ref;
}

const HeightWidget = ({ height, setHeight }) => {
  const handleHeightChange = (newHeight) => {
    setHeight(newHeight[0]);
  };

  const cmToFeetInches = (cm) => {
    const inches = cm / 2.54;
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.round(inches % 12);
    return `${feet}'${remainingInches}"`;
  };

  return (
    <div className="flex w-96 flex-col align-middle">
      <div className="mb-2 flex flex-row gap-2 align-middle">
        <Label htmlFor="height" className="flex flex-row gap-3 text-xl">
          Height:
          <div className="">{height}cm</div>
          <div className="">{cmToFeetInches(height)}</div>
        </Label>
      </div>
      <Slider
        min={100}
        max={250}
        step={1}
        value={[height]}
        onValueChange={handleHeightChange}
        className="flex-grow"
      />
    </div>
  );
};

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
