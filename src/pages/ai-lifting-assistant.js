
import { format } from "date-fns";
import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { useChat } from "@ai-sdk/react";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  devLog,
  getAnalyzedSessionLifts,
  getAverageLiftSessionTonnageFromPrecomputed,
  getAverageSessionTonnageFromPrecomputed,
  getSessionTonnagePercentileRangeFromPrecomputed,
} from "@/lib/processing-utils";
import { RelatedArticles } from "@/components/article-cards";
import { MiniFeedbackWidget } from "@/components/feedback";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Loader } from "@/components/ai-elements/loader";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";

import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

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
} from "@/components/page-header";

import { Button } from "@/components/ui/button";
import { useLocalStorage } from "usehooks-ts";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { Bot, CopyIcon, RefreshCcwIcon, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import FlickeringGrid from "@/components/magicui/flickering-grid";
import { BioDetailsCard } from "@/components/ai-assistant/bio-details-card";
import { LiftingDataCard } from "@/components/ai-assistant/lifting-data-card";
import { processConsistency } from "@/components/analyzer/consistency-card";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";

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

/**
 * AI Lifting Assistant page. Renders SEO metadata and delegates rendering to AILiftingAssistantMain.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles related to the AI Lifting Assistant topic, fetched via ISR.
 */
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

/**
 * Inner client component for the AI Lifting Assistant page. Assembles the user profile and lifting data
 * context strings and renders the chat card alongside bio and lifting data configuration panels.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles to display in the related articles section.
 */
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
  } = useAthleteBio();

  const [height, setHeight] = useLocalStorage(
    LOCAL_STORAGE_KEYS.ATHLETE_HEIGHT,
    170,
    {
      initializeWithValue: false,
    },
  ); // Default height in cm

  const [userLiftingMetadata, setUserLiftingMetaData] = useLocalStorage(
    LOCAL_STORAGE_KEYS.USER_LIFTING_METADATA,
    {
      all: false,
      records: false,
      trainingLoad: false,
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
    topTonnageByType,
    topTonnageByTypeLast12Months,
    sessionTonnageLookup,
  } = useUserLiftingData();

  const [shareBioDetails, setShareBioDetails] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHARE_BIO_DETAILS_AI,
    false,
    { initializeWithValue: false },
  );

  const userProvidedProfileData = useMemo(() => {
    const metadataSections = [];
    const recentSessionDate = getMostRecentSessionDate(parsedData);
    const prioritizedLifts = getPrioritizedLiftTypes({
      liftTypes,
      parsedData,
      topLiftsByTypeAndReps,
      limit: 6,
    });

    if (shareBioDetails) {
      const profileLines = [
        `age=${age}`,
        `sex=${sex}`,
        `bodyweight=${bodyWeight}${isMetric ? "kg" : "lb"}`,
        `height_cm=${height}`,
        `preferred_unit=${isMetric ? "kg" : "lb"}`,
      ];

      const standardsLines = Object.entries(standards)
        .slice(0, 4)
        .map(([lift, levels]) => {
          const compactLevels = Object.entries(levels)
            .map(([level, weightValue]) => `${level}=${weightValue}kg`)
            .join(" ");
          return `${lift}: ${compactLevels}`;
        });

      metadataSections.push(createMetadataSection("profile", profileLines));
      metadataSections.push(createMetadataSection("standards", standardsLines));
    }

    if (userLiftingMetadata.records && prioritizedLifts.length > 0) {
      const recordLines = prioritizedLifts
        .map((liftType) =>
          buildRecordsLine(
            liftType,
            topLiftsByTypeAndReps,
            topLiftsByTypeAndRepsLast12Months,
          ),
        )
        .filter(Boolean);

      if (recordLines.length > 0) {
        metadataSections.push(createMetadataSection("records", recordLines));
      }
    }

    if (
      userLiftingMetadata.trainingLoad &&
      prioritizedLifts.length > 0 &&
      sessionTonnageLookup
    ) {
      const trainingLoadLines = buildTrainingLoadLines({
        prioritizedLifts,
        recentSessionDate,
        topTonnageByType,
        topTonnageByTypeLast12Months,
        sessionTonnageLookup,
      });

      if (trainingLoadLines.length > 0) {
        metadataSections.push(
          createMetadataSection("training_load", trainingLoadLines),
        );
      }
    }

    if (userLiftingMetadata.frequency && prioritizedLifts.length > 0) {
      const frequencyLines = liftTypes
        .filter(({ liftType }) => prioritizedLifts.includes(liftType))
        .map(
          ({ liftType, totalSets, totalReps, newestDate, oldestDate }) =>
            `${liftType}: sets=${totalSets} reps=${totalReps} span=${oldestDate}..${newestDate}`,
        );

      if (frequencyLines.length > 0) {
        metadataSections.push(
          createMetadataSection("frequency", frequencyLines),
        );
      }
    }

    if (userLiftingMetadata.consistency && parsedData) {
      const consistency = processConsistency(parsedData) ?? [];
      const consistencyLines = consistency.map(
        ({ label, percentage }) => `${label}=${percentage}%`,
      );

      if (consistencyLines.length > 0) {
        metadataSections.push(
          createMetadataSection("consistency", consistencyLines),
        );
      }
    }

    if (
      userLiftingMetadata.sessionData &&
      recentSessionDate &&
      topLiftsByTypeAndReps &&
      topLiftsByTypeAndRepsLast12Months
    ) {
      const analyzedSessionLifts = getAnalyzedSessionLifts(
        recentSessionDate,
        parsedData,
        topLiftsByTypeAndReps,
        topLiftsByTypeAndRepsLast12Months,
      );

      const sessionLines = buildRecentSessionLines(
        recentSessionDate,
        analyzedSessionLifts,
      );

      if (sessionLines.length > 0) {
        metadataSections.push(
          createMetadataSection("recent_session", sessionLines),
        );
      }
    }

    return combineMetadataSections(metadataSections);
  }, [
    age,
    bodyWeight,
    height,
    isMetric,
    liftTypes,
    parsedData,
    sessionTonnageLookup,
    sex,
    shareBioDetails,
    standards,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    topTonnageByType,
    topTonnageByTypeLast12Months,
    userLiftingMetadata,
  ]);

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={Bot}>AI Lifting Assistant</PageHeaderHeading>
        <PageHeaderDescription>
          Free AI Lifting Assistant. Talk to your lifting data. The gym buddy
          you never had.
        </PageHeaderDescription>
      </PageHeader>
      <div className="flex flex-col gap-2 md:gap-5 lg:flex-row">
        <div className="h-dvh flex-1 lg:flex lg:flex-col 2xl:max-w-screen-xl">
          <AILiftingAssistantCard
            userProvidedProfileData={userProvidedProfileData}
          />
        </div>
        <div className="flex flex-col gap-5 md:max-w-3/5">
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
    </PageContainer>
  );
}

// Single flat array of suggestions
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

/**
 * Icon button that copies the provided text to the clipboard and shows a checkmark tick for 2 seconds
 * as visual confirmation of the copy action.
 * @param {Object} props
 * @param {string} props.text - The text content to copy to the clipboard.
 */
function CopyButton({ text, ...props }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  return (
    <MessageAction
      onClick={handleCopy}
      label="Copy"
      tooltip={copied ? "Copied!" : "Copy"}
      {...props}
    >
      {copied ? (
        <CheckIcon className="size-3" />
      ) : (
        <CopyIcon className="size-3" />
      )}
    </MessageAction>
  );
}

/**
 * Chat card that drives the AI lifting assistant conversation. Handles message streaming via the
 * Vercel AI SDK, persists the session to sessionStorage, and supports download and reset actions.
 * @param {Object} props
 * @param {string} props.userProvidedProfileData - Serialised string of user bio and lifting metadata
 *   to inject into the AI system prompt via the request body on each message send.
 */
function AILiftingAssistantCard({ userProvidedProfileData }) {
  const { messages, setMessages, sendMessage, status, stop, regenerate } =
    useChat({
      api: "/api/chat", // Explicitly set the pages router endpoint
      onError: (error) => {
        console.error("(useChat() error: ", error);
      },
    });

  // Helper to send messages with fresh metadata (per AI SDK v6 docs for ChatRequestOptions.body)
  const sendMessageWithMetadata = (message) => {
    sendMessage(typeof message === "string" ? { text: message } : message, {
      body: {
        userProvidedMetadata: userProvidedProfileData,
      },
    });
  };

  // Handle submit from PromptInput (receives message object with text)
  const handleSubmit = (message) => {
    const hasText = Boolean(message.text && message.text.trim());

    if (!hasText) {
      return;
    }

    sendMessageWithMetadata(message.text);
  };

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
    const today = format(new Date(), "yyyy-MM-dd"); // Local date, not UTC

    const footer =
      `\n\n---\nGenerated at ${today}\n` +
      `Conversations are processed in your browser and are not stored on our servers.\n` +
      `https://www.strengthjourneys.xyz`;

    // Body text - handle AI SDK v6 parts format
    const body = exportMessages.map((m) => {
      let content = "";

      // Handle AI SDK v6 parts format
      if (m.parts && Array.isArray(m.parts)) {
        // Extract text from parts array
        const textParts = m.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text);
        content = textParts.join("");
      } else if (typeof m.content === "string") {
        // Legacy format fallback
        content = m.content;
      } else if (m.content) {
        // Fallback for other content types
        content = JSON.stringify(m.content);
      }

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
    <Card className="bg-background text-foreground max-h-full">
      <CardHeader className="flex flex-1 flex-col md:flex-row">
        <div className="flex flex-1 flex-col">
          <CardTitle className="text-2xl font-bold text-balance">
            Your Personal Lifting AI Assistant
          </CardTitle>
          <CardDescription className="text-muted-foreground text-balance">
            Discussions are streamed to your device and not stored on our
            servers.
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
      <CardContent className="flex h-[55vh] flex-col overflow-y-auto pb-5 align-middle">
        <Conversation className="overflow-x-visible overflow-y-hidden">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                title="No messages yet"
                description="Enter your questions into the chat box below (or click a sample question)"
                className="items-start px-0"
              >
                <div className="-mx-4 mt-6 w-full px-4">
                  <Suggestions className="w-full">
                    {defaultMessages.map((message) => (
                      <Suggestion
                        key={message}
                        suggestion={message}
                        onClick={(suggestion) => {
                          sendMessageWithMetadata(suggestion);
                        }}
                      />
                    ))}
                  </Suggestions>
                </div>
              </ConversationEmptyState>
            ) : (
              <>
                {messages
                  .filter((msg) => msg.role !== "suggestions") // Skip suggestions in main chat
                  .map((message) => {
                    // Handle AI SDK v6 parts format
                    const parts = message.parts || [];
                    const isLastMessage =
                      message.id === messages[messages.length - 1]?.id;

                    // Show sources if there are any source-url parts
                    const hasSources = parts.some(
                      (part) => part.type === "source-url",
                    );

                    // Get text content for actions (last text part or fallback to content)
                    const lastTextPart = parts
                      .filter((p) => p.type === "text")
                      .pop();
                    const textContent =
                      lastTextPart?.text ||
                      (typeof message.content === "string"
                        ? message.content
                        : null);

                    return (
                      <div key={message.id}>
                        {message.role === "assistant" && hasSources && (
                          <Sources>
                            <SourcesTrigger
                              count={
                                parts.filter(
                                  (part) => part.type === "source-url",
                                ).length
                              }
                            />
                            {parts
                              .filter((part) => part.type === "source-url")
                              .map((part, i) => (
                                <SourcesContent
                                  key={`${message.id}-source-${i}`}
                                >
                                  <Source href={part.url} title={part.url} />
                                </SourcesContent>
                              ))}
                          </Sources>
                        )}
                        <Message from={message.role}>
                          <MessageContent>
                            {parts.length > 0 ? (
                              parts
                                .filter((part) => part.type === "text")
                                .map((part, i) => (
                                  <MessageResponse key={`${message.id}-${i}`}>
                                    {part.text}
                                  </MessageResponse>
                                ))
                            ) : message.content ? (
                              <MessageResponse>
                                {typeof message.content === "string"
                                  ? message.content
                                  : JSON.stringify(message.content)}
                              </MessageResponse>
                            ) : null}
                          </MessageContent>
                          {message.role === "assistant" &&
                            isLastMessage &&
                            textContent && (
                              <MessageActions>
                                <MessageAction
                                  onClick={() => regenerate()}
                                  label="Retry"
                                >
                                  <RefreshCcwIcon className="size-3" />
                                </MessageAction>
                                <CopyButton text={textContent} />
                              </MessageActions>
                            )}
                        </Message>
                      </div>
                    );
                  })}

                {/* Show loader only while waiting */}
                {status === "submitted" && <Loader />}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </CardContent>
      <CardFooter>
        <div className="flex w-full flex-col gap-3">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Type a message..." />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
          <MiniFeedbackWidget
            prompt="Useful assistant?"
            contextId="ai_lifting_assistant_card"
            page="/ai-lifting-assistant"
            analyticsExtra={{ context: "ai_lifting_assistant_card" }}
          />
        </div>
      </CardFooter>
    </Card>
  );
}

// Decorative flickering grid animation shown in the chat card header on desktop.
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

function createMetadataSection(title, lines) {
  const filteredLines = (lines ?? []).filter(Boolean).slice(0, 8);
  if (filteredLines.length === 0) return "";
  return [`[${title}]`, ...filteredLines].join("\n");
}

function combineMetadataSections(sections, maxChars = 4500) {
  const filteredSections = (sections ?? []).filter(Boolean);
  const prioritizedSections = [];
  const deferredSections = [];

  filteredSections.forEach((section) => {
    if (section.startsWith("[standards]")) {
      deferredSections.push(section);
      return;
    }
    prioritizedSections.push(section);
  });

  const orderedSections = [...prioritizedSections, ...deferredSections];
  const includedSections = [];
  let currentLength = 0;

  orderedSections.forEach((section) => {
    const separatorLength = includedSections.length > 0 ? 2 : 0;
    if (currentLength + separatorLength + section.length > maxChars) return;
    includedSections.push(section);
    currentLength += separatorLength + section.length;
  });

  return includedSections.join("\n\n");
}

function getMostRecentSessionDate(parsedData) {
  for (let i = (parsedData?.length ?? 0) - 1; i >= 0; i -= 1) {
    if (!parsedData[i].isGoal) {
      return parsedData[i].date;
    }
  }

  return null;
}

function getPrioritizedLiftTypes({
  liftTypes,
  parsedData,
  topLiftsByTypeAndReps,
  limit = 6,
}) {
  const prioritized = [];
  const seen = new Set();
  const recentSessionDate = getMostRecentSessionDate(parsedData);

  if (recentSessionDate && parsedData) {
    parsedData.forEach((entry) => {
      if (entry.date !== recentSessionDate || entry.isGoal || !entry.liftType) {
        return;
      }
      if (seen.has(entry.liftType)) return;
      seen.add(entry.liftType);
      prioritized.push(entry.liftType);
    });
  }

  ["Back Squat", "Bench Press", "Deadlift", "Overhead Press"].forEach(
    (liftType) => {
      if (seen.has(liftType)) return;
      if (!topLiftsByTypeAndReps?.[liftType]) return;
      seen.add(liftType);
      prioritized.push(liftType);
    },
  );

  liftTypes.forEach(({ liftType }) => {
    if (seen.has(liftType)) return;
    seen.add(liftType);
    prioritized.push(liftType);
  });

  return prioritized.slice(0, limit);
}

function formatLiftRecord(metricName, lift) {
  if (!lift) return null;
  return `${metricName}=${lift.weight}${lift.unitType}@${lift.date}`;
}

function buildRecordsLine(
  liftType,
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
) {
  const allTime = topLiftsByTypeAndReps?.[liftType];
  const lastYear = topLiftsByTypeAndRepsLast12Months?.[liftType];

  if (!allTime && !lastYear) return null;

  const parts = [
    formatLiftRecord("single_all", allTime?.[0]?.[0]),
    formatLiftRecord("single_12m", lastYear?.[0]?.[0]),
    formatLiftRecord("3rm_all", allTime?.[2]?.[0]),
    formatLiftRecord("3rm_12m", lastYear?.[2]?.[0]),
    formatLiftRecord("5rm_all", allTime?.[4]?.[0]),
    formatLiftRecord("5rm_12m", lastYear?.[4]?.[0]),
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return `${liftType}: ${parts.join(" | ")}`;
}

function formatRoundedStat(value, unitType) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${Math.round(value)}${unitType}`;
}

function buildTrainingLoadLines({
  prioritizedLifts,
  recentSessionDate,
  topTonnageByType,
  topTonnageByTypeLast12Months,
  sessionTonnageLookup,
}) {
  const lines = [];
  const {
    sessionTonnageByDate,
    sessionTonnageByDateAndLift,
    allSessionDates,
    lastDateByLiftType,
  } = sessionTonnageLookup;

  const recentTotals = sessionTonnageByDate?.[recentSessionDate] ?? {};
  const recentUnitEntries = Object.entries(recentTotals).slice(0, 2);

  recentUnitEntries.forEach(([unitType, tonnage]) => {
    const average = getAverageSessionTonnageFromPrecomputed(
      sessionTonnageByDate,
      allSessionDates,
      recentSessionDate,
      unitType,
    );
    const percentileRange = getSessionTonnagePercentileRangeFromPrecomputed(
      sessionTonnageByDate,
      allSessionDates,
      recentSessionDate,
      unitType,
    );

    const summaryParts = [
      `recent_session=${formatRoundedStat(tonnage, unitType)}@${recentSessionDate}`,
      average.average > 0
        ? `avg_12m=${formatRoundedStat(average.average, unitType)}`
        : null,
      percentileRange.sessionCount > 0
        ? `typical_12m=${formatRoundedStat(percentileRange.low, unitType)}-${formatRoundedStat(percentileRange.high, unitType)}`
        : null,
    ].filter(Boolean);

    if (summaryParts.length > 0) {
      lines.push(`all_lifts_${unitType}: ${summaryParts.join(" | ")}`);
    }
  });

  prioritizedLifts.forEach((liftType) => {
    const topAll = topTonnageByType?.[liftType]?.[0];
    const topYear = topTonnageByTypeLast12Months?.[liftType]?.[0];
    const recentLiftUnits =
      sessionTonnageByDateAndLift?.[recentSessionDate]?.[liftType] ?? {};
    const unitType =
      topYear?.unitType || topAll?.unitType || Object.keys(recentLiftUnits)[0];

    const average =
      unitType && recentSessionDate
        ? getAverageLiftSessionTonnageFromPrecomputed(
            sessionTonnageByDateAndLift,
            allSessionDates,
            recentSessionDate,
            liftType,
            unitType,
          )
        : { average: 0 };

    const recentLiftTonnage = unitType ? recentLiftUnits[unitType] : null;
    const daysSinceLastTrained = getDaysBetweenDates(
      lastDateByLiftType?.[liftType],
      recentSessionDate,
    );

    const parts = [
      topAll
        ? `top_all=${formatRoundedStat(topAll.tonnage, topAll.unitType)}@${topAll.date}`
        : null,
      topYear
        ? `top_12m=${formatRoundedStat(topYear.tonnage, topYear.unitType)}@${topYear.date}`
        : null,
      recentLiftTonnage
        ? `recent_session=${formatRoundedStat(recentLiftTonnage, unitType)}`
        : null,
      average.average > 0
        ? `avg_12m=${formatRoundedStat(average.average, unitType)}`
        : null,
      daysSinceLastTrained !== null
        ? `days_since_trained=${daysSinceLastTrained}`
        : null,
    ].filter(Boolean);

    if (parts.length > 0) {
      lines.push(`${liftType}: ${parts.join(" | ")}`);
    }
  });

  return lines.slice(0, 8);
}

function buildRecentSessionLines(sessionDate, analyzedLifts) {
  if (!analyzedLifts || Object.keys(analyzedLifts).length === 0) return [];

  const lines = [`date=${sessionDate}`];

  Object.entries(analyzedLifts)
    .slice(0, 6)
    .forEach(([liftType, lifts]) => {
      const setSummary = lifts
        .slice(0, 4)
        .map((lift) => {
          const tags = [];
          if (lift.lifetimeSignificanceAnnotation) tags.push("lifetime_pr");
          if (lift.yearlySignificanceAnnotation) tags.push("year_pr");
          const tagSuffix = tags.length > 0 ? ` [${tags.join(",")}]` : "";
          return `${lift.reps}x${lift.weight}${lift.unitType}${tagSuffix}`;
        })
        .join("; ");

      lines.push(`${liftType}: ${setSummary}`);
    });

  return lines;
}

function getDaysBetweenDates(olderDate, newerDate) {
  if (!olderDate || !newerDate) return null;
  const diffMs = new Date(newerDate) - new Date(olderDate);
  if (!Number.isFinite(diffMs)) return null;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

// -----------------------------------------------------------------------------------------------------
// Helper functions for AI SDK v6 message parts handling
// Following AI SDK v6 patterns: messages always have a parts array
// -----------------------------------------------------------------------------------------------------

/**
 * Extract text content from message parts (AI SDK v6)
 * In v6, messages use parts array - this combines all text parts into a single string
 * @param {Object} message - The message object from useChat
 * @returns {string} Combined text content from all text parts
 */
function getMessageText(message) {
  if (!message.parts) return "";
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
