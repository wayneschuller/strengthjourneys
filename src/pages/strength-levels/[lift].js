import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { NextSeo } from "next-seo";
import { BicepsFlexed, BookOpen, Calculator, CircleDashed } from "lucide-react";

import { AthleteBioSliderSettings } from "@/components/athlete-bio-quick-settings";
import { RelatedArticles } from "@/components/article-cards";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { QuickLinkCard } from "@/components/quick-link-card";
import { getLiftSvgPath } from "@/components/year-recap/lift-svg";
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
import { Button } from "@/components/ui/button";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
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
      caption: "Bench press standards for males aged 20–29 (kg)",
      rows: [
        { bw: 68, active: 50, beginner: 70, intermediate: 90, advanced: 110, elite: 130 },
        { bw: 79, active: 50, beginner: 70, intermediate: 90, advanced: 110, elite: 150 },
        { bw: 91, active: 52, beginner: 73, intermediate: 93, advanced: 114, elite: 161 },
        { bw: 102, active: 55, beginner: 77, intermediate: 99, advanced: 121, elite: 170 },
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
      caption: "Squat standards for males aged 20–29 (kg)",
      rows: [
        { bw: 68, active: 46, beginner: 78, intermediate: 104, advanced: 143, elite: 189 },
        { bw: 79, active: 51, beginner: 87, intermediate: 116, advanced: 160, elite: 210 },
        { bw: 91, active: 58, beginner: 98, intermediate: 130, advanced: 179, elite: 236 },
        { bw: 102, active: 57, beginner: 98, intermediate: 131, advanced: 180, elite: 232 },
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
      caption: "Deadlift standards for males aged 20–29 (kg)",
      rows: [
        { bw: 68, active: 64, beginner: 112, intermediate: 139, advanced: 186, elite: 207 },
        { bw: 79, active: 76, beginner: 131, intermediate: 164, advanced: 219, elite: 243 },
        { bw: 91, active: 83, beginner: 144, intermediate: 180, advanced: 240, elite: 266 },
        { bw: 102, active: 84, beginner: 146, intermediate: 182, advanced: 243, elite: 270 },
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
      caption: "Strict press standards for males aged 20–29 (kg)",
      rows: [
        { bw: 68, active: 28, beginner: 39, intermediate: 51, advanced: 62, elite: 82 },
        { bw: 79, active: 31, beginner: 43, intermediate: 55, advanced: 68, elite: 89 },
        { bw: 91, active: 35, beginner: 49, intermediate: 63, advanced: 78, elite: 102 },
        { bw: 102, active: 36, beginner: 50, intermediate: 65, advanced: 80, elite: 105 },
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
  const interpretation = INTERPRETATION_COPY[page.liftType];
  const liftSvgPath = getLiftSvgPath(page.liftType);

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
          <div className="hidden justify-end gap-3 text-muted-foreground lg:flex lg:flex-col xl:items-end">
            <Link
              href={page.calculatorUrl}
              className="block w-full max-w-[22rem] rounded-lg border p-4 text-left shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md border bg-muted/60 p-2 text-foreground">
                  <Calculator className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">{page.navLabel} 1RM Calculator</h3>
                  <p className="text-sm">
                    Estimate your max from a recent heavy set.
                  </p>
                </div>
              </div>
            </Link>
            <Link
              href={page.insightUrl}
              className="block w-full max-w-[22rem] rounded-lg border p-4 text-left shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md border bg-muted/60 p-2 text-foreground">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">{page.navLabel} Guide</h3>
                  <p className="text-sm">
                    Go deeper with progress charts, PRs, videos, and more.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </PageHeaderRight>
      </PageHeader>

      <div className="grid gap-6">
        <Card id="strength-standards">
          <CardHeader>
            <CardTitle>{page.pageTitle} By Bodyweight</CardTitle>
            <CardDescription>
              Change your athlete settings to see the standards shift in real
              time. This is the fast way to answer whether your current max is
              beginner, intermediate, advanced, or elite.
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
            <StrengthLevelsDataCta page={page} />
          </CardContent>
        </Card>

        {interpretation && (
          <section className="overflow-hidden rounded-lg border">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="p-5 md:p-6">
                <h2 className="text-xl font-semibold">{interpretation.title}</h2>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground md:text-base">
                  {interpretation.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>

                <div className="mt-5 rounded-lg border bg-muted/30 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/80">
                    Milestones To Keep In Mind
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {interpretation.milestones.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
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
                          <th className="px-3 py-2">BW (kg)</th>
                          <th className="px-3 py-2">Active</th>
                          <th className="px-3 py-2">Beginner</th>
                          <th className="px-3 py-2">Inter.</th>
                          <th className="px-3 py-2">Advanced</th>
                          <th className="px-3 py-2">Elite</th>
                        </tr>
                      </thead>
                      <tbody>
                        {interpretation.exampleTable.rows.map((row) => (
                          <tr key={row.bw} className="border-b last:border-0">
                            <td className="px-3 py-2 font-medium">{row.bw}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.active}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.beginner}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.intermediate}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.advanced}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.elite}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      {interpretation.exampleTable.caption}. Based on{" "}
                      <a
                        href="https://lonkilgore.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-1 underline-offset-2 hover:text-foreground"
                      >
                        Professor Lon Kilgore&apos;s research
                      </a>
                      . Use the interactive tool above for personalised results.
                    </p>
                  </div>
                )}

                <p className="mt-5 text-sm text-muted-foreground md:text-base">
                  {interpretation.closer}
                </p>
              </div>

              <div className="flex items-center justify-center border-t bg-muted/20 p-6 lg:border-l lg:border-t-0">
                {liftSvgPath ? (
                  <div className="flex h-40 w-40 items-center justify-center rounded-2xl border bg-background/80 p-4 shadow-sm md:h-48 md:w-48">
                    <Image
                      src={liftSvgPath}
                      alt={`${page.navLabel} illustration`}
                      width={160}
                      height={160}
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-lg border p-4" id="lift-faq">
          <h2 className="mb-4 text-xl font-semibold">{page.pageTitle} FAQ</h2>
          <div className="space-y-4">
            {page.faqItems.map(({ question, answer }) => (
              <article key={question} className="rounded-lg border p-4">
                <h3 className="text-base font-semibold">{question}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">
            Browse Other Strength Standards
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STRENGTH_STANDARDS_PAGES.filter((p) => p.slug !== page.slug).map(
              (other) => (
                <Link
                  key={other.slug}
                  href={getStrengthStandardsUrl(other.slug)}
                  className="rounded-lg border p-3 text-center transition-colors hover:bg-muted"
                >
                  <span className="text-sm font-semibold">
                    {other.navLabel}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Strength Levels
                  </span>
                </Link>
              ),
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
  const { sheetInfo, isReturningUserLoading } = useUserLiftingData();

  if (authStatus === "authenticated" && sheetInfo?.ssid) {
    return null;
  }
  if (isReturningUserLoading) return null;

  const showSignIn = authStatus === "unauthenticated";
  const showSheetSetup = authStatus === "authenticated" && !sheetInfo?.ssid;

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

