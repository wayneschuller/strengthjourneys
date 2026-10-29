/**
 * AI Lifting Assistant page. Builds an opt-in, compact lifting-context prompt
 * from local user data and streams model responses through the chat API.
 */
import { differenceInCalendarDays, format, parseISO, subYears } from "date-fns";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useSession } from "next-auth/react";
import { useChat } from "@ai-sdk/react";
import { defaultRemarkPlugins } from "streamdown";
import {
  remarkLiftGuideLinks,
  linkifyLiftGuideMarkdown,
} from "@/lib/lift-guide-links";
import {
  chatRehypePlugins,
  remarkHighlights,
  remarkItalicQuotes,
  remarkSessionDateLinks,
  remarkSetChips,
  remarkTakeawayLabels,
} from "@/lib/remark-chat-formatting";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  AI_REVIEW_PROMPTS,
  clearAiAssistantPrompt,
  readAiAssistantPrompt,
} from "@/lib/ai/review-prompts";
import {
  AI_CHAT_ANON_WARN_AT_REMAINING,
  AI_CHAT_AUTH_WARN_AT_REMAINING,
  parseAiChatQuotaFromHeaders,
} from "@/lib/ai/chat-quota-limits";
import { devLog } from "@/lib/processing-utils";
import { RelatedArticles } from "@/components/articles/article-cards";
import { AiReplyFeedback } from "@/components/feedback/ai-reply-feedback";
import { ModelSwitcher } from "@/components/ai-assistant/model-switcher";
import {
  DEFAULT_CHAT_MODEL_ID,
  canUseChatModel,
  findChatModel,
  resolveChatModelId,
} from "@/lib/ai/chat-model-catalog";
import { buildLiftingContext } from "@/lib/ai/lifting-context";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageAction,
  MessageActions,
} from "@/components/ai-elements/message";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Loader } from "@/components/ai-elements/loader";

import {
  PromptInput,
  PromptInputBody,
  PromptInputProvider,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";

import { PageContainer } from "@/components/page-header";

import { Button } from "@/components/ui/button";
import { useLocalStorage, useReadLocalStorage } from "usehooks-ts";
import { useUserLiftingData, isOwnData } from "@/hooks/use-userlift-data";
import { cn } from "@/lib/utils";
import {
  DownloadIcon,
  SquarePen,
  CheckIcon,
  CopyIcon,
  Dumbbell,
  HeartPulse,
  PartyPopper,
  TrendingUp,
} from "lucide-react";
import { BioDetailsCard } from "@/components/ai-assistant/bio-details-card";
import { LiftingDataCard } from "@/components/ai-assistant/lifting-data-card";
import { PersonalizationDialog } from "@/components/ai-assistant/personalization-dialog";
import {
  CoachWelcome,
  FollowUpSuggestions,
} from "@/components/ai-assistant/coach-welcome";
import { toKg } from "@/lib/weight-units";
import {
  ChatQuotaLimitNotice,
  ChatQuotaMeter,
} from "@/components/ai-assistant/chat-quota-meter";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";

import { getRelatedArticles } from "@/lib/articles";

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "AI Lifting Assistant";
  const relatedArticles = getRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
  };
}

/**
 * AI Lifting Assistant page. Renders SEO metadata and delegates rendering to AILiftingAssistantMain.
 * @param {Object} props
 * @param {Array} props.relatedArticles - Articles related to the AI Lifting Assistant topic.
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
 * @param {Array} props.relatedArticles - Articles to display in the related articles section.
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
    dataSource,
    liftTypes,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    sessionTonnageLookup,
    meetDays,
  } = useUserLiftingData();

  const [shareBioDetails, setShareBioDetails] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHARE_BIO_DETAILS_AI,
    false,
    { initializeWithValue: false },
  );
  const hasSharedTrainingData = hasAnySharedTrainingData(userLiftingMetadata);
  const hasSharedFullTrainingData =
    hasAllSharedTrainingData(userLiftingMetadata);
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
      latestSessionPR:
        hasSharedTrainingData && isOwnData(dataSource)
          ? getLatestSessionPR(parsedData)
          : null,
    };
  }, [
    age,
    dataSource,
    hasSharedTrainingData,
    liftTypes,
    parsedData,
    shareBioDetails,
    topLiftsByTypeAndReps,
  ]);

  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";

  // Built on demand (when a message is sent, or the preview is opened), never
  // on page load: nothing needs the text until then, and the lifter's
  // settings keep changing while the page settles.
  const buildCoachContext = useCallback(() => {
    if (dataSource === "demo") return "";
    return buildLiftingContext({
      parsedData,
      liftTypes,
      topLiftsByTypeAndReps,
      topLiftsByTypeAndRepsLast12Months,
      sessionTonnageLookup,
      meetDays,
      options: userLiftingMetadata,
      bio: shareBioDetails ? { age, sex, bodyWeight, heightCm: height } : null,
      isMetric,
      standards,
      e1rmFormula,
      today: format(new Date(), "yyyy-MM-dd"),
    });
  }, [
    age,
    bodyWeight,
    e1rmFormula,
    height,
    dataSource,
    isMetric,
    liftTypes,
    meetDays,
    parsedData,
    sessionTonnageLookup,
    sex,
    shareBioDetails,
    standards,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    userLiftingMetadata,
  ]);

  return (
    <PageContainer>
      <AILiftingAssistantCard
        hasSharedBioData={dataSource !== "demo" && shareBioDetails}
        hasSharedFullTrainingData={
          dataSource !== "demo" && hasSharedFullTrainingData
        }
        hasSharedTrainingData={dataSource !== "demo" && hasSharedTrainingData}
        hasLiftingLog={isOwnData(dataSource)}
        loggedLiftTypes={dataSource === "demo" ? undefined : liftTypes}
        loggedSessionDates={
          dataSource === "demo"
            ? undefined
            : sessionTonnageLookup?.allSessionDates
        }
        personalizationControls={
          <PersonalizationDialog
            enabled={
              dataSource !== "demo" &&
              (shareBioDetails || hasSharedTrainingData)
            }
            buildSummary={buildCoachContext}
          >
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
              embedded
            />
            <LiftingDataCard
              selectedOptions={userLiftingMetadata}
              setSelectedOptions={setUserLiftingMetaData}
              embedded
            />
          </PersonalizationDialog>
        }
        suggestionContext={suggestionContext}
        buildCoachContext={buildCoachContext}
        relatedArticles={relatedArticles}
      />
    </PageContainer>
  );
}

// Health, food and recovery questions, wearing the heart icon.
const BIO_DATA_FALLBACK_PROMPTS = [
  "How much protein should I eat?",
  "Should I lift every day?",
  "Can I lift weights and still lose weight?",
  "How important is sleep for getting stronger?",
  "What should I eat before a workout?",
  "How do I recover faster between sessions?",
  "Is lifting good for my bones and joints?",
];

// Questions anyone can ask with no log or bio. The welcome draws a few fresh
// each visit, so a returning athlete rarely sees the same set twice.
const GENERAL_LIFTING_PROMPTS = [
  "Why lift weights?",
  "What should I do in my first gym session?",
  "How often should I deadlift?",
  "I'm female, will I get bulky lifting weights?",
  "How do I choose a gym?",
  "Isn't deadlifting dangerous?",
  "What are the health benefits for women who lift?",
  "Can I start lifting in my 50s?",
  "Write me a simple three-day beginner program",
  "How many sets and reps should a beginner do?",
  "What is progressive overload?",
  "How long until I notice strength gains?",
  "Should I test my one-rep max?",
  "Should I wear a lifting belt?",
  "How do I warm up for a heavy squat?",
  "How deep should I squat?",
  "Free weights or machines for a beginner?",
  "How do I get my bench press moving again?",
  "How long should I rest between sets?",
  "What does RPE mean?",
  "Strength or hypertrophy training: what's the difference?",
  "How do I fit lifting into a busy week?",
  "What makes a good deadlift setup?",
  "How do I train for my first powerlifting meet?",
  "Low bar or high bar squat?",
  "What's a good first strength goal?",
];

const PLAYFUL_PROMPTS = [
  "Write me a motivational rap.",
  "Give me a riddle about lifting weights.",
  "Hype me up for leg day.",
  "Write a haiku about the deadlift.",
  "Tell me your best gym dad joke.",
  "Narrate my squat like a nature documentary.",
  "Write a pep talk from my barbell.",
  "Invent a new lifting holiday.",
];

/**
 * The welcome's suggested questions. The reviews a lifter comes back for
 * always lead; the rest are a seeded draw from larger pools, so each visit
 * (and each new chat) opens with a different mix.
 * @param {Object} args
 * @param {string} args.seed Fresh per visit; the same seed gives the same set.
 */
function getAssistantSuggestions({
  seed,
  hasSharedBioData,
  hasSharedFullTrainingData,
  hasSharedTrainingData,
  suggestionContext,
}) {
  const pick = (pool, count, salt) =>
    pickPrompts(pool, `${seed}|${salt}`, count);
  const bioPrompts = buildBioDataPrompts(suggestionContext);
  const bioPicks = hasSharedBioData ? pick(bioPrompts, 1, "bio") : [];

  if (hasSharedFullTrainingData) {
    return uniqueMessages([
      ...buildTrainingAnchorPrompts(suggestionContext),
      ...pick(
        buildTrainingPromptPool({ hasSharedBioData, suggestionContext }),
        3,
        "training",
      ),
      ...bioPicks,
      ...pick(GENERAL_LIFTING_PROMPTS, 1, "general"),
      ...pick(PLAYFUL_PROMPTS, 1, "playful"),
    ]);
  }

  if (hasSharedTrainingData) {
    return uniqueMessages([
      "Review the training data I've shared",
      ...pick(
        buildPartialTrainingPromptPool({ hasSharedBioData, suggestionContext }),
        2,
        "training",
      ),
      ...bioPicks,
      ...pick(GENERAL_LIFTING_PROMPTS, 2, "general"),
      ...pick(PLAYFUL_PROMPTS, 1, "playful"),
    ]);
  }

  if (hasSharedBioData) {
    return uniqueMessages([
      ...pick(bioPrompts, 3, "bio"),
      ...pick(GENERAL_LIFTING_PROMPTS, 3, "general"),
      ...pick(PLAYFUL_PROMPTS, 1, "playful"),
    ]);
  }

  // A first visit: a shuffled handful across all three kinds.
  return pick(
    [
      ...pick(GENERAL_LIFTING_PROMPTS, 4, "general"),
      ...pick(BIO_DATA_FALLBACK_PROMPTS, 2, "bio"),
      ...pick(PLAYFUL_PROMPTS, 1, "playful"),
    ],
    7,
    "order",
  );
}

// Always first for a lifter sharing their whole log.
function buildTrainingAnchorPrompts(suggestionContext) {
  const { recentSessionDate, latestSessionPR } = suggestionContext ?? {};
  return [
    getLatestSessionReviewPrompt(recentSessionDate, Boolean(latestSessionPR)),
    AI_REVIEW_PROMPTS.week,
    AI_REVIEW_PROMPTS.month,
  ];
}

// Questions the coach can answer from the full lifting summary: per-lift
// bests and six-week trends, rep-range records, consistency and tonnage.
function buildTrainingPromptPool({ hasSharedBioData, suggestionContext }) {
  const { primaryLift, secondaryLift } = suggestionContext ?? {};
  return [
    primaryLift
      ? `What should I focus on next for ${primaryLift}?`
      : "What lift should I focus on next?",
    primaryLift && `Is my ${primaryLift} still climbing?`,
    primaryLift &&
      `Set me a realistic ${primaryLift} goal for the next three months`,
    primaryLift && `Which rep ranges could I explore on ${primaryLift}?`,
    primaryLift &&
      secondaryLift &&
      `Compare my ${primaryLift} and ${secondaryLift} progress`,
    "Where is my training inconsistent?",
    "What am I doing well right now?",
    "Which lift has the most room to grow?",
    "Which lift has improved the most this year?",
    "How has my training load changed this year?",
    "Am I training often enough to keep progressing?",
    "Do I need a deload?",
    "Which PRs could I chase next?",
    "Tell me something I might not have noticed about my training",
    hasSharedBioData ? "How strong am I for my age?" : "How strong am I?",
    hasSharedBioData && "Which of my lifts is strongest for my bodyweight?",
  ].filter(Boolean);
}

// Names the latest session by how long ago it was, in the lifter's local
// calendar. The coach's context carries the exact date, so this stays clear.
function getLatestSessionReviewPrompt(recentSessionDate, hasPR) {
  const session = hasPR ? "PR session" : "training session";
  if (!recentSessionDate) return `Review my latest ${session}`;
  const daysAgo = getDaysAgo(recentSessionDate);
  if (daysAgo <= 0) return `Review today's ${session}`;
  if (daysAgo === 1) return `Review yesterday's ${session}`;
  return `Review my ${session} from ${daysAgo} days ago`;
}

function getDaysAgo(date) {
  return differenceInCalendarDays(new Date(), parseISO(date));
}

function buildPartialTrainingPromptPool({
  hasSharedBioData,
  suggestionContext,
}) {
  const { primaryLift, secondaryLift } = suggestionContext ?? {};
  return [
    primaryLift
      ? `What does my ${primaryLift} data suggest?`
      : "What does my shared training data suggest?",
    primaryLift && secondaryLift
      ? `Compare my ${primaryLift} and ${secondaryLift} progress`
      : "What should I focus on next from my shared data?",
    "What am I doing well right now?",
    hasSharedBioData ? "How strong am I for my age?" : "How strong am I?",
  ];
}

function buildBioDataPrompts(suggestionContext) {
  const age = Number(suggestionContext?.age);
  const ageSuffix = Number.isFinite(age) && age > 0 ? ` at ${age}` : "";

  return [
    `Why does strength training matter${ageSuffix}?`,
    `How should recovery change${ageSuffix}?`,
    ...BIO_DATA_FALLBACK_PROMPTS,
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

// A seeded shuffle: the first `count` of the pool in an order fixed by the
// seed, so a render never reshuffles what the athlete is reading.
function pickPrompts(pool, seed, count) {
  const next = seededRandoms(hashString(seed));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A stream of numbers in [0, 1) from one seed (mulberry32).
function seededRandoms(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One per visit, and a new one for each new chat. Suggestions render only
// after hydration, so the server's draw never has to match.
function newSuggestionSeed() {
  return Math.random().toString(36).slice(2);
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

const BIO_PROMPT_PREFIXES = [
  "Why does strength training matter",
  "How should recovery change",
];

// Each opening prompt wears an icon for what it draws on: the lifter's log,
// their body, general lifting knowledge, or just fun.
function getSuggestionIcon(prompt) {
  if (PLAYFUL_PROMPTS.includes(prompt)) return PartyPopper;
  if (GENERAL_LIFTING_PROMPTS.includes(prompt)) return Dumbbell;
  if (
    BIO_DATA_FALLBACK_PROMPTS.includes(prompt) ||
    BIO_PROMPT_PREFIXES.some((prefix) => prompt.startsWith(prefix))
  ) {
    return HeartPulse;
  }
  return TrendingUp;
}

// A fresh PR is cheered for this many days after the session.
const PR_CELEBRATION_DAYS = 3;

/**
 * The welcome's greeting and line under it, plus the PR pill when the latest
 * session set a record in the last few days.
 */
function getWelcomeCopy({ dateKey, hasSharedTrainingData, latestSessionPR }) {
  const daysAgo = latestSessionPR ? getDaysAgo(latestSessionPR.date) : Infinity;
  if (latestSessionPR && daysAgo <= PR_CELEBRATION_DAYS) {
    const { kind, liftType, reps, weight, unitType } = latestSessionPR;
    const record = kind === "year" ? "12-month best" : "PR";
    return {
      greeting:
        daysAgo <= 0
          ? `A ${record} today, athlete! Let's talk about it.`
          : daysAgo === 1
            ? `Yesterday's ${record} deserves a chat, athlete.`
            : `That ${record} ${daysAgo} days ago deserves a chat, athlete.`,
      description: "Ask your own question, or pick one below.",
      celebration: getCelebrationChip({
        dateKey,
        daysAgo,
        lift: `${liftType} ${reps}@${weight}${unitType}`,
        kind,
      }),
    };
  }
  return {
    greeting:
      EMPTY_STATE_GREETINGS[
        getStablePromptOffset(dateKey, EMPTY_STATE_GREETINGS.length)
      ],
    description: hasSharedTrainingData
      ? "I can see your training. Ask your own question, or pick one below."
      : "Ask your own question, or pick one below.",
    celebration: null,
  };
}

// Verbs for the PR chip, rotated by day so a repeat visit reads fresh. Each
// one reads as a request to the coach, both on the chip and as the question.
const CELEBRATION_VERBS = [
  "Celebrate",
  "Unpack",
  "Break down",
  "Talk through",
  "Relive",
  "Toast",
  "Analyze",
  "Explore",
  "Review",
  "Decode",
  "Dig into",
  "Build on",
  "Savor",
  "Applaud",
  "Reflect on",
  "Learn from",
  "Make sense of",
  "Plan beyond",
  "Show off",
  "Hype up",
];

/**
 * The PR chip: a verb-led label, and the fuller question it asks the coach.
 * @param {Object} args
 * @param {string} args.dateKey Today, for the daily verb.
 * @param {number} args.daysAgo
 * @param {string} args.lift e.g. "Back Squat 1@160kg"
 * @param {"lifetime"|"year"} args.kind
 */
function getCelebrationChip({ dateKey, daysAgo, lift, kind }) {
  const verb =
    CELEBRATION_VERBS[
      getStablePromptOffset(`${dateKey}|${lift}`, CELEBRATION_VERBS.length)
    ];
  const when =
    daysAgo <= 0
      ? "today"
      : daysAgo === 1
        ? "yesterday"
        : `from ${daysAgo} days ago`;
  const record = kind === "year" ? "12-month best" : "PR";
  return {
    label: `${verb} my ${lift} ${kind === "year" ? "12-month PR" : "PR"}`,
    prompt: `${verb} my ${lift} ${record} ${when} with me. What does it mean for my training?`,
  };
}

const EMPTY_STATE_GREETINGS = [
  "What are we lifting today, athlete?",
  "Ready when you are, athlete.",
  "Ask me anything, athlete.",
  "Let's talk training, athlete.",
];

/**
 * One line appended to a copied reply, so a pasted answer says where it came
 * from and exactly what wrote it: the model and prompt version from the
 * reply's metadata. Older saved replies without metadata get the site alone.
 * @param {{ edition?: string|null, model?: string }|undefined} metadata
 */
function formatReplyAttribution(metadata) {
  const site =
    "From the Strength Journeys AI lifting coach, https://www.strengthjourneys.xyz/ai-lifting-assistant";
  if (!metadata?.model) return site;
  const model = findChatModel(metadata.model)?.label ?? metadata.model;
  return metadata.edition
    ? `${site} (${model}, prompt version ${metadata.edition})`
    : `${site} (${model})`;
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
      {copied ? <CheckIcon className="text-green-600" /> : <CopyIcon />}
    </MessageAction>
  );
}

// The lifting summary sent with the latest message, saved beside the chat.
const CHAT_CONTEXT_STORAGE_KEY = "chat:/ai:context";

/**
 * Chat card that drives the AI lifting assistant conversation. Handles message streaming via the
 * Vercel AI SDK, persists the session to sessionStorage, and supports download and reset actions.
 * @param {Object} props
 * @param {boolean} props.hasSharedBioData - Whether the user has opted to share bio details.
 * @param {boolean} props.hasSharedFullTrainingData - Whether the user has opted to share every lifting metadata section.
 * @param {boolean} props.hasSharedTrainingData - Whether the user has opted to share any lifting metadata.
 * @param {boolean} props.hasLiftingLog - Whether the lifter's own log is loaded (not demo data), so
 *   the coach knows whether to point them at Personalize or at connecting a log.
 * @param {React.ReactNode} props.personalizationControls - Compact dialog trigger rendered in the chat header.
 * @param {Object} props.suggestionContext - Small prompt-personalisation context derived from opted-in local data.
 * @param {() => string} props.buildCoachContext - Builds the opted-in lifting summary. Called
 *   only when a message is sent; the text sent is kept so shared feedback shows exactly what
 *   the coach saw.
 */
// The coach's answers read in their own face (Source Serif 4, loaded in
// _app.js) in every theme, a size up from the interface, with lining tabular
// figures so weights line up in tables.
const COACH_ANSWER_CLASS =
  "font-coach text-base leading-relaxed lining-nums tabular-nums";

function AILiftingAssistantCard({
  hasSharedBioData,
  hasSharedFullTrainingData,
  hasSharedTrainingData,
  hasLiftingLog,
  personalizationControls,
  suggestionContext,
  buildCoachContext,
  loggedLiftTypes,
  loggedSessionDates,
  relatedArticles,
}) {
  const router = useRouter();
  // Passing remarkPlugins to Streamdown replaces its defaults, so GFM (tables,
  // strikethrough) has to be kept explicitly alongside our own plugins.
  // Highlights go first so their == markers never split a quote or a set.
  const assistantRemarkPlugins = useMemo(
    () => [
      ...Object.values(defaultRemarkPlugins),
      remarkHighlights,
      remarkItalicQuotes,
      remarkSetChips,
      remarkTakeawayLabels,
      [
        remarkSessionDateLinks,
        {
          sessionDates: loggedSessionDates,
          today: format(new Date(), "yyyy-MM-dd"),
        },
      ],
      [remarkLiftGuideLinks, { liftTypes: loggedLiftTypes }],
    ],
    [loggedLiftTypes, loggedSessionDates],
  );
  const { status: authStatus } = useSession();
  const [chatQuota, setChatQuota] = useState(null);
  const [isChatQuotaReady, setIsChatQuotaReady] = useState(false);
  const [isChatHydrated, setIsChatHydrated] = useState(false);
  const [suggestionDateKey] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [suggestionSeed, setSuggestionSeed] = useState(newSuggestionSeed);
  const pendingAiPromptRef = useRef(null);
  const pendingAiPromptKeyRef = useRef(null);
  const consumedAiPromptRef = useRef(null);
  const suggestedMessages = useMemo(
    () =>
      getAssistantSuggestions({
        seed: suggestionSeed,
        hasSharedBioData,
        hasSharedFullTrainingData,
        hasSharedTrainingData,
        suggestionContext,
      }),
    [
      hasSharedBioData,
      hasSharedFullTrainingData,
      hasSharedTrainingData,
      suggestionSeed,
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

  const loadChatQuota = useCallback(
    async (options = {}) => {
      try {
        const response = await fetch("/api/chat/quota");
        if (!response.ok) return;
        const data = await response.json();
        applyQuotaSnapshot(data, options);
      } catch (error) {
        devLog("Failed to load AI chat quota", error);
      }
    },
    [applyQuotaSnapshot],
  );

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
          setCoach(data.coach ?? null);
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

  // What the coach runs right now, for the header's details panel. It rides
  // along with the quota snapshot fetched on load.
  const [coach, setCoach] = useState(null);

  // The lifter's pick from the header model switcher. A remembered pick the
  // server no longer offers quietly becomes the server's default.
  const [storedModelId, setStoredModelId] = useLocalStorage(
    LOCAL_STORAGE_KEYS.AI_CHAT_MODEL,
    DEFAULT_CHAT_MODEL_ID,
    { initializeWithValue: false },
  );
  // A signed-out lifter who picked a signed-in model gets the default until
  // they sign in; the server would fall back the same way.
  const isSignedIn = authStatus === "authenticated";
  const storedModel = findChatModel(resolveChatModelId(storedModelId));
  const selectedModelId =
    storedModel &&
    canUseChatModel(storedModel, isSignedIn) &&
    (!coach || coach.availableModels?.includes(storedModel.id))
      ? storedModel.id
      : (coach?.defaultModel ?? DEFAULT_CHAT_MODEL_ID);

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

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    api: "/api/chat",
    fetch: chatFetch,
    onError: (error) => {
      console.error("(useChat() error: ", error);
      loadChatQuota({ allowRollback: true });
    },
  });
  // The lifting summary sent with the latest message, built at send time.
  // Kept (and saved with the chat) so shared feedback shows exactly what the
  // coach saw.
  const [sentContext, setSentContext] = useState("");
  const buildChatRequestBody = useCallback(() => {
    const context = buildCoachContext();
    setSentContext(context);
    try {
      sessionStorage.setItem(CHAT_CONTEXT_STORAGE_KEY, context);
    } catch {}
    return {
      userProvidedMetadata: context,
      hasLiftingLog: Boolean(hasLiftingLog),
      model: selectedModelId,
    };
  }, [buildCoachContext, hasLiftingLog, selectedModelId]);

  // Follow-up suggestions are fetched separately once an answer finishes, so a
  // slow suggestion model can never hold the main chat stream open.
  const [suggestionsByMessageId, setSuggestionsByMessageId] = useState({});
  const suggestionRequestRef = useRef(null);
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
  const sendMessageWithMetadata = useCallback(
    (message) => {
      if (isChatUnavailable) return;

      reserveQuotaLocally();
      sendMessage(typeof message === "string" ? { text: message } : message, {
        body: buildChatRequestBody(),
      });
    },
    [buildChatRequestBody, isChatUnavailable, reserveQuotaLocally, sendMessage],
  );

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
        sessionStorage.removeItem("chat:/ai:suggestions");
        sessionStorage.removeItem(CHAT_CONTEXT_STORAGE_KEY);
      } catch {}
      setMessages([]);
      setSentContext("");
      setSuggestionsByMessageId({});
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
      setSentContext(sessionStorage.getItem(CHAT_CONTEXT_STORAGE_KEY) ?? "");
      const rawSuggestions = sessionStorage.getItem("chat:/ai:suggestions");
      if (rawSuggestions) {
        setSuggestionsByMessageId(JSON.parse(rawSuggestions));
        // Restored suggestions belong to the restored last answer; don't refetch.
        suggestionRequestRef.current = "hydrated";
      }
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

  // save whenever suggestions change
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (Object.keys(suggestionsByMessageId).length === 0) return;
    try {
      sessionStorage.setItem(
        "chat:/ai:suggestions",
        JSON.stringify(suggestionsByMessageId),
      );
    } catch {}
  }, [suggestionsByMessageId]);

  // Fetch follow-up suggestions once the answer has fully arrived.
  useEffect(() => {
    if (status !== "ready") {
      suggestionRequestRef.current = null;
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;
    if (suggestionRequestRef.current === lastMessage.id) return;
    if (suggestionsByMessageId[lastMessage.id]) return;

    const assistantText = getMessageText(lastMessage);
    const latestUserText = getMessageText(
      [...messages].reverse().find((message) => message.role === "user") || {},
    );
    if (!assistantText.trim() || !latestUserText.trim()) return;

    suggestionRequestRef.current = lastMessage.id;

    (async () => {
      try {
        const response = await fetch("/api/chat/suggestions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            latestUserMessage: latestUserText,
            assistantText,
          }),
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!Array.isArray(data?.questions) || data.questions.length === 0) {
          return;
        }
        setSuggestionsByMessageId((previous) => ({
          ...previous,
          [lastMessage.id]: data.questions,
        }));
      } catch (error) {
        devLog("Failed to load AI follow-up suggestions", error);
      }
    })();
  }, [messages, status, suggestionsByMessageId]);

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
      sessionStorage.removeItem("chat:/ai:suggestions");
      sessionStorage.removeItem(CHAT_CONTEXT_STORAGE_KEY);
    }
    setMessages([]);
    setSentContext("");
    setSuggestionsByMessageId({});
    setSuggestionSeed(newSuggestionSeed());
    clearPromptQueryParams();
    window.scrollTo({ top: 0, behavior: "smooth" });
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

      // Match what the reader saw: the renderer adds these links, so the
      // export would otherwise be missing them.
      if (m.role === "assistant") {
        content = linkifyLiftGuideMarkdown(content, {
          liftTypes: loggedLiftTypes,
        });
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

  // Starting (or restoring) a chat scrolls the one-screen panel to fill the
  // window, past the site nav, the way a chat app opens.
  const chatPanelRef = useRef(null);
  const hasConversation = messages.length > 0;
  useEffect(() => {
    if (!hasConversation) return;
    chatPanelRef.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [hasConversation]);

  // The message box takes focus when the page is ready and again after each
  // reply, so the athlete can just type. Desktop only: on a phone it would
  // throw the keyboard up over the page. It never takes focus from another
  // field or dialog, or from a passage the athlete has selected to copy.
  const composerRef = useRef(null);
  const isComposerReady = !isChatUnavailable && status === "ready";
  useEffect(() => {
    if (!isComposerReady) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }
    const active = document.activeElement;
    if (
      active?.closest(
        "input, textarea, select, [contenteditable='true'], [role='dialog']",
      )
    ) {
      return;
    }
    if (window.getSelection()?.toString()) return;
    composerRef.current?.focus({ preventScroll: true });
  }, [isComposerReady, hasConversation]);

  // Escape stops a reply mid-stream, unless it is closing a dialog or menu.
  useEffect(() => {
    if (status !== "submitted" && status !== "streaming") return;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (
        document.activeElement?.closest(
          "[role='dialog'], [role='menu'], [role='listbox']",
        )
      ) {
        return;
      }
      stop();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, stop]);

  const modelSwitcherProps = {
    selectedId: selectedModelId,
    onSelect: setStoredModelId,
    isSignedIn,
    availableIds: coach?.availableModels ?? null,
    details: {
      coach,
      latestReply: messages.findLast((m) => m.role === "assistant")?.metadata,
      quota: chatQuota,
      sharedContextChars: sentContext.length,
      isSharing: hasSharedBioData || hasSharedTrainingData,
    },
  };

  const composer = (
    <div className="flex w-full flex-col gap-2">
      <ChatQuotaLimitNotice quota={chatQuota} />
      <PromptInput
        className="[&_[data-slot=input-group]]:border-border/70 [&_[data-slot=input-group]]:bg-background [&_[data-slot=input-group]]:shadow-sm"
        onSubmit={handleSubmit}
      >
        <PromptInputBody>
          <PromptInputTextarea
            ref={composerRef}
            className="disabled:opacity-70"
            placeholder={
              isChatBlocked
                ? isAnonymousQuotaBlocked
                  ? "Sign in to continue chatting..."
                  : "AI quota exhausted."
                : !isChatQuotaReady
                  ? "Checking message quota..."
                  : "Ask your coach anything..."
            }
            disabled={isChatUnavailable}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools className="gap-3">
            <ModelSwitcher size="sm" {...modelSwitcherProps} />
            <ChatQuotaMeter quota={chatQuota} />
          </PromptInputTools>
          <PromptInputSubmit
            status={status}
            onStop={stop}
            disabled={isChatUnavailable}
          />
        </PromptInputFooter>
      </PromptInput>
      <p className="text-muted-foreground text-center text-xs">
        Discussions are streamed to your device and not stored on our servers.
      </p>
    </div>
  );

  return (
    // The provider lets a hovered suggestion type itself into the composer.
    <PromptInputProvider>
      {/*
        One screen tall once chatting, scrolled to fill the window, with the
        conversation scrolling inside it above a composer pinned at the foot.
        Empty, it is the welcome: greeting, composer and suggestions centred.
      */}
      <section
        ref={chatPanelRef}
        aria-label="Chat with the AI lifting coach"
        className={cn(
          "flex flex-col",
          hasConversation ? "h-dvh" : "min-h-[calc(100dvh-7rem)]",
        )}
      >
        <div className="flex items-center gap-2 py-2">
          {personalizationControls}
          {hasConversation && (
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleDownloadChat}>
                <DownloadIcon className="size-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleResetChat}>
                <SquarePen className="size-4" />
                New chat
              </Button>
            </div>
          )}
        </div>
        {!hasConversation ? (
          <div className="flex flex-1 flex-col items-center justify-center py-8">
            <CoachWelcome
              {...getWelcomeCopy({
                dateKey: suggestionDateKey,
                hasSharedTrainingData,
                latestSessionPR: suggestionContext?.latestSessionPR,
              })}
              composer={composer}
              suggestions={
                isChatHydrated
                  ? suggestedMessages.map((text) => ({
                      text,
                      icon: getSuggestionIcon(text),
                    }))
                  : null
              }
              disabled={isChatUnavailable}
              onSelect={sendMessageWithMetadata}
            />
            <div className="mt-12 max-w-md text-center">
              <h1 className="text-sm font-semibold">AI Lifting Assistant</h1>
              <p className="text-muted-foreground text-xs">
                Free AI Lifting Assistant. Talk to your lifting data. The gym
                buddy you never had.
              </p>
            </div>
          </div>
        ) : (
          <>
            <h1 className="sr-only">AI Lifting Assistant</h1>
            <Conversation className="min-h-0 flex-1">
              <ConversationContent
                className="mx-auto w-full max-w-3xl px-0 py-6"
                scrollClassName="scrollbar-themed"
              >
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
                    const suggestedQuestions =
                      suggestionsByMessageId[message.id] ?? [];

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
                          <MessageContent
                            className={
                              message.role === "assistant"
                                ? COACH_ANSWER_CLASS
                                : undefined
                            }
                          >
                            {parts.length > 0 ? (
                              parts
                                .filter((part) => part.type === "text")
                                .map((part, i) => (
                                  <MessageResponse
                                    key={`${message.id}-${i}`}
                                    remarkPlugins={
                                      message.role === "assistant"
                                        ? assistantRemarkPlugins
                                        : undefined
                                    }
                                    rehypePlugins={
                                      message.role === "assistant"
                                        ? chatRehypePlugins
                                        : undefined
                                    }
                                    className={
                                      message.role === "assistant"
                                        ? "sj-chat-answer"
                                        : undefined
                                    }
                                  >
                                    {part.text}
                                  </MessageResponse>
                                ))
                            ) : message.content ? (
                              <MessageResponse
                                remarkPlugins={
                                  message.role === "assistant"
                                    ? assistantRemarkPlugins
                                    : undefined
                                }
                                rehypePlugins={
                                  message.role === "assistant"
                                    ? chatRehypePlugins
                                    : undefined
                                }
                                className={
                                  message.role === "assistant"
                                    ? "sj-chat-answer"
                                    : undefined
                                }
                              >
                                {typeof message.content === "string"
                                  ? message.content
                                  : JSON.stringify(message.content)}
                              </MessageResponse>
                            ) : null}
                          </MessageContent>
                          {message.role === "assistant" &&
                            isLastMessage &&
                            textContent && (
                              <AiReplyFeedback
                                message={message}
                                messages={messages}
                                userProvidedMetadata={sentContext}
                              >
                                <CopyButton
                                  text={`${textContent}\n\n${formatReplyAttribution(message.metadata)}`}
                                />
                              </AiReplyFeedback>
                            )}
                          {/* Earlier replies keep a copy button, shown on
                              hover where there is one, always on touch. */}
                          {message.role === "assistant" &&
                            !isLastMessage &&
                            textContent && (
                              <MessageActions className="transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0">
                                <CopyButton
                                  text={`${textContent}\n\n${formatReplyAttribution(message.metadata)}`}
                                />
                              </MessageActions>
                            )}
                        </Message>
                        {message.role === "assistant" &&
                          isLastMessage &&
                          suggestedQuestions.length > 0 && (
                            <div className="mt-4 max-w-3xl">
                              <FollowUpSuggestions
                                questions={suggestedQuestions}
                                disabled={isChatUnavailable}
                                onSelect={sendMessageWithMetadata}
                              />
                            </div>
                          )}
                      </div>
                    );
                  })}

                {/* Show loader only while waiting */}
                {status === "submitted" && <Loader />}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
            <div className="animate-in fade-in slide-in-from-bottom-4 mx-auto w-full max-w-3xl pt-2 pb-3 duration-500">
              {composer}
            </div>
          </>
        )}
      </section>
      {!hasConversation && <RelatedArticles articles={relatedArticles} />}
    </PromptInputProvider>
  );
}

function getMostRecentSessionDate(parsedData) {
  return parsedData?.[parsedData.length - 1]?.date ?? null;
}

// Athletes with this much history also get 12-month bests celebrated, since
// lifetime PRs come rarely after the first few years.
const YEARLY_PR_MIN_HISTORY_YEARS = 3;

/**
 * The latest session's best record set: a lifetime PR if there is one, else
 * (for long histories) a best in the last 12 months. A record has to beat an
 * earlier set at the same rep count, so a first ever set of 7 is no milestone.
 * Heaviest wins within each kind.
 * @returns {{ kind: "lifetime"|"year", date: string, liftType: string,
 *   reps: number, weight: number, unitType: string }|null}
 */
function getLatestSessionPR(parsedData) {
  const latestDate = getMostRecentSessionDate(parsedData);
  if (!latestDate) return null;
  const latest = parseISO(latestDate);
  const yearCutoff = format(subYears(latest, 1), "yyyy-MM-dd");
  const hasLongHistory =
    parsedData[0].date <=
    format(subYears(latest, YEARLY_PR_MIN_HISTORY_YEARS), "yyyy-MM-dd");

  const earlierKeys = new Set();
  const yearBestKg = new Map();
  let lifetimeBest = null;
  let yearBest = null;
  for (const entry of parsedData) {
    const key = `${entry.liftType}-${entry.reps}`;
    const weightKg = toKg(entry.weight, entry.unitType);
    if (entry.date !== latestDate) {
      earlierKeys.add(key);
      if (entry.date >= yearCutoff && weightKg > (yearBestKg.get(key) ?? -1)) {
        yearBestKg.set(key, weightKg);
      }
      continue;
    }
    if (!entry.liftType || entry.reps < 1 || entry.reps > 10) continue;
    const record = {
      date: entry.date,
      liftType: entry.liftType,
      reps: entry.reps,
      weight: entry.weight,
      unitType: entry.unitType,
      weightKg,
    };
    if (entry.isHistoricalPR && earlierKeys.has(key)) {
      if (!lifetimeBest || weightKg > lifetimeBest.weightKg) {
        lifetimeBest = { ...record, kind: "lifetime" };
      }
    } else if (
      hasLongHistory &&
      yearBestKg.has(key) &&
      weightKg > yearBestKg.get(key)
    ) {
      if (!yearBest || weightKg > yearBest.weightKg) {
        yearBest = { ...record, kind: "year" };
      }
    }
  }
  return lifetimeBest ?? yearBest;
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
      if (entry.date !== recentSessionDate || !entry.liftType) {
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
