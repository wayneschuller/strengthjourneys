import Head from "next/head";
import Link from "next/link";
import { useAthleteBio, getTopLiftStats, STRENGTH_LEVEL_EMOJI } from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { getDisplayWeight } from "@/lib/processing-utils";
import { StandardsSlider } from "@/components/standards-slider";
import { NextSeo } from "next-seo";
import { motion } from "motion/react";
import { Crown, Shield, Skull, Luggage, Dumbbell, ExternalLink } from "lucide-react";

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
import { LiftTypeRepPRsDisplay } from "@/components/lift-explorer/lift-type-prs-display";

import { MostRecentSessionCard } from "@/components/lift-explorer/most-recent-session-card";
import { VisualizerMini } from "@/components/visualizer/visualizer-mini";
import { VisualizerReps } from "@/components/visualizer/visualizer-reps";
import { TonnageChart } from "@/components/visualizer/visualizer-tonnage";
import { StrengthPotentialBarChart } from "@/components/visualizer/strength-potential-bar-chart";
import { RelatedArticles } from "@/components/article-cards";
import { Button } from "@/components/ui/button";
import { LiftLogCta } from "@/components/lift-explorer/lift-log-cta";
import {
  SectionEyebrow,
  SectionReveal,
} from "@/components/big-four/section-reveal";
import { SingleLiftStrengthCirclesSection } from "@/components/strength-circles/single-lift-strength-circles-section";

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

import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { bigFourLiftInsightData } from "@/lib/big-four-insight-data";
import { STRENGTH_STANDARDS_LINKS } from "@/lib/strength-standards-pages";
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

  const relatedArticles = await fetchRelatedArticles(liftData.liftType);

  return {
    props: {
      liftInsightData: liftData,
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

export default function BigFourBarbellInsights({
  liftInsightData,
  relatedArticles,
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
      />
    </>
  );
}

/**
 * Inner client component for a Big Four lift insight page. Renders the full dashboard of lift-specific
 * cards: strength levels, lift journey, articles, visualizer charts, PR tables, and video guides.
 *
 * Section order still flips on whether the visitor has their own data — lifters
 * get their numbers first, anonymous visitors get the movement and the
 * editorial first — but both orders are now built from the same two blocks so
 * the two branches cannot drift apart, and every block scroll-reveals so the
 * long page reads as chapters rather than one flat column of cards.
 */
function BarbellInsightsMain({
  liftInsightData,
  relatedArticles,
}) {
  const { hasUserData } = useUserLiftingData();
  const { getColor } = useLiftColors();
  const liftType = liftInsightData.liftType;
  const liftColor = getColor(liftType);

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
  const navLiftLabel = getNavLiftLabel(liftType);

  // Personal analysis. Anonymous visitors see the same block driven by demo
  // data, so the eyebrow has to stop short of claiming the numbers are theirs.
  const analysisSections = (
    <>
      <SectionEyebrow
        eyebrow={hasUserData ? "Your data" : "See it in action"}
        title={
          hasUserData
            ? `My ${liftType} analysis`
            : `What ${liftType} tracking looks like`
        }
        color={liftColor}
      />
      {/* Even halves: the journey card is now dense enough to hold its own
          against the session list, and the log CTA reads as the natural next
          step under the sessions it would add to — rather than as a full-width
          band cutting across both columns. */}
      <SectionReveal className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div id="progress-history" className="scroll-mt-24">
          <LiftJourneyCard liftType={liftType} />
        </div>
        <div className="flex scroll-mt-24 flex-col gap-6" id="recent-sessions">
          <MostRecentSessionCard
            key={liftType}
            liftType={liftType}
            defaultVisibleCount={5}
          />
          {/* Self-hides in demo mode, so anonymous visitors never see it. */}
          <LiftLogCta liftType={liftType} />
        </div>
      </SectionReveal>
      <SectionReveal>
        <VisualizerMini liftType={liftType} />
      </SectionReveal>
      <SectionReveal id="tonnage-chart">
        <TonnageChart liftType={liftType} />
      </SectionReveal>
      <SectionReveal id="strength-circles">
        <SingleLiftStrengthCirclesSection liftType={liftType} />
      </SectionReveal>
      <SectionReveal id="strength-potential">
        <StrengthPotentialBarChart liftType={liftType} />
      </SectionReveal>
      <SectionReveal>
        <VisualizerReps liftType={liftType} />
      </SectionReveal>
      <SectionReveal id="lift-prs">
        <MyLiftTypePRsCard liftType={liftType} />
      </SectionReveal>
    </>
  );

  const editorialSections = (
    <>
      <SectionEyebrow
        eyebrow="Learn the lift"
        title={`${liftType} coaching, technique and reading`}
        color={liftColor}
      />
      <SectionReveal id="video-guides">
        <VideoCard liftType={liftType} videos={liftInsightData.videos} />
      </SectionReveal>
      <SectionReveal className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <IntroductionCard introduction={liftInsightData.introduction} />
        </div>
        <ResourcesCard resources={liftInsightData.resources} />
      </SectionReveal>
      <SectionReveal>
        <LiftQuoteCard
          title={liftInsightData.quoteSectionTitle}
          quote={liftInsightData.liftQuote}
          author={liftInsightData.liftQuoteAuthor}
        />
      </SectionReveal>
    </>
  );

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={bigFourIcons[liftType]}>
          {liftInsightData.pageTitle}
        </PageHeaderHeading>
        <PageHeaderDescription>
          <p>{liftInsightData.pageDescription}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {/* Primary action: the same log entry point the Lift Explorer uses,
                so a lifter reading their own numbers can act on them here. */}
            <Button asChild size="lg" className="h-11">
              <Link
                href={{ pathname: "/log", query: { startLift: liftType } }}
              >
                <Dumbbell className="h-5 w-5" />
                {`Log ${liftType}`}
              </Link>
            </Button>
            {STRENGTH_STANDARDS_LINKS[liftType] && (
              <Button asChild variant="outline" size="lg" className="h-11">
                <Link href={STRENGTH_STANDARDS_LINKS[liftType]}>
                  {liftType} Strength Levels →
                </Link>
              </Button>
            )}
            {liftInsightData.calculatorUrl && (
              <Button asChild variant="outline" size="lg" className="h-11">
                <Link href={liftInsightData.calculatorUrl}>
                  {liftType} 1RM Calculator →
                </Link>
              </Button>
            )}
          </div>
        </PageHeaderDescription>
        <PageHeaderRight>
          {/* Soft lift-coloured glow behind the diagram so the hero has a focal
              point instead of a flat SVG floating in whitespace. */}
          <motion.div
            className="relative w-32 md:w-auto md:max-w-[10vw]"
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.1 }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 rounded-full opacity-20 blur-3xl"
              style={{ backgroundColor: liftColor }}
            />
            <img
              src={bigFourDiagrams[liftType]}
              alt={`${liftType} Diagram`}
              className="mx-auto"
            />
          </motion.div>
        </PageHeaderRight>
      </PageHeader>

      <LiftSectionNav liftType={liftType} navLiftLabel={navLiftLabel} />

      <div className="flex flex-col gap-6 pt-6">
        <SectionReveal id="strength-standards">
          <StrengthLevelsCard liftType={liftType} />
        </SectionReveal>

        {hasUserData ? (
          <>
            {analysisSections}
            {editorialSections}
          </>
        ) : (
          <>
            {editorialSections}
            {analysisSections}
          </>
        )}

        {liftInsightData.faqItems?.length > 0 && (
          <>
            <SectionEyebrow
              eyebrow="Common questions"
              title={`${liftType} FAQ`}
              color={liftColor}
            />
            <SectionReveal as="section" id="lift-faq">
              <div className="grid gap-4 md:grid-cols-2">
                {liftInsightData.faqItems.map(({ question, answer }) => (
                  <article
                    key={question}
                    className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30"
                  >
                    <h3 className="text-base font-semibold">{question}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {renderAnswer(answer)}
                    </p>
                  </article>
                ))}
              </div>
            </SectionReveal>
          </>
        )}
      </div>
      <SectionReveal as="section" id="related-articles" className="mt-6">
        <RelatedArticles articles={relatedArticles} />
      </SectionReveal>
    </PageContainer>
  );
}

/**
 * Sticky in-page section nav.
 *
 * Lifted out of PageHeader so it can stick to the top of the viewport for the
 * whole scroll. These pages are long enough that a nav which scrolls away with
 * the header is only useful for the first screenful.
 */
function LiftSectionNav({ liftType, navLiftLabel }) {
  const sections = [
    { href: "#strength-standards", label: `${navLiftLabel} Standards` },
    { href: "#progress-history", label: `${navLiftLabel} Progress` },
    { href: "#strength-circles", label: `${navLiftLabel} Percentiles` },
    { href: "#strength-potential", label: `${navLiftLabel} Potential` },
    { href: "#recent-sessions", label: `${navLiftLabel} Sessions` },
    { href: "#video-guides", label: "Videos" },
    { href: "#lift-prs", label: "Rep PRs" },
    { href: "#lift-faq", label: "FAQ" },
    { href: "#related-articles", label: "Related Articles" },
  ];

  return (
    <nav
      aria-label={`${liftType} page sections`}
      className="sticky top-0 z-20 -mx-4 border-y border-border/40 bg-background/90 px-4 py-2.5 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="flex gap-x-4 gap-y-2 overflow-x-auto text-sm whitespace-nowrap text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="transition-colors hover:text-foreground"
          >
            {section.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/**
 * Card displaying the user's all-time PR table for a specific lift type.
 * Returns null when no user data is available.
 * @param {Object} props
 * @param {string} props.liftType - The lift type to display PRs for (e.g. "Back Squat").
 */
function MyLiftTypePRsCard({ liftType }) {
  const { hasUserData } = useUserLiftingData();

  if (!hasUserData) return null;

  // FIXME: add a skeleton loader

  return (
    <Card>
      <CardContent className="pt-6">
        <LiftTypeRepPRsDisplay liftType={liftType} />
      </CardContent>
    </Card>
  );
}

/**
 * Renders introduction content with paragraphs that can contain bold segments.
 */
function IntroductionCard({ introduction }) {
  if (!introduction) return null;
  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl font-semibold leading-none tracking-tight">
          {introduction.title}
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {introduction.paragraphs.map((para, i) => (
          <p key={i}>
            {typeof para === "string"
              ? para
              : para.map((seg, j) =>
                  typeof seg === "string" ? (
                    seg
                  ) : seg.bold ? (
                    <strong key={j}>{seg.text}</strong>
                  ) : (
                    seg.text
                  ),
                )}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Renders a list of third-party resource links with author attribution.
 */
function ResourcesCard({ resources, className }) {
  if (!resources) return null;
  return (
    <Card className={className}>
      <CardHeader>
        <h2 className="text-2xl font-semibold leading-none tracking-tight">
          {resources.title}
        </h2>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {resources.links.map((link, i) => (
            <li key={i}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                {link.text}
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
              </a>
              <span className="text-sm text-muted-foreground">
                {" "}
                — {link.author}
              </span>
              {link.note && (
                <span className="text-sm text-muted-foreground">
                  {" "}
                  ({link.note})
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * @param {Object} props
 * @param {string} props.liftType - The lift type to display strength levels for (e.g. "Deadlift").
 */
function StrengthLevelsCard({ liftType }) {
  const { standards, isMetric, age, bodyWeight, sex } = useAthleteBio();
  const { topLiftsByTypeAndReps, hasUserData } = useUserLiftingData();

  let strengthRating = null;
  let isBeyondElite = false;
  if (hasUserData) {
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
        {STRENGTH_STANDARDS_LINKS[liftType] && (
          <Link
            href={STRENGTH_STANDARDS_LINKS[liftType]}
            className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap"
          >
            {liftType} Strength Levels →
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
