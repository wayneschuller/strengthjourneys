/**
 * AI Lifting Assistant page. Builds an opt-in, compact lifting-context prompt
 * from local user data and streams model responses through the chat API.
 */
import { format } from "date-fns";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useSession } from "next-auth/react";
import { useChat } from "@ai-sdk/react";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  AI_REVIEW_PROMPTS,
  clearAiAssistantPrompt,
  readAiAssistantPrompt,
} from "@/lib/ai-review-prompts";
import {
  AI_CHAT_ANON_WARN_AT_REMAINING,
  AI_CHAT_AUTH_WARN_AT_REMAINING,
  parseAiChatQuotaFromHeaders,
} from "@/lib/ai-chat-quota";
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
  PromptInputTools,
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
import {
  Bot,
  CopyIcon,
  RefreshCcwIcon,
  CheckIcon,
  DownloadIcon,
  RotateCcwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BioDetailsCard } from "@/components/ai-assistant/bio-details-card";
import { LiftingDataCard } from "@/components/ai-assistant/lifting-data-card";
import {
  ChatQuotaLimitNotice,
  ChatQuotaMeter,
} from "@/components/ai-assistant/chat-quota-meter";
import {
  CoachContextStrip,
  CoachEmptyState,
  LoadedBarStripe,
  NextWorkLabel,
  getCoachPlaceholder,
} from "@/components/ai-assistant/coach-chat-ui";
import { processConsistency } from "@/lib/consistency";
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
    isDemoMode,
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
  const hasSharedTrainingData = hasAnySharedTrainingData(userLiftingMetadata);
  const hasSharedFullTrainingData = hasAllSharedTrainingData(userLiftingMetadata);
  const suggestionContext = useMemo(() => {
    const prioritizedLifts = hasSharedTrainingData
      ? getPrioritizedLiftTypes({
          liftTypes,
          parsedData,
          topLiftsByTypeAndReps,
          limit: 2,
        })
      : [];

    return {
      age: shareBioDetails ? age : null,
      primaryLift: prioritizedLifts[0] ?? null,
      secondaryLift: prioritizedLifts[1] ?? null,
      recentSessionDate: hasSharedTrainingData
        ? getMostRecentSessionDate(parsedData)
        : null,
    };
  }, [
    age,
    hasSharedTrainingData,
    liftTypes,
    parsedData,
    shareBioDetails,
    topLiftsByTypeAndReps,
  ]);

  const userProvidedProfileData = useMemo(() => {
    if (isDemoMode) return "";
    const metadataSections = [];
    const recentSessionDate = getMostRecentSessionDate(parsedData);
    const prioritizedLifts = getPrioritizedLiftTypes({
      liftTypes,
      parsedData,
      topLiftsByTypeAndReps,
      limit: 6,
    });
    const sharedSections = getSharedMetadataSections({
      shareBioDetails,
      userLiftingMetadata,
    });

    if (sharedSections.length > 0) {
      metadataSections.push(
        createMetadataSection("data_context", [
          `shared_sections=${sharedSections.join(",")}`,
          recentSessionDate ? `latest_session=${recentSessionDate}` : null,
          `selected_lifts=${prioritizedLifts.join(",") || "none"}`,
          "missing_sections=not_shared_or_unavailable",
        ]),
      );
    }

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
      const consistencyLines = consistency.map(formatConsistencyLine);

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

      const {
        recentBlockLines,
        latestDetailLines,
      } = buildRecentSessionWindowSections({
        parsedData,
        recentSessionDate,
        analyzedSessionLifts,
      });

      if (recentBlockLines.length > 0) {
        metadataSections.push(
          createMetadataSection("recent_sessions", recentBlockLines),
        );
      }

      if (latestDetailLines.length > 0) {
        metadataSections.push(
          createMetadataSection("latest_session_detail", latestDetailLines),
        );
      }
    }

    return combineMetadataSections(metadataSections);
  }, [
    age,
    bodyWeight,
    height,
    isDemoMode,
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
      <PageHeader className="pb-3 md:pb-5">
        <PageHeaderHeading icon={Bot}>AI Lifting Assistant</PageHeaderHeading>
        <PageHeaderDescription>
          The gym buddy who actually read your log. Private by default — you
          choose what the coach can see.
        </PageHeaderDescription>
      </PageHeader>

      {/*
        Chat workspace: primary column fills remaining viewport height;
        settings rail is fixed-width and sticky on desktop, stacked below on mobile.
        Keeps the shared PageContainer + PageHeader shell used by other top-level pages.
      */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1">
          <AILiftingAssistantCard
            hasSharedBioData={!isDemoMode && shareBioDetails}
            hasSharedFullTrainingData={!isDemoMode && hasSharedFullTrainingData}
            hasSharedTrainingData={!isDemoMode && hasSharedTrainingData}
            suggestionContext={suggestionContext}
            userProvidedProfileData={userProvidedProfileData}
          />
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3 lg:sticky lg:top-20 lg:w-80 lg:self-start xl:w-[22rem]">
          <div className="px-0.5">
            <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
              Feed the coach
            </p>
            <p className="text-muted-foreground/80 mt-0.5 text-xs text-pretty">
              Opt in to bio and log sections. Nothing leaves your browser except
              the summaries you enable.
            </p>
          </div>
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
        </aside>
      </div>

      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}

const BIO_DATA_FALLBACK_PROMPTS = [
  "How much protein should I eat?",
  "Should I lift every day?",
  "Can I lift weights and still lose weight?",
];

const GENERAL_LIFTING_PROMPTS = [
  "Why lift weights?",
  "What should I do in my first gym session?",
  "How often should I deadlift?",
  "I'm female, will I get bulky lifting weights?",
  "How do I choose a gym?",
  "Isn't deadlifting dangerous?",
  "What are the health benefits for women who lift?",
];

const PLAYFUL_PROMPTS = [
  "Write me a motivational rap.",
  "ME STRONG",
  "Give me a riddle about lifting weights.",
];

function getAssistantSuggestions({
  dateKey,
  hasSharedBioData,
  hasSharedFullTrainingData,
  hasSharedTrainingData,
  suggestionContext,
}) {
  const trainingPrompts = buildTrainingDataPrompts({
    hasSharedBioData,
    suggestionContext,
  });
  const partialTrainingPrompts = buildPartialTrainingDataPrompts({
    hasSharedBioData,
    suggestionContext,
  });
  const bioPrompts = buildBioDataPrompts(suggestionContext);

  if (hasSharedFullTrainingData) {
    return uniqueMessages([
      ...trainingPrompts,
      ...(hasSharedBioData ? bioPrompts.slice(0, 2) : []),
      ...getRotatedPrompts(GENERAL_LIFTING_PROMPTS, dateKey, 1),
      ...getRotatedPrompts(PLAYFUL_PROMPTS, dateKey, 1),
    ]);
  }

  if (hasSharedTrainingData) {
    return uniqueMessages([
      ...partialTrainingPrompts,
      ...(hasSharedBioData ? bioPrompts.slice(0, 2) : []),
      ...getRotatedPrompts(GENERAL_LIFTING_PROMPTS, dateKey, 3),
    ]);
  }

  if (hasSharedBioData) {
    return uniqueMessages([
      ...bioPrompts,
      ...getRotatedPrompts(GENERAL_LIFTING_PROMPTS, dateKey, 4),
      ...getRotatedPrompts(PLAYFUL_PROMPTS, dateKey, 1),
    ]);
  }

  return uniqueMessages([
    ...GENERAL_LIFTING_PROMPTS,
    ...BIO_DATA_FALLBACK_PROMPTS,
    ...PLAYFUL_PROMPTS,
  ]);
}

function buildTrainingDataPrompts({ hasSharedBioData, suggestionContext }) {
  const { primaryLift, recentSessionDate } = suggestionContext ?? {};

  return [
    AI_REVIEW_PROMPTS.week,
    AI_REVIEW_PROMPTS.month,
    recentSessionDate
      ? `Review my latest session from ${recentSessionDate}`
      : "Review my latest session",
    primaryLift
      ? `What should I focus on next for ${primaryLift}?`
      : "What lift should I focus on next?",
    "Where is my training inconsistent?",
    hasSharedBioData ? "How strong am I for my age?" : "How strong am I?",
  ];
}

function buildPartialTrainingDataPrompts({
  hasSharedBioData,
  suggestionContext,
}) {
  const { primaryLift, secondaryLift } = suggestionContext ?? {};
  const liftFocus = primaryLift
    ? `What does my ${primaryLift} data suggest?`
    : "What does my shared training data suggest?";
  const comparisonPrompt =
    primaryLift && secondaryLift
      ? `Compare my ${primaryLift} and ${secondaryLift} progress`
      : "What should I focus on next from my shared data?";

  return [
    "Review the training data I've shared",
    liftFocus,
    comparisonPrompt,
    hasSharedBioData ? "How strong am I for my age?" : "How strong am I?",
  ];
}

function buildBioDataPrompts(suggestionContext) {
  const age = Number(suggestionContext?.age);
  const ageSuffix = Number.isFinite(age) && age > 0 ? ` at ${age}` : "";

  return [
    `Why does strength training matter${ageSuffix}?`,
    `How should recovery change${ageSuffix}?`,
    "How much protein should I eat?",
    "Should I lift every day?",
    "Can I lift weights and still lose weight?",
  ];
}

function hasAnySharedTrainingData(userLiftingMetadata) {
  return Boolean(
    userLiftingMetadata?.all ||
      userLiftingMetadata?.records ||
      userLiftingMetadata?.trainingLoad ||
      userLiftingMetadata?.frequency ||
      userLiftingMetadata?.consistency ||
      userLiftingMetadata?.sessionData,
  );
}

function hasAllSharedTrainingData(userLiftingMetadata) {
  if (userLiftingMetadata?.all) return true;

  return Boolean(
    userLiftingMetadata?.records &&
      userLiftingMetadata?.trainingLoad &&
      userLiftingMetadata?.frequency &&
      userLiftingMetadata?.consistency &&
      userLiftingMetadata?.sessionData,
  );
}

function getSharedMetadataSections({ shareBioDetails, userLiftingMetadata }) {
  const sections = [];

  if (shareBioDetails) {
    sections.push("profile", "standards");
  }

  if (userLiftingMetadata?.records) sections.push("records");
  if (userLiftingMetadata?.trainingLoad) sections.push("training_load");
  if (userLiftingMetadata?.frequency) sections.push("frequency");
  if (userLiftingMetadata?.consistency) sections.push("consistency");
  if (userLiftingMetadata?.sessionData) {
    sections.push("recent_sessions", "latest_session_detail");
  }

  return sections;
}

function getRotatedPrompts(prompts, dateKey, count) {
  if (!Array.isArray(prompts) || prompts.length === 0 || count <= 0) {
    return [];
  }

  const offset = getStablePromptOffset(dateKey, prompts.length);
  return Array.from({ length: Math.min(count, prompts.length) }, (_, index) => {
    const promptIndex = (offset + index) % prompts.length;
    return prompts[promptIndex];
  });
}

function getStablePromptOffset(value, modulo) {
  if (!value || modulo <= 0) return 0;

  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % modulo;
  }

  return hash;
}

function uniqueMessages(messages) {
  return [...new Set(messages.filter(Boolean))];
}

function XAILogo({ className }) {
  return (
    <svg
      viewBox="0 0 841.89 595.28"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <polygon points="557.09,211.99 565.4,538.36 631.96,538.36 640.28,93.18" />
      <polygon points="640.28,56.91 538.72,56.91 379.35,284.53 430.13,357.05" />
      <polygon points="201.61,538.36 303.17,538.36 353.96,465.84 303.17,393.31" />
      <polygon points="201.61,211.99 430.13,538.36 531.69,538.36 303.17,211.99" />
    </svg>
  );
}

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
 * @param {boolean} props.hasSharedBioData - Whether the user has opted to share bio details.
 * @param {boolean} props.hasSharedFullTrainingData - Whether the user has opted to share every lifting metadata section.
 * @param {boolean} props.hasSharedTrainingData - Whether the user has opted to share any lifting metadata.
 * @param {Object} props.suggestionContext - Small prompt-personalisation context derived from opted-in local data.
 * @param {string} props.userProvidedProfileData - Serialised string of user bio and lifting
 *   metadata to inject into the AI system prompt via the request body on each message send.
 */
function AILiftingAssistantCard({
  hasSharedBioData,
  hasSharedFullTrainingData,
  hasSharedTrainingData,
  suggestionContext,
  userProvidedProfileData,
}) {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const [chatQuota, setChatQuota] = useState(null);
  const [isChatQuotaReady, setIsChatQuotaReady] = useState(false);
  const [isChatHydrated, setIsChatHydrated] = useState(false);
  const [suggestionDateKey] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const suggestionRotationKey = [
    suggestionDateKey,
    hasSharedBioData ? "bio" : "no-bio",
    hasSharedTrainingData ? "training" : "no-training",
    hasSharedFullTrainingData ? "full-training" : "partial-training",
  ].join("|");
  const pendingAiPromptRef = useRef(null);
  const pendingAiPromptKeyRef = useRef(null);
  const consumedAiPromptRef = useRef(null);
  const suggestedMessages = useMemo(
    () =>
      getAssistantSuggestions({
        dateKey: suggestionRotationKey,
        hasSharedBioData,
        hasSharedFullTrainingData,
        hasSharedTrainingData,
        suggestionContext,
      }),
    [
      hasSharedBioData,
      hasSharedFullTrainingData,
      hasSharedTrainingData,
      suggestionRotationKey,
      suggestionContext,
    ],
  );

  const applyQuotaSnapshot = useCallback((nextQuota, options = {}) => {
    if (!nextQuota) return;

    setChatQuota((previousQuota) => {
      if (
        !options.allowRollback &&
        previousQuota?.tier === nextQuota.tier &&
        Number(nextQuota.used) < Number(previousQuota.used)
      ) {
        return previousQuota;
      }

      return nextQuota;
    });
    setIsChatQuotaReady(true);
  }, []);

  const reserveQuotaLocally = useCallback(() => {
    setChatQuota((previousQuota) => {
      if (!previousQuota || previousQuota.blocked) return previousQuota;

      const used = Math.min(previousQuota.limit, previousQuota.used + 1);
      const remaining = Math.max(0, previousQuota.limit - used);
      const warnAtRemaining =
        previousQuota.tier === "anonymous"
          ? AI_CHAT_ANON_WARN_AT_REMAINING
          : AI_CHAT_AUTH_WARN_AT_REMAINING;

      return {
        ...previousQuota,
        used,
        remaining,
        warn: previousQuota.warn || remaining <= warnAtRemaining,
        blocked: remaining <= 0,
        code:
          remaining <= 0
            ? previousQuota.tier === "anonymous"
              ? "SIGN_IN_REQUIRED"
              : "DAILY_LIMIT_REACHED"
            : previousQuota.code,
      };
    });
  }, []);

  const loadChatQuota = useCallback(async (options = {}) => {
    try {
      const response = await fetch("/api/chat/quota");
      if (!response.ok) return;
      const data = await response.json();
      applyQuotaSnapshot(data, options);
    } catch (error) {
      devLog("Failed to load AI chat quota", error);
    }
  }, [applyQuotaSnapshot]);

  const chatFetch = useCallback(
    async (input, init) => {
      const response = await fetch(input, init);
      const headerQuota = parseAiChatQuotaFromHeaders(response.headers);

      if (headerQuota) {
        applyQuotaSnapshot(headerQuota);
      } else if (!response.ok && response.status === 403) {
        try {
          const data = await response.clone().json();
          if (data?.tier) {
            applyQuotaSnapshot(data);
          }
        } catch {
          // Ignore malformed quota error payloads.
        }
      }

      return response;
    },
    [applyQuotaSnapshot],
  );

  useEffect(() => {
    if (authStatus === "loading") return undefined;

    let cancelled = false;
    setIsChatQuotaReady(false);

    (async () => {
      try {
        const response = await fetch("/api/chat/quota");
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (!cancelled) {
          applyQuotaSnapshot(data);
        }
      } catch (error) {
        devLog("Failed to load AI chat quota", error);
      } finally {
        if (!cancelled) {
          setIsChatQuotaReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, applyQuotaSnapshot]);

  const isChatBlocked = Boolean(chatQuota?.blocked);
  const isChatUnavailable = !isChatQuotaReady || isChatBlocked;
  const isAnonymousQuotaBlocked =
    isChatBlocked && chatQuota?.tier === "anonymous";
  const aiPromptQuery = router.query?.aiPrompt;
  const aiPromptKeyQuery = router.query?.aiPromptKey;
  const shouldResetChatForPrompt = router.query?.resetChat === "1";
  const legacyQueryPrompt =
    typeof aiPromptQuery === "string" ? aiPromptQuery.trim() : "";
  const queryPromptKey =
    typeof aiPromptKeyQuery === "string" ? aiPromptKeyQuery.trim() : "";

  const { messages, setMessages, sendMessage, status, stop, regenerate } =
    useChat({
      api: "/api/chat",
      fetch: chatFetch,
      onError: (error) => {
        console.error("(useChat() error: ", error);
        loadChatQuota({ allowRollback: true });
      },
    });
  const chatRequestBody = useMemo(
    () => ({
      userProvidedMetadata: userProvidedProfileData,
    }),
    [userProvidedProfileData],
  );
  const clearPromptQueryParams = useCallback(() => {
    if (!router.isReady) return;
    if (
      !("aiPrompt" in router.query) &&
      !("aiPromptKey" in router.query) &&
      !("resetChat" in router.query)
    ) {
      return;
    }

    const nextQuery = { ...router.query };
    delete nextQuery.aiPrompt;
    delete nextQuery.aiPromptKey;
    delete nextQuery.resetChat;

    router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true },
    );
  }, [router]);

  // Helper to send messages with fresh metadata (per AI SDK v6 docs for ChatRequestOptions.body)
  const sendMessageWithMetadata = useCallback((message) => {
    if (isChatUnavailable) return;

    reserveQuotaLocally();
    sendMessage(typeof message === "string" ? { text: message } : message, {
      body: chatRequestBody,
    });
  }, [
    chatRequestBody,
    isChatUnavailable,
    reserveQuotaLocally,
    sendMessage,
  ]);

  // Handle submit from PromptInput (receives message object with text)
  const handleSubmit = (message) => {
    const hasText = Boolean(message.text && message.text.trim());

    if (!hasText || isChatUnavailable) {
      return;
    }

    sendMessageWithMetadata(message.text);
  };

  useEffect(() => {
    if (!router.isReady) return;

    let nextPrompt = legacyQueryPrompt;
    let nextPromptKey = null;

    if (!nextPrompt && queryPromptKey) {
      nextPrompt = readAiAssistantPrompt(queryPromptKey).trim();
      nextPromptKey = queryPromptKey;
    }

    if (!nextPrompt) return;

    const consumedMarker = nextPromptKey || nextPrompt;
    if (consumedAiPromptRef.current === consumedMarker) return;

    if (shouldResetChatForPrompt) {
      try {
        sessionStorage.removeItem("chat:/ai");
      } catch {}
      setMessages([]);
    }
    pendingAiPromptRef.current = nextPrompt;
    pendingAiPromptKeyRef.current = nextPromptKey;
    clearPromptQueryParams();
  }, [
    clearPromptQueryParams,
    legacyQueryPrompt,
    queryPromptKey,
    router.isReady,
    setMessages,
    shouldResetChatForPrompt,
  ]);

  // Hydrate once on mount (client only)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("chat:/ai");
      if (raw) setMessages(JSON.parse(raw));
    } catch {
    } finally {
      setIsChatHydrated(true);
    }
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

  useEffect(() => {
    const pendingPrompt = pendingAiPromptRef.current;
    if (
      !pendingPrompt ||
      !isChatHydrated ||
      isChatUnavailable ||
      status !== "ready"
    ) {
      return;
    }

    const pendingPromptKey = pendingAiPromptKeyRef.current;
    consumedAiPromptRef.current = pendingPromptKey || pendingPrompt;
    pendingAiPromptRef.current = null;
    pendingAiPromptKeyRef.current = null;
    sendMessageWithMetadata(pendingPrompt);
    if (pendingPromptKey) {
      clearAiAssistantPrompt(pendingPromptKey);
    }
  }, [isChatHydrated, isChatUnavailable, sendMessageWithMetadata, status]);

  // devLog(messages);

  const handleResetChat = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("chat:/ai");
    }
    setMessages([]);
    clearPromptQueryParams();
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

  const hasMessages = messages.length > 0;
  const coachPlaceholder = getCoachPlaceholder({
    isChatBlocked,
    isAnonymousQuotaBlocked,
    isChatQuotaReady,
    hasSharedTrainingData,
    primaryLift: suggestionContext?.primaryLift,
  });

  return (
    <Card
      className={cn(
        "bg-background text-foreground relative flex flex-col overflow-hidden",
        "shadow-lg shadow-black/5 ring-1 ring-black/5 dark:shadow-black/30 dark:ring-white/10",
        // Fill viewport under nav + shared page header; min height keeps empty state usable.
        "h-[calc(100dvh-8.5rem)] min-h-[30rem] sm:h-[calc(100dvh-9.5rem)] lg:h-[calc(100dvh-10rem)]",
      )}
    >
      {/* Big-four loaded bar — the visual signature of this coach */}
      <LoadedBarStripe className="shrink-0" />

      {/* Compact coach toolbar (same height empty vs active — more room for chat) */}
      <CardHeader className="flex shrink-0 flex-row items-center gap-2 space-y-0 border-b px-3 py-2.5 sm:px-4 md:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                hasSharedTrainingData || hasSharedBioData
                  ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]"
                  : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            <CardTitle className="text-sm font-semibold tracking-tight sm:text-base">
              {hasMessages ? "Session with your coach" : "Your lifting coach"}
            </CardTitle>
          </div>
          <CardDescription className="mt-0.5 text-[11px] sm:text-xs">
            Streamed to your device · never stored on our servers
          </CardDescription>
        </div>
        <div className="text-muted-foreground hidden shrink-0 items-center gap-1.5 sm:flex">
          <XAILogo className="size-3.5" />
          <span className="text-[11px] font-medium">xAI Grok</span>
        </div>
        {hasMessages && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8 gap-1.5 px-2"
              onClick={handleDownloadChat}
            >
              <DownloadIcon className="size-3.5" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive h-8 gap-1.5 px-2"
              onClick={handleResetChat}
            >
              <RotateCcwIcon className="size-3.5" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </div>
        )}
      </CardHeader>

      {/* Transcript: flex-1 + min-h-0 so StickToBottom can scroll inside the card */}
      <CardContent
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden p-0",
          // Soft platform floor under the conversation
          "bg-[radial-gradient(ellipse_at_top,var(--muted)_0%,transparent_55%)]",
        )}
      >
        <Conversation className="min-h-0 flex-1 overflow-x-visible overflow-y-hidden">
          <ConversationContent
            className={cn(
              hasMessages
                ? "gap-6 px-3 py-4 sm:px-5 sm:py-5 md:px-6"
                : "gap-0 p-0",
            )}
          >
            {messages.length === 0 ? (
              isChatHydrated ? (
                <CoachEmptyState
                  hasSharedBioData={hasSharedBioData}
                  hasSharedTrainingData={hasSharedTrainingData}
                  suggestionContext={suggestionContext}
                  suggestions={suggestedMessages}
                  isChatUnavailable={isChatUnavailable}
                  onSuggestion={(suggestion) => {
                    sendMessageWithMetadata(suggestion);
                  }}
                />
              ) : (
                <div className="text-muted-foreground flex size-full items-center justify-center text-sm">
                  Loading coach…
                </div>
              )
            ) : (
              <>
                {messages
                  .filter((msg) => msg.role !== "suggestions")
                  .map((message) => {
                    const parts = message.parts || [];
                    const isLastMessage =
                      message.id === messages[messages.length - 1]?.id;

                    const hasSources = parts.some(
                      (part) => part.type === "source-url",
                    );
                    const suggestedQuestions =
                      getSuggestedQuestionsFromParts(parts);

                    const lastTextPart = parts
                      .filter((p) => p.type === "text")
                      .pop();
                    const textContent =
                      lastTextPart?.text ||
                      (typeof message.content === "string"
                        ? message.content
                        : null);

                    const isUser = message.role === "user";
                    const isAssistant = message.role === "assistant";

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex w-full flex-col",
                          isUser && "items-end",
                          isAssistant && "items-stretch",
                        )}
                      >
                        {isAssistant && hasSources && (
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

                        {isUser && (
                          <span className="text-muted-foreground mb-1 mr-1 text-[10px] font-medium tracking-wide uppercase">
                            You
                          </span>
                        )}
                        {isAssistant && (
                          <span className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[10px] font-medium tracking-wide uppercase">
                            <span className="bg-foreground/80 size-1.5 rounded-full" />
                            Coach
                          </span>
                        )}

                        <Message
                          from={message.role}
                          className={cn(
                            isUser && "max-w-[min(100%,28rem)]",
                            isAssistant && "max-w-3xl",
                          )}
                        >
                          <MessageContent
                            className={cn(
                              // Override default bubble styles for a coach/lifter conversation feel
                              isUser &&
                                "!bg-foreground !text-background rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-snug shadow-sm",
                              isAssistant &&
                                "border-border/60 bg-card/90 max-w-none rounded-2xl rounded-tl-md border px-4 py-3 text-[15px] leading-relaxed shadow-sm sm:px-5 sm:py-4",
                            )}
                          >
                            {parts.length > 0 ? (
                              parts
                                .filter((part) => part.type === "text")
                                .map((part, i) => (
                                  <MessageResponse
                                    key={`${message.id}-${i}`}
                                    className={cn(
                                      isAssistant &&
                                        "prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-li:my-0.5 prose-strong:font-semibold",
                                    )}
                                  >
                                    {part.text}
                                  </MessageResponse>
                                ))
                            ) : message.content ? (
                              <MessageResponse
                                className={cn(
                                  isAssistant &&
                                    "prose prose-sm dark:prose-invert max-w-none",
                                )}
                              >
                                {typeof message.content === "string"
                                  ? message.content
                                  : JSON.stringify(message.content)}
                              </MessageResponse>
                            ) : null}
                          </MessageContent>
                          {isAssistant && isLastMessage && textContent && (
                            <MessageActions className="mt-1.5 opacity-70 transition-opacity group-hover:opacity-100">
                              <MessageAction
                                onClick={() => {
                                  if (!isChatUnavailable) {
                                    reserveQuotaLocally();
                                    regenerate({ body: chatRequestBody });
                                  }
                                }}
                                label="Retry"
                                disabled={isChatUnavailable}
                              >
                                <RefreshCcwIcon className="size-3" />
                              </MessageAction>
                              <CopyButton text={textContent} />
                            </MessageActions>
                          )}
                        </Message>

                        {isAssistant &&
                          isLastMessage &&
                          suggestedQuestions.length > 0 && (
                            <div className="mt-4 max-w-3xl">
                              <NextWorkLabel />
                              <Suggestions className="gap-2">
                                {suggestedQuestions.map((question) => (
                                  <Suggestion
                                    key={question}
                                    className={cn(
                                      "border-border bg-background hover:border-foreground/50 hover:bg-muted/50",
                                      "text-foreground max-w-full rounded-full text-left text-sm shadow-sm",
                                      "disabled:bg-muted disabled:text-muted-foreground",
                                    )}
                                    suggestion={question}
                                    disabled={isChatUnavailable}
                                    onClick={(suggestion) => {
                                      sendMessageWithMetadata(suggestion);
                                    }}
                                  />
                                ))}
                              </Suggestions>
                            </div>
                          )}
                      </div>
                    );
                  })}

                {status === "submitted" && (
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                      Coach
                    </span>
                    <Loader />
                  </div>
                )}
              </>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </CardContent>

      {/* Composer dock — context strip + input, pinned to platform floor */}
      <CardFooter className="bg-background/95 supports-[backdrop-filter]:bg-background/80 shrink-0 flex-col items-stretch gap-0 border-t p-0 backdrop-blur-md">
        <div className="border-border/50 border-b px-3 py-2 sm:px-4 md:px-5">
          <CoachContextStrip
            hasSharedBioData={hasSharedBioData}
            hasSharedTrainingData={hasSharedTrainingData}
            hasSharedFullTrainingData={hasSharedFullTrainingData}
            suggestionContext={suggestionContext}
          />
        </div>
        <div className="flex w-full flex-col gap-2.5 px-3 py-3 sm:px-4 md:px-5">
          <ChatQuotaLimitNotice quota={chatQuota} />
          <PromptInput
            className={cn(
              "[&_[data-slot=input-group]]:border-border/70",
              "[&_[data-slot=input-group]]:bg-background",
              "[&_[data-slot=input-group]]:shadow-md",
              "[&_[data-slot=input-group]]:rounded-2xl",
              "[&_[data-slot=input-group]]:ring-offset-background",
              "[&_[data-slot=input-group]:focus-within]:ring-ring/40",
              "[&_[data-slot=input-group]:focus-within]:ring-2",
            )}
            onSubmit={handleSubmit}
          >
            <PromptInputBody>
              <PromptInputTextarea
                className="min-h-[2.75rem] text-[15px] disabled:opacity-70"
                placeholder={coachPlaceholder}
                disabled={isChatUnavailable}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <ChatQuotaMeter quota={chatQuota} />
              </PromptInputTools>
              <PromptInputSubmit
                status={status}
                onStop={stop}
                disabled={isChatUnavailable}
              />
            </PromptInputFooter>
          </PromptInput>
          {hasMessages && (
            <MiniFeedbackWidget
              prompt="Useful coach?"
              contextId="ai_lifting_assistant_card"
              page="/ai-lifting-assistant"
              analyticsExtra={{ context: "ai_lifting_assistant_card" }}
            />
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

function createMetadataSection(title, lines) {
  const filteredLines = (lines ?? []).filter(Boolean).slice(0, 8);
  if (filteredLines.length === 0) return "";
  return [`[${title}]`, ...filteredLines].join("\n");
}

function formatConsistencyLine({
  label,
  actualWorkouts,
  targetWorkouts,
  periodDays,
  percentage,
}) {
  const parts = [
    `sessions=${actualWorkouts}`,
    `target=${targetWorkouts}`,
    `period_days=${periodDays}`,
    `score=${percentage}%`,
  ];

  return `${label}: ${parts.join(" | ")}`;
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

function buildRecentSessionWindowSections({
  parsedData,
  recentSessionDate,
  analyzedSessionLifts,
}) {
  const recentWindowDates = getRecentWindowDates(parsedData, recentSessionDate, 28);

  const recentBlockLines = [
    "window=last_28_days",
    `session_count=${recentWindowDates.length}`,
    `latest_session=${recentSessionDate}`,
    ...recentWindowDates.slice(0, 5).map((date) =>
      summarizeSessionForPrompt(parsedData, date),
    ),
  ].filter(Boolean);

  const latestDetailLines = buildLatestSessionDetailLines(
    recentSessionDate,
    analyzedSessionLifts,
  );

  return { recentBlockLines, latestDetailLines };
}

function getRecentWindowDates(parsedData, recentSessionDate, windowDays = 28) {
  if (!parsedData || !recentSessionDate) return [];

  // Use UTC date math — new Date("YYYY-MM-DD") is UTC midnight, so setDate
  // (local) would shift the cutoff by a day in USA/EU timezones.
  const cutoffDate = new Date(recentSessionDate);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - (windowDays - 1));

  const dateSet = new Set();

  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    const entryDate = new Date(entry.date);
    if (entryDate >= cutoffDate && entry.date <= recentSessionDate) {
      dateSet.add(entry.date);
    }
  });

  return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
}

function summarizeSessionForPrompt(parsedData, sessionDate) {
  const entries = (parsedData ?? []).filter(
    (entry) => entry.date === sessionDate && !entry.isGoal,
  );

  if (entries.length === 0) return null;

  const byLift = {};
  entries.forEach((entry) => {
    if (!byLift[entry.liftType]) {
      byLift[entry.liftType] = [];
    }
    byLift[entry.liftType].push(entry);
  });

  const liftSummaries = Object.entries(byLift)
    .slice(0, 4)
    .map(([liftType, lifts]) => {
      const totalReps = lifts.reduce(
        (sum, lift) => sum + (Number(lift.reps) || 0),
        0,
      );
      const tonnageByUnit = lifts.reduce((totals, lift) => {
        const unitType = lift.unitType || "unit";
        const reps = Number(lift.reps) || 0;
        const weight = Number(lift.weight) || 0;
        totals[unitType] = (totals[unitType] || 0) + reps * weight;
        return totals;
      }, {});
      const tonnageSummary = Object.entries(tonnageByUnit)
        .map(([unitType, tonnage]) => formatRoundedStat(tonnage, unitType))
        .filter(Boolean)
        .join("+");
      const topSet = lifts.reduce((best, current) => {
        if (!best) return current;
        if ((current.weight ?? 0) > (best.weight ?? 0)) return current;
        if ((current.weight ?? 0) === (best.weight ?? 0)) {
          return (current.reps ?? 0) > (best.reps ?? 0) ? current : best;
        }
        return best;
      }, null);

      if (!topSet) return null;

      return `${liftType} sets=${lifts.length} reps=${totalReps} tonnage=${tonnageSummary || "n/a"} top=${topSet.weight}${topSet.unitType}x${topSet.reps}`;
    })
    .filter(Boolean)
    .join("; ");

  if (!liftSummaries) return null;

  return `${sessionDate}: ${liftSummaries}`;
}

function buildLatestSessionDetailLines(sessionDate, analyzedLifts) {
  if (!analyzedLifts || Object.keys(analyzedLifts).length === 0) return [];

  const lines = [`date=${sessionDate}`];

  Object.entries(analyzedLifts)
    .slice(0, 4)
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

function getSuggestedQuestionsFromParts(parts) {
  const suggestionPart = parts.find(
    (part) => part.type === "data-suggested-questions",
  );
  const questions = suggestionPart?.data?.questions;

  if (!Array.isArray(questions)) return [];

  return questions
    .filter((question) => typeof question === "string")
    .map((question) => question.trim())
    .filter(Boolean);
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
