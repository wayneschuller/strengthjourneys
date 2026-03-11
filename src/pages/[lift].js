import Head from "next/head";
import Link from "next/link";
import Image from "next/image";


import { cn } from "@/lib/utils";
import { useAthleteBio, getTopLiftStats, STRENGTH_LEVEL_EMOJI } from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { devLog, getDisplayWeight } from "@/lib/processing-utils";
import { StandardsSlider } from "@/components/standards-slider";
import { NextSeo } from "next-seo";
import { PortableText } from "@portabletext/react";
import { Crown, Shield, Skull, Luggage } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
  PageHeaderRight,
} from "@/components/page-header";

import { LiftJourneyCard } from "@/components/visualizer/lift-journey-card";
import { LiftTypeRepPRsDisplay } from "@/components/analyzer/lift-type-prs-display";

import { MostRecentSessionCard } from "@/components/most-recent-session-card";
import { VisualizerMini } from "@/components/visualizer/visualizer-mini";
import { VisualizerReps } from "@/components/visualizer/visualizer-reps";
import { TonnageChart } from "@/components/visualizer/visualizer-tonnage";
import { StrengthPotentialBarChart } from "@/components/visualizer/strength-potential-bar-chart";
import { RelatedArticles } from "@/components/article-cards";

import {
  TimeRangeSelect,
  calculateThresholdDate,
  getTimeRangeDescription,
} from "@/components/visualizer/time-range-select";

const googleSheetSampleURL =
  "https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0";

const StrengthJourneys = () => (
  <span className="mx-1 text-blue-600 underline visited:text-purple-600 hover:text-blue-800">
    <Link href="/">Strength Journeys</Link>
  </span>
);

import { fetchRelatedArticles, fetchArticleById } from "@/lib/sanity-io.js";
import { bigFourLiftInsightData } from "@/lib/big-four-insight-data";
import { getDashboardStage } from "@/lib/home-dashboard/dashboard-stage";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";

// Keep this page template generic across all four lift insight pages.
// Lift-specific SEO copy, hero wording, and lower-page personality should live
// in src/lib/big-four-insight-data.js so we do not reintroduce per-lift branching here.

function renderAnswer(answer) {
  if (typeof answer === "string") return answer;
  return answer.map((seg, i) =>
    typeof seg === "string" ? seg : (
      <Link key={i} href={seg.href}
        className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800">
        {seg.text}
      </Link>
    )
  );
}

function flattenAnswer(answer) {
  if (typeof answer === "string") return answer;
  return answer.map((seg) => (typeof seg === "string" ? seg : seg.text)).join("");
}

function getNavLiftLabel(liftType) {
  const navLabels = {
    "Back Squat": "Squat",
    "Bench Press": "Bench",
    Deadlift: "Deadlift",
    "Strict Press": "Strict Press",
  };

  return navLabels[liftType] ?? liftType;
}

export async function getStaticPaths() {
  const paths = bigFourLiftInsightData.map((lift) => ({
    params: { lift: lift.slug },
  }));
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  const liftData = bigFourLiftInsightData.find(
    (lift) => lift.slug === params.lift,
  );

  const RELATED_ARTICLES_CATEGORY = liftData.liftType;
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  const articleId = liftData.introductionArticleId;
  const resourcesId = liftData.resourcesArticleId;

  // Fetch both articles separately using the generic function
  const introductionArticle = await fetchArticleById(articleId);
  const resourcesArticle = await fetchArticleById(resourcesId);

  // Error handling: if either article is missing, log it
  if (!introductionArticle) {
    console.error(`Introduction article not found for ID: ${articleId}`);
  }

  if (!resourcesArticle) {
    console.error(`Resources article not found for ID: ${resourcesId}`);
  }

  return {
    props: {
      liftInsightData: liftData,
      relatedArticles: relatedArticles,
      introductionArticle: introductionArticle || null, // Provide null if not found
      resourcesArticle: resourcesArticle || null, // Provide null if not found
    },
    revalidate: 60 * 60,
  };
}

/**
 * Dynamic insight page for a single Big Four barbell lift (e.g. Back Squat, Bench Press, Deadlift, Strict Press).
 * Renders SEO metadata from the lift's static data and delegates content rendering to BarbellInsightsMain.
 * @param {Object} props
 * @param {Object} props.liftInsightData - Static metadata for this lift (titles, SEO fields, quote, videos, etc.) from bigFourLiftInsightData.
 * @param {Array} props.relatedArticles - CMS articles related to this lift type, fetched via ISR.
 * @param {Object|null} props.introductionArticle - Sanity CMS article used as the introduction body for this lift.
 * @param {Object|null} props.resourcesArticle - Sanity CMS article used as the resources section for this lift.
 */
export default function BigFourBarbellInsights({
  liftInsightData,
  relatedArticles,
  introductionArticle,
  resourcesArticle,
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: liftInsightData.seoTitle,
        description: liftInsightData.pageDescription,
        url: liftInsightData.canonicalURL,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://www.strengthjourneys.xyz",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: liftInsightData.seoTitle,
            item: liftInsightData.canonicalURL,
          },
        ],
      },
      ...(liftInsightData.faqItems?.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: liftInsightData.faqItems.map(({ question, answer }) => ({
                "@type": "Question",
                name: question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: flattenAnswer(answer),
                },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <Head>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Head>
      <NextSeo
        title={liftInsightData.seoTitle}
        description={liftInsightData.pageDescription}
        canonical={liftInsightData.canonicalURL}
        openGraph={{
          url: liftInsightData.canonicalURL,
          title: liftInsightData.seoTitle,
          description: liftInsightData.pageDescription,
          type: "website",
          images: [
            {
              url: liftInsightData.ogImageURL,
              alt: liftInsightData.pageTitle,
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
            content: liftInsightData.pageKeywords,
          },
        ]}
      />
      <BarbellInsightsMain
        liftInsightData={liftInsightData}
        relatedArticles={relatedArticles}
        introductionArticle={introductionArticle}
        resourcesArticle={resourcesArticle}
      />
    </>
  );
}

/**
 * Inner client component for a Big Four lift insight page. Renders the full dashboard of lift-specific
 * cards: strength levels, lift journey, articles, visualizer charts, PR tables, and video guides.
 * @param {Object} props
 * @param {Object} props.liftInsightData - Static metadata for this lift including liftType, quote, videos, etc.
 * @param {Array} props.relatedArticles - CMS articles to display in the related articles section.
 * @param {Object|null} props.introductionArticle - Sanity CMS article rendered as the introduction card.
 * @param {Object|null} props.resourcesArticle - Sanity CMS article rendered as the resources card.
 */
function BarbellInsightsMain({
  liftInsightData,
  relatedArticles,
  introductionArticle,
  resourcesArticle,
}) {
  const { isLoading, parsedData, rawRows, sheetInfo } = useUserLiftingData();
  const { dashboardStage } = getDashboardStage({
    parsedData,
    rawRows,
    sheetInfo,
  });
  const prioritizeVideoGuides =
    dashboardStage === "starter_sample" ||
    dashboardStage === "first_real_week" ||
    dashboardStage === "first_month";

  const bigFourIcons = {
    "Back Squat": Crown,
    "Bench Press": Shield,
    Deadlift: Skull,
    "Strict Press": Luggage,
  };

  const bigFourDiagrams = {
    "Back Squat": "/back_squat.svg",
    "Bench Press": "/bench_press.svg",
    Deadlift: "/deadlift.svg",
    "Strict Press": "/strict_press.svg",
  };
  const calcUrl = LIFT_CALC_URLS[liftInsightData.liftType];
  const navLiftLabel = getNavLiftLabel(liftInsightData.liftType);

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={bigFourIcons[liftInsightData.liftType]}>
          {liftInsightData.pageTitle}
        </PageHeaderHeading>
        <PageHeaderDescription>
          <p>{liftInsightData.pageDescription}</p>
          {calcUrl && (
            <div className="mt-5">
              <Link
                href={calcUrl}
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Try the {liftInsightData.liftType} 1RM Calculator →
              </Link>
            </div>
          )}
          <nav
            aria-label={`${liftInsightData.liftType} page sections`}
            className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-y py-3 text-sm text-muted-foreground"
          >
            <Link href="#strength-standards" className="hover:text-foreground">
              {navLiftLabel} Standards
            </Link>
            <Link href="#progress-history" className="hover:text-foreground">
              {navLiftLabel} Progress
            </Link>
            <Link href="#strength-potential" className="hover:text-foreground">
              {navLiftLabel} Potential
            </Link>
            <Link href="#recent-sessions" className="hover:text-foreground">
              {navLiftLabel} Sessions
            </Link>
            <Link href="#video-guides" className="hover:text-foreground">
              Videos
            </Link>
            <Link href="#lift-prs" className="hover:text-foreground">
              Rep PRs
            </Link>
            <Link href="#lift-faq" className="hover:text-foreground">
              FAQ
            </Link>
            <Link href="#related-articles" className="hover:text-foreground">
              Related Articles
            </Link>
          </nav>
        </PageHeaderDescription>
        <PageHeaderRight>
          <div className="w-32 md:w-auto md:max-w-[10vw]">
            <img
              src={bigFourDiagrams[liftInsightData.liftType]}
              alt={`${liftInsightData.liftType} Diagram`}
              className="mx-auto"
            />
          </div>
        </PageHeaderRight>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="col-span-3" id="strength-standards">
          <StrengthLevelsCard liftType={liftInsightData.liftType} />
        </div>
        {/* <div className="col-span-3 flex flex-col gap-6 lg:flex-row"> */}
        <div className="col-span-3 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-stretch">
          <div id="progress-history">
            <LiftJourneyCard liftType={liftInsightData.liftType} />
          </div>
          <SanityArticleCard article={introductionArticle} />
          <div className="flex flex-col gap-6 lg:h-full">
            <SanityArticleCard
              article={resourcesArticle}
              className="lg:flex-1"
            />
            <div id="strength-potential">
              <StrengthPotentialBarChart liftType={liftInsightData.liftType} />
            </div>
          </div>
        </div>
        {prioritizeVideoGuides && (
          <div className="col-span-3" id="video-guides">
            <VideoCard
              liftType={liftInsightData.liftType}
              videos={liftInsightData.videos}
            />
          </div>
        )}
        <div className="col-span-3" id="recent-sessions">
          <MostRecentSessionCard key={liftInsightData.liftType} liftType={liftInsightData.liftType} />
        </div>
        <div className="col-span-3">
          <VisualizerMini liftType={liftInsightData.liftType} />
        </div>
        <div className="col-span-3">
          <TonnageChart liftType={liftInsightData.liftType} />
        </div>
        <div className="col-span-3">
          <LiftQuoteCard
            title={liftInsightData.quoteSectionTitle}
            quote={liftInsightData.liftQuote}
            author={liftInsightData.liftQuoteAuthor}
          />
        </div>
        <div className="col-span-3">
          <VisualizerReps liftType={liftInsightData.liftType} />
        </div>
        <div className="col-span-3" id="lift-prs">
          <MyLiftTypePRsCard liftType={liftInsightData.liftType} />
        </div>
        {!prioritizeVideoGuides && (
          <div className="col-span-3" id="video-guides">
            <VideoCard
              liftType={liftInsightData.liftType}
              videos={liftInsightData.videos}
            />
          </div>
        )}
      </div>
      {liftInsightData.faqItems?.length > 0 && (
        <section className="mt-10" id="lift-faq">
          <h2 className="mb-4 text-xl font-semibold">
            {liftInsightData.liftType} FAQ
          </h2>
          <div className="space-y-4">
            {liftInsightData.faqItems.map(({ question, answer }) => (
              <article key={question} className="rounded-lg border p-4">
                <h3 className="text-base font-semibold">{question}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{renderAnswer(answer)}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      <section id="related-articles">
        <RelatedArticles articles={relatedArticles} />
      </section>
    </PageContainer>
  );
}


/**
 * Card displaying the authenticated user's all-time PR table for a specific lift type.
 * Returns null for unauthenticated users.
 * @param {Object} props
 * @param {string} props.liftType - The lift type to display PRs for (e.g. "Back Squat").
 */
function MyLiftTypePRsCard({ liftType }) {
  const { status: authStatus } = useSession();

  if (authStatus !== "authenticated") return null;

  // FIXME: add a skeleton loader

  return (
    <Card>
      <CardContent className="pt-6">
        {authStatus === "authenticated" ? (
          <LiftTypeRepPRsDisplay liftType={liftType} />
        ) : (
          <div>Login to see your data</div>
        )}
      </CardContent>
    </Card>
  );
}

const DARK_THEMES = [
  "dark",
  "neo-brutalism-dark",
  "retro-arcade-dark",
  "starry-night-dark",
];

/**
 * Card rendering a Sanity CMS article's title and rich-text body using PortableText, with
 * dark-mode prose inversion support.
 * @param {Object} props
 * @param {Object} props.article - Sanity article object with at least `title` and `body` fields.
 * @param {string} [props.className] - Optional additional CSS classes for the card.
 */
function SanityArticleCard({ article, className }) {
  const { resolvedTheme } = useTheme();
  const isDarkTheme = DARK_THEMES.includes(resolvedTheme ?? "");
  return (
    <Card className={className}>
      <CardHeader>
        <h2 className="text-2xl font-semibold leading-none tracking-tight">{article.title}</h2>
      </CardHeader>
      <CardContent className={cn("prose prose-orange", isDarkTheme && "prose-invert")}>
        <PortableText value={article.body} components={components} />
      </CardContent>
    </Card>
  );
}

function HowStrong({ liftType }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-semibold leading-none tracking-tight">How Strong Should My {liftType} Be?</h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p>
          The barbell squat is one of the most effective exercises for building
          strength and muscle mass. The amount of weight you should be able to
          squat depends on your body weight, fitness level, and experience with
          the exercise.
        </p>
        <p>
          As a general guideline, a beginner should be able to squat their body
          weight for 5 reps, an intermediate lifter should be able to squat 1.5
          times their body weight for 5 reps, and an advanced lifter should be
          able to squat 2 times their body weight for 5 reps.
        </p>
        <p>
          {`On the chart below you can visualize your strength level by clicking
          the checkbox for "Show Bodyweight Multiples" or "Show Strength
          Standards"`}
        </p>
      </CardContent>
    </Card>
  );
}

const LIFT_CALC_URLS = {
  "Back Squat": "/calculator/squat-1rm-calculator",
  "Bench Press": "/calculator/bench-press-1rm-calculator",
  "Deadlift": "/calculator/deadlift-1rm-calculator",
  "Strict Press": "/calculator/strict-press-1rm-calculator",
};

/**
 * @param {Object} props
 * @param {string} props.liftType - The lift type to display strength levels for (e.g. "Deadlift").
 */
function StrengthLevelsCard({ liftType }) {
  const { standards, isMetric, age, bodyWeight, sex } = useAthleteBio();
  const { topLiftsByTypeAndReps } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const calcUrl = LIFT_CALC_URLS[liftType];

  let strengthRating = null;
  let isBeyondElite = false;
  if (authStatus === "authenticated") {
    const topLifts = topLiftsByTypeAndReps?.[liftType];
    const bioForDateRating = age && bodyWeight != null && sex != null
      ? { age, bodyWeight, sex, isMetric }
      : null;
    const stats = getTopLiftStats(topLifts, liftType, standards, "Brzycki", bioForDateRating);
    strengthRating = stats.strengthRating;
    if (strengthRating === "Elite") {
      const nativeUnitType = topLiftsByTypeAndReps?.[liftType]?.[0]?.[0]?.unitType ?? (isMetric ? "kg" : "lb");
      const toDisplay = (w) => getDisplayWeight({ weight: w, unitType: nativeUnitType }, isMetric).value;
      const userMax = Math.max(
        stats.bestE1RM > 0 ? toDisplay(stats.bestE1RM) : 0,
        stats.bestWeight > 0 ? toDisplay(stats.bestWeight) : 0,
      );
      isBeyondElite = userMax > (standards?.[liftType]?.elite ?? Infinity);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-semibold leading-none tracking-tight">{liftType} Strength Standards</h2>
        {strengthRating && (
          <CardDescription>
            My lifetime {liftType} level:{" "}
            {isBeyondElite
              ? <>{STRENGTH_LEVEL_EMOJI.Elite} Beyond Elite</>
              : <>{STRENGTH_LEVEL_EMOJI[strengthRating] ?? ""} {strengthRating}</>
            }
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-0">
        <StandardsSlider
          liftType={liftType}
          standards={standards}
          isMetric={isMetric}
          hideRating
        />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <AthleteBioInlineSettings />
        {calcUrl && (
          <Link
            href={calcUrl}
            className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
          >
            {liftType} 1RM Calculator →
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}

function LiftQuoteCard({ title, quote, author }) {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="py-8">
        <blockquote className="space-y-4">
          {title && (
            <div className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {title}
            </div>
          )}
          <p className="text-xl leading-relaxed italic text-foreground md:text-2xl">
            &ldquo;{quote}&rdquo;
          </p>
          <footer className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {author}
          </footer>
        </blockquote>
      </CardContent>
    </Card>
  );
}

/**
 * Card displaying one or more embedded YouTube video guides for a specific lift type.
 * @param {Object} props
 * @param {string} props.liftType - The lift type name, used in the card heading.
 * @param {string[]} props.videos - Array of YouTube embed URLs to render as iframes.
 */
function VideoCard({ liftType, videos }) {
  return (
    <Card className="">
      <CardHeader>
        <h2 className="text-2xl font-semibold leading-none tracking-tight">{liftType} Video Guides</h2>
      </CardHeader>
      <CardContent>
        <div className="flex h-fit flex-col gap-8 lg:flex-row">
          {videos.map((videoUrl, index) => (
            <div key={index} className="aspect-video max-h-80 flex-1">
              <iframe
                src={videoUrl}
                title={`YouTube video player ${index}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
              ></iframe>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const components = {
  types: {
    image: ({ value }) => {
      if (!value?.asset?._ref) {
        return null;
      }

      // These will be in article images. These will be portrait landscpe so go slightly wider than higher
      const imageUrl = urlFor(value)
        .width(600)
        .height(400)
        .fit("clip")
        .quality(80)
        .auto("format")
        .url();

      return (
        <div className="relative my-8 h-96 w-full">
          <Image
            src={imageUrl}
            alt={value.alt || " "}
            fill
            style={{ objectFit: "contain" }}
          />
        </div>
      );
    },
  },
};
