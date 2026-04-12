import { Fragment } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { NextSeo } from "next-seo";
import { Anvil, BicepsFlexed, BookOpen, Calculator, CircleDashed, Disc, Mountain } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { AthleteBioSliderSettings } from "@/components/athlete-bio-quick-settings";
import { RelatedArticles } from "@/components/article-cards";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { QuickLinkCard } from "@/components/quick-link-card";
import { LiftSvg, getLiftSvgPath } from "@/components/year-recap/lift-svg";
import {
  PageContainer,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderRight,
} from "@/components/page-header";
import { StandardsSlider } from "@/components/standards-slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { fetchRelatedArticles } from "@/lib/sanity-io";
import {
  STRENGTH_STANDARDS_HUB_URL,
  STRENGTH_STANDARDS_PAGES,
  getStrengthStandardsPageBySlug,
  getStrengthStandardsUrl,
} from "@/lib/strength-standards-pages";

const INTERPRETATION_COPY = {
  "Bench Press": {
    title: "What Counts As A Good Bench Press For Your Bodyweight?",
    body: [
      "A good bench press is not a single number. The same bench can be beginner for one lifter, advanced for another, and elite for a lighter lifter with years of training behind them.",
      "That is why these bench press strength standards adjust for bodyweight, sex, and age. They answer the actual search intent behind bench standards queries: not just how much can I bench, but whether that number is strong for someone built like me.",
    ],
    milestones: [
      "Bodyweight benching is a common intermediate benchmark for many men.",
      "For many women, a bodyweight bench is already a high-level result.",
      "If 225 is your big question, the answer depends heavily on your size and training age.",
    ],
    closer:
      "Use the personalised standards above instead of generic gym folklore. They give you a better answer than any one-size-fits-all chart.",
    exampleTable: {
      caption: "Bench press standards for males aged 20–29",
      rows: [
        { bwKg: 68, bwLb: 150, active: [50, 110], beginner: [70, 155], intermediate: [90, 200], advanced: [110, 245], elite: [130, 285] },
        { bwKg: 79, bwLb: 175, active: [50, 110], beginner: [70, 155], intermediate: [90, 200], advanced: [110, 245], elite: [150, 330] },
        { bwKg: 91, bwLb: 200, active: [52, 115], beginner: [73, 160], intermediate: [93, 205], advanced: [114, 250], elite: [161, 355] },
        { bwKg: 102, bwLb: 225, active: [55, 120], beginner: [77, 170], intermediate: [99, 220], advanced: [121, 265], elite: [170, 375] },
      ],
    },
  },
  "Back Squat": {
    title: "What Counts As A Good Squat For Your Bodyweight?",
    body: [
      "A good squat depends on context. Absolute load matters, but bodyweight, sex, and age change what that load actually means.",
      "That is why squat strength standards by bodyweight are more useful than one viral benchmark. A 225 squat might be an early milestone for one person, a strong intermediate result for another, and still a stepping stone for a heavier, more experienced lifter.",
    ],
    milestones: [
      "Around bodyweight is an early milestone for many lifters.",
      "Around 1.5 times bodyweight is often where a squat starts to look properly strong.",
      "Around 2 times bodyweight usually pushes into advanced territory for many men.",
    ],
    closer:
      "If your question is 'is my squat good?' the right answer is not a single number. It is where your squat lands inside the standards for someone with your build.",
    exampleTable: {
      caption: "Squat standards for males aged 20–29",
      rows: [
        { bwKg: 68, bwLb: 150, active: [46, 100], beginner: [78, 170], intermediate: [104, 230], advanced: [143, 315], elite: [189, 415] },
        { bwKg: 79, bwLb: 175, active: [51, 110], beginner: [87, 190], intermediate: [116, 255], advanced: [160, 355], elite: [210, 465] },
        { bwKg: 91, bwLb: 200, active: [58, 130], beginner: [98, 215], intermediate: [130, 285], advanced: [179, 395], elite: [236, 520] },
        { bwKg: 102, bwLb: 225, active: [57, 125], beginner: [98, 215], intermediate: [131, 290], advanced: [180, 395], elite: [232, 510] },
      ],
    },
  },
  Deadlift: {
    title: "What Counts As A Good Deadlift For Your Bodyweight?",
    body: [
      "A good deadlift changes fast with bodyweight. Raw numbers make impressive screenshots, but they are a poor way to judge how strong a deadlift really is.",
      "That is why deadlift standards by bodyweight are so useful. A 315 deadlift can be a huge milestone, but whether it reads as beginner, intermediate, or advanced depends on who is pulling it.",
    ],
    milestones: [
      "Around 1.5 times bodyweight is a meaningful deadlift milestone for many lifters.",
      "Around 2 times bodyweight is where many deadlifts start to look strong.",
      "Around 2.5 times bodyweight can move into advanced or elite territory for many men.",
    ],
    closer:
      "Use the standards on this page to answer the question people actually mean when they search for deadlift standards: not just 'what is impressive,' but 'what is impressive for me?'",
    exampleTable: {
      caption: "Deadlift standards for males aged 20–29",
      rows: [
        { bwKg: 68, bwLb: 150, active: [64, 140], beginner: [112, 245], intermediate: [139, 305], advanced: [186, 410], elite: [207, 455] },
        { bwKg: 79, bwLb: 175, active: [76, 170], beginner: [131, 290], intermediate: [164, 360], advanced: [219, 485], elite: [243, 535] },
        { bwKg: 91, bwLb: 200, active: [83, 185], beginner: [144, 315], intermediate: [180, 395], advanced: [240, 530], elite: [266, 585] },
        { bwKg: 102, bwLb: 225, active: [84, 185], beginner: [146, 320], intermediate: [182, 400], advanced: [243, 535], elite: [270, 595] },
      ],
    },
  },
  "Strict Press": {
    title: "What Counts As A Good Strict Press For Your Bodyweight?",
    body: [
      "The overhead press climbs more slowly than the other big barbell lifts, so many lifters underestimate what counts as genuinely strong pressing.",
      "That is why strict press and overhead press standards by bodyweight matter. A press that looks modest in absolute pounds can still be advanced once bodyweight, sex, and age are factored in.",
    ],
    milestones: [
      "Around half bodyweight is an early milestone for many male lifters.",
      "A bodyweight strict press is an elite benchmark for almost everyone.",
      "If you are comparing your press to your bench, expect the category to be lower and still respectable.",
    ],
    closer:
      "These standards are built to give your press the right context instead of making it compete with lifts that naturally move more weight.",
    exampleTable: {
      caption: "Strict press standards for males aged 20–29",
      rows: [
        { bwKg: 68, bwLb: 150, active: [28, 60], beginner: [39, 85], intermediate: [51, 110], advanced: [62, 135], elite: [82, 180] },
        { bwKg: 79, bwLb: 175, active: [31, 70], beginner: [43, 95], intermediate: [55, 120], advanced: [68, 150], elite: [89, 195] },
        { bwKg: 91, bwLb: 200, active: [35, 75], beginner: [49, 110], intermediate: [63, 140], advanced: [78, 170], elite: [102, 225] },
        { bwKg: 102, bwLb: 225, active: [36, 80], beginner: [50, 110], intermediate: [65, 145], advanced: [80, 175], elite: [105, 230] },
      ],
    },
  },
};

export async function getStaticPaths() {
  return {
    paths: STRENGTH_STANDARDS_PAGES.map((page) => ({
      params: { lift: page.slug },
    })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const page = getStrengthStandardsPageBySlug(params.lift);
  const relatedArticles = await fetchRelatedArticles(page.relatedArticlesCategory);

  return {
    props: {
      page,
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

export default function StrengthStandardsLiftPage({ page, relatedArticles }) {
  const canonicalURL = `https://www.strengthjourneys.xyz${getStrengthStandardsUrl(page.slug)}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: page.seoTitle,
        applicationCategory: "HealthApplication",
        operatingSystem: "Any",
        description: page.description,
        url: canonicalURL,
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
            name: "Strength Levels",
            item: STRENGTH_STANDARDS_HUB_URL,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: page.pageTitle,
            item: canonicalURL,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: page.faqItems.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: {
            "@type": "Answer",
            text: answer,
          },
        })),
      },
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
        title={page.seoTitle}
        description={page.description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: page.seoTitle,
          description: page.description,
          type: "website",
          site_name: "Strength Journeys",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content: page.keywords,
          },
        ]}
      />
      <StrengthStandardsLiftPageMain
        page={page}
        relatedArticles={relatedArticles}
      />
    </>
  );
}

function StrengthStandardsLiftPageMain({ page, relatedArticles }) {
  const { standards, isMetric } = useAthleteBio();
  const { getColor } = useLiftColors();
  const prefersReducedMotion = useReducedMotion();
  const interpretation = INTERPRETATION_COPY[page.liftType];
  const liftColor = getColor(page.liftType);

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={BicepsFlexed}>
          {page.pageTitle}
        </PageHeaderHeading>
        <PageHeaderDescription>
          <p>{page.intro}</p>
          <p className="mt-3">{page.supportingCopy}</p>
        </PageHeaderDescription>
        <PageHeaderRight>
          <div className="hidden items-center justify-end md:flex">
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
                delay: prefersReducedMotion ? 0 : 0.2,
              }}
              className="flex items-center justify-center"
              style={{ filter: `drop-shadow(0 4px 12px ${liftColor}40)` }}
            >
              <LiftSvg
                liftType={page.liftType}
                size="lg"
                animate={false}
              />
            </motion.div>
          </div>
        </PageHeaderRight>
      </PageHeader>

      <div className="grid gap-6">
        <Card
          id="strength-standards"
          style={{ borderTopColor: liftColor, borderTopWidth: "3px" }}
        >
          <CardHeader>
            <CardTitle>Where Does Your {page.navLabel} Land?</CardTitle>
            <CardDescription>
              Drag the sliders to match your profile. Your strength level
              updates instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AthleteBioSliderSettings />
            <StandardsSlider
              liftType={page.liftType}
              standards={standards}
              isMetric={isMetric}
              ratingRightSlot={
                <Link
                  href={page.calculatorUrl}
                  className="whitespace-nowrap hover:text-foreground"
                >
                  {page.navLabel} 1RM Calculator →
                </Link>
              }
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <Link
                href={page.calculatorUrl}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {page.navLabel} 1RM Calculator
              </Link>
              <span className="hidden sm:inline" aria-hidden>·</span>
              <Link
                href={page.insightUrl}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {page.navLabel} Progress Guide
              </Link>
            </div>
            <StrengthLevelsDataCta page={page} />
          </CardContent>
        </Card>

        {interpretation && (
          <section className="overflow-hidden rounded-lg border">
            <div className="p-5 md:p-6">
              <h2
                className="border-l-4 pl-4 text-2xl font-semibold"
                style={{ borderColor: liftColor }}
              >
                {interpretation.title}
              </h2>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground md:text-base">
                {interpretation.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>

              <div className="mt-5 rounded-lg border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/80">
                  Milestones Worth Chasing
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {interpretation.milestones.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: liftColor }}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {interpretation.exampleTable && (
                <div className="mt-5 overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <caption className="sr-only">
                      {interpretation.exampleTable.caption}
                    </caption>
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70">
                        <th className="px-3 py-2">Bodyweight</th>
                        <th className="px-3 py-2">Active</th>
                        <th className="px-3 py-2">Beginner</th>
                        <th className="px-3 py-2">Inter.</th>
                        <th className="px-3 py-2">Advanced</th>
                        <th className="px-3 py-2">Elite</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interpretation.exampleTable.rows.map((row) => (
                        <tr key={row.bwKg} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">
                            <span>{row.bwLb} lb</span>
                            <span className="ml-1 text-muted-foreground">/ {row.bwKg} kg</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.active[1]} lb<span className="hidden sm:inline"> / {row.active[0]} kg</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.beginner[1]} lb<span className="hidden sm:inline"> / {row.beginner[0]} kg</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.intermediate[1]} lb<span className="hidden sm:inline"> / {row.intermediate[0]} kg</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.advanced[1]} lb<span className="hidden sm:inline"> / {row.advanced[0]} kg</span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.elite[1]} lb<span className="hidden sm:inline"> / {row.elite[0]} kg</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {interpretation.exampleTable.caption}. Values in lb<span className="hidden sm:inline"> / kg</span>.
                    Use the interactive tool above for personalised results by age, sex, and bodyweight.
                  </p>
                </div>
              )}

              <div
                className="mt-5 rounded-lg border-l-4 bg-muted/30 p-4 text-sm font-medium italic text-muted-foreground md:text-base"
                style={{ borderColor: liftColor }}
              >
                {interpretation.closer}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-lg border p-4" id="lift-faq">
          <h2 className="mb-2 text-xl font-semibold">{page.pageTitle} FAQ</h2>
          <Accordion type="multiple">
            {page.faqItems.map(({ question, answer }) => (
              <AccordionItem key={question} value={question}>
                <AccordionTrigger className="text-left text-base">
                  {question}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground">{answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Strength Club Calculators
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <QuickLinkCard
              href="/plate-milestones"
              title="Plate Milestones"
              description="Track your progress toward 1/2/3/4 plate milestones."
              icon={<Disc className="h-5 w-5" />}
            />
            <QuickLinkCard
              href="/1000lb-club-calculator"
              title="1000lb Club Calculator"
              description="See if your squat, bench, and deadlift total crosses the classic milestone."
              icon={<Anvil className="h-5 w-5" />}
            />
            <QuickLinkCard
              href="/200-300-400-500-strength-club-calculator"
              title="200/300/400/500 Club"
              description="An advanced milestone: hit 200/300/400/500 across the big four lifts."
              icon={<Mountain className="h-5 w-5" />}
            />
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">
            Explore Other Lifts
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {STRENGTH_STANDARDS_PAGES.filter((p) => p.slug !== page.slug).map(
              (other) => {
                const otherColor = getColor(other.liftType);
                return (
                  <Link
                    key={other.slug}
                    href={getStrengthStandardsUrl(other.slug)}
                    className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
                    style={{ borderColor: `${otherColor}30` }}
                  >
                    <LiftSvg liftType={other.liftType} size="sm" animate={false} />
                    <div>
                      <span className="text-sm font-semibold">
                        {other.navLabel}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Strength Levels
                      </span>
                    </div>
                  </Link>
                );
              },
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <QuickLinkCard
            href="/strength-levels"
            title="Strength Levels Hub"
            description="Browse all four lifts on one page."
            icon={<BicepsFlexed className="h-5 w-5" />}
          />
          <QuickLinkCard
            href="/how-strong-am-i"
            title="How Strong Am I?"
            description="Compare yourself to wider lifter populations."
            icon={<CircleDashed className="h-5 w-5" />}
          />
          <QuickLinkCard
            href={page.insightUrl}
            title={`${page.navLabel} Guide`}
            description="Open the broader progress-tracker page for this lift."
            icon={<BookOpen className="h-5 w-5" />}
          />
        </section>

        {relatedArticles?.length > 0 && (
          <RelatedArticles articles={relatedArticles} />
        )}
      </div>
    </PageContainer>
  );
}

function StrengthLevelsDataCta({ page }) {
  const { status: authStatus } = useSession();
  const { hasUserData, isReturningUserLoading } = useUserLiftingData();

  if (hasUserData) return null;
  if (isReturningUserLoading) return null;

  const showSignIn = authStatus === "unauthenticated";
  const showSheetSetup = authStatus === "authenticated";

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">See Your Actual Lifts Ranked</h3>
          <p className="text-sm text-muted-foreground">
            Sign in to create your free lifting log. Track your real lifts over
            time and see how your strength level stacks up against these
            standards.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {showSignIn && (
            <GoogleSignInButton
              className="flex items-center gap-2"
              cta="strength_levels_page"
              iconSize={16}
            >
              Sign In With Google
            </GoogleSignInButton>
          )}

          {showSheetSetup && (
            <Button
              className="flex items-center gap-2"
              onClick={() => {
                openSheetSetupDialog("bootstrap");
              }}
            >
              <img
                src={GOOGLE_SHEETS_ICON_URL}
                alt=""
                className="h-4 w-4 shrink-0"
                aria-hidden
              />
              Connect Google Sheet
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
