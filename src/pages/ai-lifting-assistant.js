"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { useChat } from "@ai-sdk/react";
import { devLog, getAnalyzedSessionLifts } from "@/lib/processing-utils";
import { RelatedArticles } from "@/components/article-cards";

import {
  ChatMessage,
  ChatMessageAvatar,
  ChatMessageContent,
} from "@/components/ui/chat-message";
import { ChatMessageArea } from "@/components/ui/chat-message-area";

import {
  ChatInput,
  ChatInputTextArea,
  ChatInputSubmit,
} from "@/components/ui/chat-input";

import { MarkdownContent } from "@/components/ui/markdown-content";

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
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { Bot, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import FlickeringGrid from "@/components/magicui/flickering-grid";
import { BioDetailsCard } from "@/components/ai-assistant/bio-details-card";
import { LiftingDataCard } from "@/components/ai-assistant/lifting-data-card";
import { processConsistency } from "@/components/analyzer/consistency-card";
import { useAthleteBioData } from "@/hooks/use-athlete-biodata";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "AI Lifting Assistant";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

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
  const {
    age,
    setAge,
    isMetric,
    sex,
    setSex,
    bodyWeight,
    setBodyWeight,
    standards,
    toggleIsMetric,
  } = useAthleteBioData();

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

  const [shareBioDetails, setShareBioDetails] = useLocalStorage(
    "SJ_ShareBioDetailsAI",
    false,
    { initializeWithValue: false },
  );

  let userProvidedProfileData = "";
  if (shareBioDetails) {
    userProvidedProfileData +=
      `Some background information: ` +
      `User is a ${age} year old ${sex}, weight is ${bodyWeight}${isMetric ? "kg" : "lb"}, ` +
      `User prefers ${isMetric ? "metric units" : "lb units"}, ` +
      `User height is ${height}cm, `;

    let standardsMetadata = "";

    Object.entries(standards).forEach(([lift, levels]) => {
      standardsMetadata += `For ${lift} the kg standards are:\n`;
      Object.entries(levels).forEach(([level, weight]) => {
        standardsMetadata += `- ${level.charAt(0).toUpperCase() + level.slice(1)}: ${weight}kg+\n`;
      });
      standardsMetadata += `\n`;
    });

    userProvidedProfileData +=
      "To help you assess user progress, here are the Lon Kilgore lifting standards interpolated for user age/sex/weight: ";

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
        userProvidedProfileData += `User best ever ${liftType} single was ${single.weight}${single.unitType} on ${single.date}, `;
      }
      const singleYear = topLiftsByTypeAndRepsLast12Months[liftType]?.[0]?.[0];
      if (singleYear !== undefined) {
        userProvidedProfileData += `User best ${liftType} single in the last 12 months was ${singleYear.weight}${singleYear.unitType} on ${singleYear.date}, `;
      }

      // FIXME: Tell the AI our best 3RM ever and last 12 months

      // Tell the AI our best 5RM ever and last 12 months
      const fiveRM = topLiftsByTypeAndReps[liftType]?.[4]?.[0];
      if (fiveRM !== undefined) {
        userProvidedProfileData += `User best ever ${liftType} 5RM was ${fiveRM.weight}${fiveRM.unitType} on ${fiveRM.date}, `;
      }
      const fiveRMYear = topLiftsByTypeAndRepsLast12Months[liftType]?.[4]?.[0];
      if (fiveRMYear !== undefined) {
        userProvidedProfileData += `User best ${liftType} 5RM in the last 12 months was ${fiveRMYear.weight}${fiveRMYear.unitType} on ${fiveRMYear.date}, `;
      }
    });
  }

  if (userLiftingMetadata.consistency && parsedData) {
    const consistency = processConsistency(parsedData);

    const formattedString = consistency?.map((item) => {
      const { label, percentage } = item;
      return `Consistency score over period of ${label}: ${percentage}% `;
    });

    userProvidedProfileData +=
      "Here is user consistency data - rated against an ideal of 3 sessions per week: " +
      formattedString.join(", ");
  }

  if (userLiftingMetadata.frequency) {
    const formattedString = slicedLiftTypes
      .map(
        ({ liftType, totalSets, totalReps, newestDate, oldestDate }) =>
          `${liftType}: ${totalSets} sets, ${totalReps} reps (from ${oldestDate} to ${newestDate})`,
      )
      .join("; ");

    userProvidedProfileData +=
      "Here are user frequency statistics for each lift type: " +
      formattedString +
      ", ";
  }

  // --------------------------------------------------------------------------------------------------
  // Add in recent session data to the AI prompt
  // --------------------------------------------------------------------------------------------------
  if (userLiftingMetadata.sessionData) {
    let sessionDate = null;
    // Iterate backwards to find the most recent non-goal entry date
    for (let i = parsedData?.length - 1; i >= 0; i--) {
      if (!parsedData[i].isGoal) {
        sessionDate = parsedData[i].date;
        break; // Stop as soon as we find the most recent non-goal entry
      }
    }

    const analyzedSessionLifts = getAnalyzedSessionLifts(
      sessionDate,
      parsedData,
      topLiftsByTypeAndReps,
      topLiftsByTypeAndRepsLast12Months,
    );

    const sessionData = convertAnalyzedLiftsToLLMStrings(analyzedSessionLifts);
    // devLog(sessionData);

    const today = new Date().toISOString().split("T")[0];

    userProvidedProfileData += `Background info: Here is my most recent session from Google Sheets, completed ${sessionDate} (today's day is: ${today}):`;
    userProvidedProfileData += sessionData.join(" ");
  }

  const unitType = isMetric ? "kg" : "lb";

  return (
    // <main className="mx-4 flex flex-col items-center md:mx-[5vw]">
    <div className="container">
      <PageHeader>
        <PageHeaderHeading icon={Bot}>AI Lifting Assistant</PageHeaderHeading>
        <PageHeaderDescription>
          Free AI Lifting Assistant. Talk to your lifting data. The gym buddy
          you never had.
        </PageHeaderDescription>
      </PageHeader>
      <div className="flex flex-col gap-2 md:gap-5 lg:flex-row">
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
  "Give me a riddle about lifting weights.",
];

// -----------------------------------------------------------------------------------------------------
// AILiftingAssistantCard - chatbot (full proprietary prompt lives in the server env variable)
// -----------------------------------------------------------------------------------------------------
function AILiftingAssistantCard({ userProvidedProfileData }) {
  const [followUpQuestions, setFollowUpQuestions] = useState([]); // New state for suggestions
  const {
    messages,
    setMessages,
    input,
    setInput,
    append,
    handleInputChange,
    handleSubmit,
    status,
    stop,
  } = useChat({
    body: { userProvidedMetadata: userProvidedProfileData }, // Share the user selected metadata with the AI temporarily
    onError: (error) => {
      console.error("(useChat() error: ", error);
    },
  });

  // Hydrate once on mount (client only)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("chat:/ai");
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, [setMessages]);

  // save whenever messages change
  useEffect(() => {
    if (typeof window === "undefined") return; // Ensure this runs only in the browser
    if (!Array.isArray(messages) || messages.length === 0) return; // Avoid saving empty messages on mount
    try {
      const capped = messages.slice(-20); // Cap to avoid AI bills
      sessionStorage.setItem("chat:/ai", JSON.stringify(capped));
    } catch {}
  }, [messages]);

  // devLog(messages);
  // devLog(followUpQuestions);

  const handleResetChat = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("chat:/ai");
    }
    setMessages([]);
  };

  const handleDownloadChat = () => {
    if (!messages || messages.length === 0) return;

    // Filter out internal 'suggestions' role
    const exportMessages = messages.filter((m) => m.role !== "suggestions");

    // Header and footer text
    const header = "=== StrengthJourneys.xyz AI Coach Output ===\n\n";
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const footer =
      `\n\n---\nGenerated at ${today}\n` +
      `Conversations are processed in your browser and are not stored on our servers.\n` +
      `https://strengthjourneys.xyz`;

    // Body text
    const body = exportMessages.map((m) => {
      const content =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return `${m.role.toUpperCase()}:\n${content}`;
    });

    // Build file content
    const fileText = [header, body.join("\n\n"), footer].join("");

    // Create and trigger download
    const blob = new Blob([fileText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "strengthjourneys.xyz_AI_coach_output.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="max-h-full bg-background text-foreground">
      <CardHeader className="flex flex-1 flex-col md:flex-row">
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
        {messages.length > 0 && (
          <div className="mr-4 flex items-start gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadChat}>
              Download chat
            </Button>
            <Button variant="destructive" size="sm" onClick={handleResetChat}>
              Reset chat
            </Button>
          </div>
        )}
        <div className="hidden md:block">
          <FlickeringGridDemo />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col pb-5 align-middle">
        <ChatMessageArea className="h-[55vh] pr-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
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
            // messages.map((message, index) => (
            messages
              .filter((msg) => msg.role !== "suggestions") // Skip suggestions in main chat
              .map((message, index) => (
                <ChatMessage
                  key={message.id}
                  id={message.id}
                  type={message.role === "user" ? "outgoing" : "incoming"}
                  variant="bubble"
                  className="pb-6"
                >
                  {message.role === "assistant" && (
                    <ChatMessageAvatar className="hidden md:flex" />
                  )}
                  <ChatMessageContent
                    content={message.content}
                    className="min-w-0 break-words"
                  />
                </ChatMessage>
              ))
          )}

          {/* Show spinner only while waiting, and hide it once an assistant message begins */}
          {(status === "submitted" || status === "streaming") && (
            <ChatMessage role="assistant">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                <span>Thinking…</span>
              </div>
            </ChatMessage>
          )}
        </ChatMessageArea>
      </CardContent>
      <CardFooter className="">
        <div className="flex-1 flex-col">
          <ChatInput
            variant="default"
            value={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            loading={status === "submitting" || status === "streaming"}
            onStop={stop}
          >
            <ChatInputTextArea placeholder="Type a message..." />
            <ChatInputSubmit />
          </ChatInput>
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

function convertAnalyzedLiftsToLLMStrings(analyzedLifts) {
  if (!analyzedLifts || Object.keys(analyzedLifts).length === 0) return [];

  const sessionDescriptions = [];

  Object.entries(analyzedLifts).forEach(([liftType, lifts]) => {
    lifts.forEach((lift, index) => {
      let description = `${liftType} set ${index + 1}: `;
      description += `${lift.reps} reps at ${lift.weight}${lift.unitType}. `;

      if (lift.notes) {
        description += `Notes: ${lift.notes}. `;
      }

      if (lift.lifetimeRanking !== -1) {
        // description += `This is a lifetime PR, ranked #${lift.lifetimeRanking + 1}. `;
        if (lift.lifetimeSignificanceAnnotation) {
          description += `${lift.lifetimeSignificanceAnnotation} (lifetime - very significant!). `;
        }
      }

      if (lift.yearlyRanking !== -1 && lift.yearlyRanking !== null) {
        // description += `This is a yearly PR, ranked #${lift.yearlyRanking + 1} for this year. `;
        if (lift.yearlySignificanceAnnotation) {
          description += `${lift.yearlySignificanceAnnotation}. (last year - encourage me) `;
        }
      }

      sessionDescriptions.push(description.trim());
    });
  });

  return sessionDescriptions;
}
