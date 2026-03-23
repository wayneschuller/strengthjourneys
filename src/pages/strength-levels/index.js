import { Fragment } from "react";
import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import {
  ArrowUpRight,
  BicepsFlexed,
  BookOpen,
  Calculator,
  CircleDashed,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { RelatedArticles } from "@/components/article-cards";
import { AthleteBioSliderSettings } from "@/components/athlete-bio-quick-settings";
import {
  PageContainer,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import { QuickLinkCard } from "@/components/quick-link-card";
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
import { StandardsSlider } from "@/components/standards-slider";
import { LiftSvg } from "@/components/year-recap/lift-svg";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { fetchRelatedArticles } from "@/lib/sanity-io";
import {
  STRENGTH_STANDARDS_HUB_URL,
  STRENGTH_STANDARDS_PAGES,
  getStrengthStandardsUrl,
} from "@/lib/strength-standards-pages";

const FAQ_ITEMS = [
  {
    question: "What are strength standards?",
    answer:
      "Strength standards are benchmark lift numbers grouped into categories like beginner, intermediate, advanced, and elite. On Strength Journeys, those benchmarks adapt to bodyweight, sex, and age so the comparison is more useful than a single generic number.",
  },
  {
    question: "Are strength standards the same thing as a 1RM calculator?",
    answer:
      "No. A 1RM calculator estimates your max from a recent set. Strength standards help you interpret that estimated max relative to other lifters with a similar profile.",
  },
  {
    question: "Which lifts are covered in this cluster?",
    answer:
      "This page covers the big four barbell lifts. You can browse all four here, then open the individual lift pages if you want a more focused breakdown for one movement.",
    inlineLinks: [
      {
        href: getStrengthStandardsUrl("squat"),
        label: "Squat",
      },
      {
        href: getStrengthStandardsUrl("bench-press"),
        label: "Bench Press",
      },
      {
        href: getStrengthStandardsUrl("deadlift"),
        label: "Deadlift",
      },
      {
        href: getStrengthStandardsUrl("strict-press"),
        label: "Strict Press",
      },
    ],
  },
  {
    question: "What do strength levels like beginner, intermediate, advanced, and elite actually mean?",
    answer:
      "They are comparison buckets. Your estimated max is matched against standards for lifters with a similar age, bodyweight, and sex, so the label tells you where your lift sits on the usual progression curve rather than giving you a random pass-fail score.",
  },
  {
    question: "How does my strength level compare to the general population?",
    answer:
      "Use the How Strong Am I? calculator if you want to see how your lifting strength compares to the broader population. It is the better tool when you want a percentile-style answer instead of only seeing whether your lift lands in a beginner, intermediate, advanced, or elite bucket.",
    ctaHref: "/how-strong-am-i",
    ctaLabel: "Open How Strong Am I?",
  },
  {
    question: "How do strength standards relate to the 1000lb club?",
    answer:
      "Strength standards tell you how strong each individual lift is. The 1000lb club calculator answers a different question: whether your squat, bench press, and deadlift total has crossed one of the classic strength milestones.",
    ctaHref: "/1000lb-club-calculator",
    ctaLabel: "Open the 1000lb Club Calculator",
  },
  {
    question: "I'm already in the 1000lb club, is there a more exclusive strength level?",
    answer:
      "Yes. Once you are past the 1000lb club, one of the clearest next benchmarks is hitting the classic round-number milestones across the big four lifts. A true long-term measure of strength is stacking those 200, 300, 400, and 500 pound achievements over time. For most lifters, that is not a quick challenge but a lifelong training milestone.",
    ctaHref: "/200-300-400-500-strength-club-calculator",
    ctaLabel: "Open the 200 300 400 500 Strength Club Calculator",
  },
];

export async function getStaticProps() {
  const relatedArticles = await fetchRelatedArticles("Strength Calculator");

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

export default function StrengthStandardsHubPage({ relatedArticles }) {
  const { standards, isMetric } = useAthleteBio();
  const { getColor } = useLiftColors();
  const prefersReducedMotion = useReducedMotion();
  // GSC review 2026-03-20
  const title = "Strength Standards and Levels by Bodyweight, Age, and Sex";
  const description =
    "Compare strength standards and strength levels for squat, bench press, deadlift, and strict press by bodyweight, age, and sex, from active to elite.";
  const keywords =
    "strength standards, strength levels, strength level calculator, strength standards by bodyweight, bench press standards, squat standards, deadlift standards, overhead press standards";
  const canonicalURL = STRENGTH_STANDARDS_HUB_URL;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: title,
        applicationCategory: "HealthApplication",
        operatingSystem: "Any",
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
            item: "https://www.strengthjourneys.xyz",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Strength Levels",
            item: canonicalURL,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map(({ question, answer }) => ({
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
        title={title}
        description={description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title,
          description,
          type: "website",
          site_name: "Strength Journeys",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content: keywords,
          },
        ]}
      />
      <PageContainer>
        <PageHeader>
          <PageHeaderHeading icon={BicepsFlexed}>
            Strength Standards and Levels
          </PageHeaderHeading>
          <PageHeaderDescription>
            You are here because you want to know where you stand. These
            standards adjust for your bodyweight, sex, and age — so you get a
            real answer, not gym folklore. Pick a lift below to find yours.
          </PageHeaderDescription>
        </PageHeader>

        <div className="grid gap-6">
          <Card className="border-t-2 border-primary/40">
            <CardHeader>
              <CardTitle>Your Athlete Profile</CardTitle>
              <CardDescription>
                Adjust once — every standard on this page shifts in real time.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <AthleteBioSliderSettings />
            </CardContent>
          </Card>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {STRENGTH_STANDARDS_PAGES.map((page, index) => {
              const liftColor = getColor(page.liftType);
              return (
                <motion.div
                  key={`overview-${page.slug}`}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 24,
                    delay: prefersReducedMotion ? 0 : index * 0.1,
                  }}
                >
                  <Card className="h-full overflow-hidden">
                    <div
                      className="flex items-center justify-between gap-4 px-5 pt-5 pb-3"
                      style={{
                        background: `linear-gradient(to right, ${liftColor}20, transparent)`,
                      }}
                    >
                      <div className="min-w-0">
                        <CardTitle className="text-xl">{page.pageTitle}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {page.hubDescription}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <LiftSvg liftType={page.liftType} size="md" />
                      </div>
                    </div>
                    <CardContent className="flex flex-col gap-4 pt-3">
                      <StandardsSlider
                        liftType={page.liftType}
                        standards={standards}
                        isMetric={isMetric}
                        hideRating
                      />
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={getStrengthStandardsUrl(page.slug)}
                          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          {page.navLabel} Standards
                        </Link>
                        <Link
                          href={page.calculatorUrl}
                          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
                        >
                          <Calculator className="h-4 w-4" />
                          {page.navLabel} 1RM Calculator
                        </Link>
                        <Link
                          href={page.insightUrl}
                          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
                        >
                          <BookOpen className="h-4 w-4" />
                          {page.navLabel} Guide
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-xl font-semibold">Frequently Asked Questions</h2>
            <Accordion type="multiple">
              {FAQ_ITEMS.map(
                ({ question, answer, inlineLinks, ctaHref, ctaLabel }) => (
                  <AccordionItem key={question} value={question}>
                    <AccordionTrigger className="text-left text-base">
                      {question}
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm text-muted-foreground">
                        {answer}
                        {inlineLinks?.length ? (
                          <>
                            {" "}
                            {inlineLinks.map((link, index) => (
                              <Fragment key={link.href}>
                                {index === 0 ? null : index === inlineLinks.length - 1
                                  ? ", and "
                                  : ", "}
                                <Link
                                  href={link.href}
                                  className="font-medium text-foreground underline decoration-1 underline-offset-2 transition-colors hover:text-primary"
                                >
                                  {link.label}
                                </Link>
                              </Fragment>
                            ))}
                            .
                          </>
                        ) : null}
                        {ctaHref ? (
                          <>
                            {" "}
                            <Link
                              href={ctaHref}
                              className="font-medium text-foreground underline decoration-1 underline-offset-2 transition-colors hover:text-primary"
                            >
                              {ctaLabel}
                            </Link>
                            .
                          </>
                        ) : null}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ),
              )}
            </Accordion>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <QuickLinkCard
              href="/how-strong-am-i"
              title="How Strong Am I?"
              description="See percentile ranks across lifter populations."
              icon={<CircleDashed className="h-5 w-5" />}
            />
            <QuickLinkCard
              href="/calculator"
              title="One Rep Max Calculator"
              description="Estimate your max from a recent set."
              icon={<Calculator className="h-5 w-5" />}
            />
          </section>

          {relatedArticles?.length > 0 && (
            <RelatedArticles articles={relatedArticles} />
          )}
        </div>
      </PageContainer>
    </>
  );
}
