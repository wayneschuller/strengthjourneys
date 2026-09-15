/**
 * /progress-guide/[lift]: the one page for any lift.
 *
 * Every curated lift in the registry (src/lib/lifts/) is built at deploy, and
 * each shows whatever that lift has: strength standards and percentiles for
 * the big four, technique cues and a tutorial video for coached lifts, and the
 * full editorial guide where one has been written. A section a lift lacks is
 * simply absent, so writing content is the only step needed to add it.
 *
 * Any other lift a lifter logs resolves here too, by its slugified name. Those
 * pages render on first request, carry noindex, and read the lift name back out
 * of the lifter's own data, because the server has never heard of it.
 *
 * Section order flips on whether the visitor has data for this lift: lifters
 * get their numbers first, everyone else gets the movement first.
 */

import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { motion } from "motion/react";
import { ChevronLeft, ExternalLink, Layers, Plus } from "lucide-react";

import { InlineMarkdown, inlineMarkdownToText } from "@/components/inline-markdown";
import {
  useAthleteBio,
  getTopLiftStats,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { getDisplayWeight } from "@/lib/processing-utils";
import { getRelatedArticles } from "@/lib/articles";
import { extractYouTubeVideoId } from "@/lib/video-thumbnails";
import {
  CURATED_LIFTS,
  SITE_URL,
  getCuratedLiftBySlug,
  getStrengthLevelsPath,
  isLiftGuideIndexable,
  slugifyLiftType,
} from "@/lib/lifts/lift-registry";
import { StandardsSlider } from "@/components/standards-slider";
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
import { TonnageChart } from "@/components/visualizer/visualizer-tonnage";
import { StrengthPotentialBarChart } from "@/components/visualizer/strength-potential-bar-chart";
import { RelatedArticles } from "@/components/article-cards";
import { Button } from "@/components/ui/button";
import { LiftLogCta } from "@/components/lift-explorer/lift-log-cta";
import { LiftGuideNoHistory } from "@/components/lift-explorer/lift-guide-no-history";
import {
  SectionReveal,
} from "@/components/big-four/section-reveal";
import { SingleLiftStrengthCirclesSection } from "@/components/strength-circles/single-lift-strength-circles-section";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { getLiftArtwork } from "@/components/lift-artwork";
import { getLiftIcon } from "@/components/lift-icon";

// A lifter's own lift names become URL slugs, so anything that could not have
// come out of slugifyLiftType is a stray URL and gets a real 404.
const UNCURATED_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_UNCURATED_SLUG_LENGTH = 80;

export async function getStaticPaths() {
  return {
    // A lift file without a usable slug gets no page instead of a failed build.
    paths: CURATED_LIFTS.filter((lift) => text(lift.slug)).map((lift) => ({
      params: { lift: lift.slug },
    })),
    // Uncurated lifts render on first request and stay cached until the next
    // deploy. They are noindex and never prerendered, so never in the sitemap.
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  const lift = getCuratedLiftBySlug(params.lift);

  if (!lift) {
    const slug = params.lift;
    if (
      slug.length > MAX_UNCURATED_SLUG_LENGTH ||
      !UNCURATED_SLUG_PATTERN.test(slug)
    ) {
      return { notFound: true };
    }
    return { props: { lift: null, slug, relatedArticles: [] } };
  }

  // Articles are tagged with the Big Four only, so a variant or accessory lift
  // borrows the articles of its parent lift, then of the lift its strength
  // standards are measured against.
  const relatedArticles =
    [lift.liftType, lift.parentLift?.liftType, lift.coaching?.standardsRef?.liftType]
      .filter((liftType) => text(liftType))
      .map((liftType) => getRelatedArticles(liftType))
      .find((articles) => articles.length > 0) ?? [];

  return {
    props: { lift, slug: lift.slug, relatedArticles },
  };
}

/**
 * @param {Object} props
 * @param {Object|null} props.lift - The registry entry, or null for an uncurated lift.
 * @param {string} props.slug - The URL slug.
 * @param {Array} props.relatedArticles - Articles tagged with this lift.
 */
export default function LiftProgressGuide({ lift, slug, relatedArticles }) {
  if (!lift) return <UncuratedLiftGuide slug={slug} />;
  return <CuratedLiftGuide lift={lift} relatedArticles={relatedArticles} />;
}

/**
 * SEO wrapper for a registry lift. Keep the main component separate: if it
 * breaks server rendering, the static metadata tags still ship.
 */
function CuratedLiftGuide({ lift, relatedArticles }) {
  const page = readGuideLift(lift);
  const { liftType, coaching, faqItems } = page;
  const canonicalURL = `${SITE_URL}/progress-guide/${page.slug}`;
  const isIndexable = isLiftGuideIndexable(lift);

  const seoTitle =
    page.seoTitle ?? `${liftType} Technique and Progress Tracker`;
  const description =
    page.description ??
    `${coaching?.summary ? `${coaching.summary} ` : ""}Technique cues, a tutorial video, and free ${liftType} progress tracking with E1RM charts, rep PRs and tonnage.`;
  const ogImageURL = `${SITE_URL}${page.ogImage ?? "/strength_journeys_analyzer_og.png"}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: seoTitle,
        description,
        url: canonicalURL,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: seoTitle,
            item: canonicalURL,
          },
        ],
      },
      ...(faqItems.length
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faqItems.map(({ question, answer }) => ({
                "@type": "Question",
                name: question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: inlineMarkdownToText(answer),
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
        title={seoTitle}
        description={description}
        canonical={canonicalURL}
        noindex={!isIndexable}
        openGraph={{
          url: canonicalURL,
          title: seoTitle,
          description,
          type: "website",
          images: [{ url: ogImageURL, alt: page.pageTitle ?? seoTitle }],
          site_name: "Strength Journeys",
        }}
        twitter={{
          handle: "@wayneschuller",
          site: "@wayneschuller",
          cardType: "summary_large_image",
        }}
        additionalMetaTags={
          page.keywords
            ? [{ name: "keywords", content: page.keywords }]
            : []
        }
      />
      <CuratedLiftGuideMain page={page} relatedArticles={relatedArticles} />
    </>
  );
}

/**
 * The page body for a registry lift. Both section orders are built from the
 * same blocks so they cannot drift apart, and every block scroll-reveals so a
 * long page reads as chapters rather than one flat column of cards.
 */
function CuratedLiftGuideMain({ page, relatedArticles }) {
  const { hasUserData, liftTypes } = useUserLiftingData();
  const { getColor } = useLiftColors();
  const { liftType, coaching, videos, introduction, resources, quote, faqItems } =
    page;
  const liftColor = getColor(liftType);
  const navLiftLabel = page.shortName ?? liftType;
  const strengthLevelsPath = getStrengthLevelsPath(liftType);
  const artSrc = getLiftArtwork(liftType);
  const HeaderIcon = getLiftIcon(liftType) ?? Layers;

  const hasLiftData = Boolean(
    liftTypes?.some((entry) => entry.liftType === liftType),
  );
  // The big four always show their analysis: demo data covers all four, so an
  // anonymous visitor sees it working, and the layout never jumps on load.
  const showAnalysis = page.bigFour || hasLiftData;

  const sections = [
    showAnalysis && { href: "#progress-history", label: `${navLiftLabel} Progress` },
    showAnalysis &&
      strengthLevelsPath && {
        href: "#strength-standards",
        label: `${navLiftLabel} Standards`,
      },
    showAnalysis &&
      page.bigFour && {
        href: "#strength-circles",
        label: `${navLiftLabel} Percentiles`,
      },
    showAnalysis && {
      href: "#strength-potential",
      label: `${navLiftLabel} Potential`,
    },
    showAnalysis && { href: "#recent-sessions", label: `${navLiftLabel} Sessions` },
    coaching && { href: "#technique", label: "Technique" },
    videos.length > 0 && { href: "#video-guides", label: "Videos" },
    showAnalysis && { href: "#lift-prs", label: "Rep PRs" },
    faqItems.length > 0 && { href: "#lift-faq", label: "FAQ" },
    relatedArticles?.length > 0 && {
      href: "#related-articles",
      label: "Related Articles",
    },
  ].filter(Boolean);

  const analysisSections = showAnalysis ? (
    <LiftAnalysisSections
      liftType={liftType}
      isBigFour={page.bigFour}
      strengthLevelsPath={strengthLevelsPath}
    />
  ) : (
    // No history for this lift: a log prompt for a lifter with a sheet, the
    // sign-in and import request for everyone else.
    <SectionReveal id="progress-history">
      <LiftGuideNoHistory liftType={liftType} />
    </SectionReveal>
  );

  const hasEditorial =
    coaching || videos.length > 0 || introduction || resources || quote;

  const editorialSections = hasEditorial ? (
    <>
      {coaching && (
        <SectionReveal id="technique">
          <TechniqueCard liftType={liftType} coaching={coaching} />
        </SectionReveal>
      )}
      {videos.length > 0 && (
        <SectionReveal id="video-guides">
          <VideoCard liftType={liftType} videos={videos} />
        </SectionReveal>
      )}
      {(introduction || resources) && (
        <SectionReveal className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {introduction && (
            <div className={resources ? "lg:col-span-2" : "lg:col-span-3"}>
              <IntroductionCard introduction={introduction} />
            </div>
          )}
          {resources && (
            <ResourcesCard
              resources={resources}
              className={introduction ? undefined : "lg:col-span-3"}
            />
          )}
        </SectionReveal>
      )}
      {quote && (
        <SectionReveal>
          <LiftQuoteCard
            title={quote.sectionTitle}
            quote={quote.text}
            author={quote.author}
          />
        </SectionReveal>
      )}
    </>
  ) : null;

  const lifterFirst = hasUserData && hasLiftData;

  return (
    <PageContainer>
      <BackToLiftExplorer />
      <PageHeader>
        <PageHeaderHeading icon={HeaderIcon}>
          {page.pageTitle ?? `${liftType} Guide & Progress Tracker`}
        </PageHeaderHeading>
        <PageHeaderDescription>
          <p>
            {page.description ??
              coaching?.summary ??
              `Every ${liftType} set you log, charted: your progress, your records, and how often you train it.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {/* Primary action: the same log entry point the rest of the app
                uses, so a lifter reading their own numbers can act on them. */}
            <Button asChild size="lg" className="h-11">
              <Link
                href={{ pathname: "/log", query: { startLift: liftType } }}
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
                {`Log ${liftType}`}
              </Link>
            </Button>
            {strengthLevelsPath && (
              <Button asChild variant="outline" size="lg" className="h-11">
                <Link href={strengthLevelsPath} prefetch={false}>
                  {liftType} Strength Levels →
                </Link>
              </Button>
            )}
            {page.calculatorUrl && (
              <Button asChild variant="outline" size="lg" className="h-11">
                <Link href={page.calculatorUrl} prefetch={false}>
                  {liftType} 1RM Calculator →
                </Link>
              </Button>
            )}
          </div>
        </PageHeaderDescription>
        {artSrc && (
          <PageHeaderRight>
            {/* Soft lift-coloured glow behind the diagram so the hero has a
                focal point instead of a flat drawing floating in whitespace. */}
            <motion.div
              className="relative w-40 md:w-auto md:max-w-[14vw]"
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 220,
                damping: 22,
                delay: 0.1,
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 rounded-full opacity-20 blur-3xl"
                style={{ backgroundColor: liftColor }}
              />
              <img
                src={artSrc}
                alt={`${liftType} Diagram`}
                className="mx-auto"
              />
            </motion.div>
          </PageHeaderRight>
        )}
      </PageHeader>

      <LiftSectionNav liftType={liftType} sections={sections} />

      <div className="flex flex-col gap-6 pt-6">
        {lifterFirst ? (
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

        {faqItems.length > 0 && (
          <>
            <SectionReveal as="section" id="lift-faq">
              <div className="grid gap-4 md:grid-cols-2">
                {faqItems.map(({ question, answer }) => (
                  <article
                    key={question}
                    className="bg-card hover:bg-accent/30 rounded-lg border p-4 shadow-sm transition-colors"
                  >
                    <h3 className="text-base font-semibold">{question}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      <InlineMarkdown text={answer} />
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
 * A lift that exists only in someone's data: "Dumbbell Pull Over", "Pause
 * Bench Press". The server knows only the slug, so the name is read back out of
 * the lifter's lift list, and the page is analysis alone.
 */
function UncuratedLiftGuide({ slug }) {
  const { liftTypes, parsedData, isLoading } = useUserLiftingData();

  // liftTypes arrives sorted by set count, so if two spellings share a slug
  // ("Pull-up" and "Pull Up") the one trained most wins.
  const liftType =
    liftTypes?.find((entry) => slugifyLiftType(entry.liftType) === slug)
      ?.liftType ?? null;
  // parsedData stays null until auth and the sheet fetch have both settled, so
  // it separates "still arriving" from "not in this lifter's data".
  const isResolving = isLoading || !parsedData;
  const displayName = liftType ?? titleFromSlug(slug);

  return (
    <>
      <NextSeo
        title={`${displayName} Progress | Strength Journeys`}
        description={`Your ${displayName} progress, records, and training history.`}
        noindex
      />
      <PageContainer>
        <BackToLiftExplorer />
        <PageHeader>
          <PageHeaderHeading icon={Layers}>{displayName}</PageHeaderHeading>
          <PageHeaderDescription>
            <p>
              Every {displayName} set you log, charted: your progress, your
              records, and how often you train it.
            </p>
            {liftType && (
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-11">
                  <Link
                    href={{ pathname: "/log", query: { startLift: liftType } }}
                  >
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                    {`Log ${liftType}`}
                  </Link>
                </Button>
              </div>
            )}
          </PageHeaderDescription>
        </PageHeader>

        {liftType ? (
          <div className="flex flex-col gap-6 pt-6">
            <LiftAnalysisSections liftType={liftType} isBigFour={false} />
          </div>
        ) : (
          <Card className="mt-6">
            <CardContent className="text-muted-foreground py-10 text-center">
              {isResolving ? (
                <p>Reading your lifting history…</p>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <p>This lift is not in your log yet.</p>
                  <p className="text-sm">
                    Browse everything you train in the{" "}
                    <Link
                      href="/lift-explorer"
                      className="underline underline-offset-4"
                    >
                      Lift Explorer
                    </Link>
                    .
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </>
  );
}

/**
 * The lifter's numbers for one lift. Strength circles need standards, so they
 * appear for the big four only.
 */
function LiftAnalysisSections({ liftType, isBigFour, strengthLevelsPath }) {
  return (
    <>
      {/* Even halves: the journey card is dense enough to hold its own against
          the session list, and the log CTA reads as the natural next step under
          the sessions it would add to. */}
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
      {strengthLevelsPath && (
        <SectionReveal id="strength-standards">
          <StrengthLevelsCard
            liftType={liftType}
            strengthLevelsPath={strengthLevelsPath}
          />
        </SectionReveal>
      )}
      {isBigFour && (
        <SectionReveal id="strength-circles">
          <SingleLiftStrengthCirclesSection liftType={liftType} />
        </SectionReveal>
      )}
      <SectionReveal id="strength-potential">
        <StrengthPotentialBarChart liftType={liftType} />
      </SectionReveal>
      <SectionReveal id="lift-prs">
        <MyLiftTypePRsCard liftType={liftType} />
      </SectionReveal>
    </>
  );
}

/** The Lift Explorer is the directory of every lift, so every guide leads back. */
function BackToLiftExplorer() {
  return (
    <Link
      href="/lift-explorer"
      className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
    >
      <ChevronLeft className="size-4" />
      All lifts
    </Link>
  );
}

/**
 * Sticky in-page section nav, listing only the sections this lift has.
 *
 * Lifted out of PageHeader so it can stick to the top of the viewport for the
 * whole scroll. These pages are long enough that a nav which scrolls away with
 * the header is only useful for the first screenful.
 */
function LiftSectionNav({ liftType, sections }) {
  if (sections.length < 2) return null;

  return (
    <nav
      aria-label={`${liftType} page sections`}
      className="border-border/40 bg-background/90 sticky top-0 z-20 -mx-4 border-y px-4 py-2.5 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="text-muted-foreground flex gap-x-4 gap-y-2 overflow-x-auto text-sm whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="hover:text-foreground transition-colors"
          >
            {section.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/**
 * The plain-English summary and three cues written for the log's technique
 * help, which suit a first-timer reading a guide just as well.
 */
function TechniqueCard({ liftType, coaching }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl leading-none font-semibold tracking-tight">
          {liftType} technique
        </h2>
        {coaching.summary && (
          <CardDescription className="text-base">
            {coaching.summary}
          </CardDescription>
        )}
      </CardHeader>
      {coaching.cues.length > 0 && (
        <CardContent>
          <ol className="flex flex-col gap-3">
            {coaching.cues.map((cue, index) => (
              <li key={index} className="flex gap-3">
                <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
                  {index + 1}
                </span>
                <span>{cue}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      )}
    </Card>
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
 * Renders the guide introduction; paragraphs are inline markdown.
 */
function IntroductionCard({ introduction }) {
  if (!introduction) return null;
  return (
    <Card>
      {introduction.title && (
        <CardHeader>
          <h2 className="text-2xl leading-none font-semibold tracking-tight">
            {introduction.title}
          </h2>
        </CardHeader>
      )}
      <CardContent
        className={introduction.title ? "flex flex-col gap-4" : "flex flex-col gap-4 pt-6"}
      >
        {introduction.paragraphs.map((para, i) => (
          <p key={i}>
            <InlineMarkdown text={para} />
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
      {resources.title && (
        <CardHeader>
          <h2 className="text-2xl leading-none font-semibold tracking-tight">
            {resources.title}
          </h2>
        </CardHeader>
      )}
      <CardContent className={resources.title ? undefined : "pt-6"}>
        <ul className="space-y-3">
          {resources.links.map((link, i) => (
            <li key={i}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                {link.title}
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
              </a>
              {link.author && (
                <span className="text-muted-foreground text-sm">
                  {" "}
                  — {link.author}
                </span>
              )}
              {link.note && (
                <span className="text-muted-foreground text-sm">
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
 * @param {string} props.strengthLevelsPath - The lift's /strength-levels/ page.
 */
function StrengthLevelsCard({ liftType, strengthLevelsPath }) {
  const { standards, isMetric, age, bodyWeight, sex } = useAthleteBio();
  const { topLiftsByTypeAndReps, hasUserData } = useUserLiftingData();

  let strengthRating = null;
  let isBeyondElite = false;
  if (hasUserData) {
    const topLifts = topLiftsByTypeAndReps?.[liftType];
    const bioForDateRating =
      age && bodyWeight != null && sex != null
        ? { age, bodyWeight, sex, isMetric }
        : null;
    const stats = getTopLiftStats(
      topLifts,
      liftType,
      standards,
      "Brzycki",
      bioForDateRating,
    );
    strengthRating = stats.strengthRating;
    if (strengthRating === "Elite") {
      const nativeUnitType =
        topLiftsByTypeAndReps?.[liftType]?.[0]?.[0]?.unitType ??
        (isMetric ? "kg" : "lb");
      const toDisplay = (w) =>
        getDisplayWeight({ weight: w, unitType: nativeUnitType }, isMetric)
          .value;
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
        <h2 className="text-2xl leading-none font-semibold tracking-tight">
          {liftType} Strength Standards
        </h2>
        {strengthRating && (
          <CardDescription>
            My lifetime {liftType} level:{" "}
            {isBeyondElite ? (
              <>{STRENGTH_LEVEL_EMOJI.Elite} Beyond Elite</>
            ) : (
              <>
                {STRENGTH_LEVEL_EMOJI[strengthRating] ?? ""} {strengthRating}
              </>
            )}
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
        <Link
          prefetch={false}
          href={strengthLevelsPath}
          className="text-muted-foreground hover:text-foreground text-xs whitespace-nowrap"
        >
          {liftType} Strength Levels →
        </Link>
      </CardFooter>
    </Card>
  );
}

function LiftQuoteCard({ title, quote, author }) {
  return (
    <Card className="border-l-primary border-l-4">
      <CardContent className="py-8">
        <blockquote className="space-y-4">
          {title && (
            <div className="text-muted-foreground text-sm font-semibold">
              {title}
            </div>
          )}
          <p className="text-foreground text-xl leading-relaxed italic md:text-2xl">
            &ldquo;{quote}&rdquo;
          </p>
          {author && (
            <footer className="text-muted-foreground text-sm font-medium">
              {author}
            </footer>
          )}
        </blockquote>
      </CardContent>
    </Card>
  );
}

/**
 * Every tutorial video for a lift, each embedded with its title and channel.
 * A lone video gets a wide player; several share a grid, which is what lets a
 * lift carry any number of them without the card changing shape.
 *
 * @param {Object} props
 * @param {string} props.liftType - The lift type name, used in the card heading.
 * @param {Array<{embedUrl: string, title?: string, channel?: string}>} props.videos
 */
function VideoCard({ liftType, videos }) {
  const isSingle = videos.length === 1;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-2xl leading-none font-semibold tracking-tight">
          {liftType} {isSingle ? "Video Guide" : "Video Guides"}
        </h2>
      </CardHeader>
      <CardContent>
        <div
          className={
            isSingle ? "max-w-3xl" : "grid gap-6 md:grid-cols-2 xl:grid-cols-3"
          }
        >
          {videos.map((video, index) => (
            <figure key={`${index}-${video.embedUrl}`} className="flex flex-col gap-2">
              <div className="aspect-video w-full overflow-hidden rounded-md">
                <iframe
                  src={video.embedUrl}
                  title={video.title ?? `${liftType} video guide ${index + 1}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  className="h-full w-full"
                ></iframe>
              </div>
              {video.title && (
                <figcaption className="text-muted-foreground text-sm">
                  <span className="text-foreground font-medium">
                    {video.title}
                  </span>
                  {video.channel ? ` · ${video.channel}` : ""}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The registry lift reduced to what this page can safely render. Lift files
 * are curated by hand, so a missing block, a misspelt key or a wrong type
 * should cost only the section it feeds, never the page. Every text field
 * comes back as real text or null, and every list holds only complete entries:
 * a video needs a YouTube link, a resource a title and URL, a FAQ item both
 * halves. Sections then render on what survives.
 */
function readGuideLift(lift) {
  const guide = asObject(lift.guide);
  const coaching = asObject(lift.coaching);
  const introduction = asObject(guide.introduction);
  const resources = asObject(guide.resources);
  const quote = asObject(guide.quote);

  const summary = text(coaching.summary);
  const cues = asList(coaching.cues).map(text).filter(Boolean);
  const paragraphs = asList(introduction.paragraphs).map(text).filter(Boolean);
  const links = asList(resources.links)
    .map(asObject)
    .map((link) => ({
      title: text(link.title),
      url: text(link.url),
      author: text(link.author),
      note: text(link.note),
    }))
    .filter((link) => link.title && link.url);
  const ogImage = text(guide.ogImage);

  return {
    liftType: text(lift.liftType) ?? titleFromSlug(lift.slug),
    slug: lift.slug,
    bigFour: lift.bigFour === true,
    shortName: text(lift.shortName),
    calculatorUrl: text(lift.calculatorUrl),
    seoTitle: text(guide.seoTitle),
    pageTitle: text(guide.pageTitle),
    description: text(guide.description),
    keywords: text(guide.keywords),
    ogImage: ogImage?.startsWith("/") ? ogImage : null,
    coaching: summary || cues.length > 0 ? { summary, cues } : null,
    // Every tutorial for the lift. The log shows one per session; the guide
    // shows the lot.
    videos: asList(lift.videos)
      .map(asObject)
      .map((video) => ({
        title: text(video.title),
        channel: text(video.channel),
        embedUrl: toYouTubeEmbedUrl(text(video.url)),
      }))
      .filter((video) => video.embedUrl),
    introduction:
      paragraphs.length > 0
        ? { title: text(introduction.title), paragraphs }
        : null,
    resources:
      links.length > 0 ? { title: text(resources.title), links } : null,
    quote: text(quote.text)
      ? {
          sectionTitle: text(quote.sectionTitle),
          text: text(quote.text),
          author: text(quote.author),
        }
      : null,
    faqItems: asList(guide.faqItems)
      .map(asObject)
      .map((item) => ({ question: text(item.question), answer: text(item.answer) }))
      .filter((item) => item.question && item.answer),
  };
}

/** A non-empty string, or null. */
function text(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

/** An array with its empty slots dropped, or an empty array. */
function asList(value) {
  return Array.isArray(value) ? value.filter((item) => item != null) : [];
}

/** A plain object, or an empty one to read nothing from. */
function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

/** Coaching videos are stored as watch links; iframes need the embed form. */
function toYouTubeEmbedUrl(url) {
  const id = url ? extractYouTubeVideoId(url) : null;
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

/** "pause-bench-press" -> "Pause Bench Press", until the real name loads. */
function titleFromSlug(slug) {
  return String(slug ?? "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
