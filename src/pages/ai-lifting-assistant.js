"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { useChat } from "ai/react";
import { devLog } from "@/lib/processing-utils";
import { sanityIOClient, urlFor } from "@/lib/sanity-io.js";
import { RelatedArticles } from "@/components/article-cards";

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

import { Button } from "@/components/ui/button";
import { useLocalStorage } from "usehooks-ts";
import {
  interpolateStandardKG,
  LiftingStandardsKG,
} from "@/lib/lifting-standards-kg";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import FlickeringGrid from "@/components/magicui/flickering-grid";
import { BioDetailsCard } from "@/components/ai-assistant/bio-details-card";
import { LiftingDataCard } from "@/components/ai-assistant/lifting-data-card";
import ReactMarkdown from "react-markdown";

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
    // devLog(topLiftsByTypeAndReps);
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
    <div className="container">
      <PageHeader>
        <PageHeaderHeading icon="Bot">AI Lifting Assistant</PageHeaderHeading>
        <PageHeaderDescription>
          Free AI Lifting Assistant. Talk to your lifting data. The gym buddy
          you never had.
        </PageHeaderDescription>
      </PageHeader>
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
    </div>
  );
}

const defaultMessages = [
  "Why lift weights?",
  "What should I do in my first gym session?",
  "How often should I deadlift?",
  "Am I strong for my age?",
  "I'm female, will I get bulky lifting weights?",
  "How do I choose a gym?",
  "Write me a motivational rap.",
  "Isn't deadlifting dangerous?",
  "How strong am I?",
  "Can I lift weights and still lose weight?",
  "How much protein should I eat?",
  "Should I lift every day?",
  "What are the health benefits for women who lift?",
  "ME STRONG",
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

  devLog(messages);

  return (
    <Card className="max-h-full bg-background text-foreground">
      <CardHeader className="flex flex-1 flex-row">
        <div className="flex flex-1 flex-col">
          <CardTitle className="text-balance text-2xl font-bold">
            Your Personal Lifting AI Assistant
          </CardTitle>
          <CardDescription className="text-balance text-muted-foreground">
            Discussions are streamed to your device and not stored on our
            servers. Please leave{" "}
            <a
              href="https://strengthjourneys.canny.io/"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              feedback
            </a>{" "}
            about this AI.
          </CardDescription>
        </div>
        <FlickeringGridDemo />
      </CardHeader>
      <CardContent className="flex flex-col pb-0 align-middle">
        <div
          ref={scrollRef}
          className="mb-4 h-[30rem] overflow-auto scroll-smooth rounded-lg border border-border p-4 pb-0"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center space-x-1 overflow-auto text-center">
              <p className="mb-2 text-muted-foreground">
                Enter your questions into the chat box below (or click a sample
                question)
              </p>
              {defaultMessages.map((message, index) => (
                <p
                  key={index}
                  className="cursor-pointer italic text-muted-foreground"
                  // When user clicks one of the sample default messages, send it to the AI
                  onClick={() => {
                    append({
                      role: "user",
                      content: message,
                    });
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
                className={`mb-4 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <span
                  className={`inline-block max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  <MarkdownWithStyled>{message.content}</MarkdownWithStyled>
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

const MarkdownWithStyled = ({ children }) => (
  <ReactMarkdown
    components={{
      a: ({ node, ...props }) => (
        <a
          {...props}
          className="text-blue-500 underline hover:text-blue-700"
          target="_blank"
          rel="noopener noreferrer"
        />
      ),
    }}
  >
    {children}
  </ReactMarkdown>
);

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
