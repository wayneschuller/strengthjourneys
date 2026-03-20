import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { BicepsFlexed, Calculator, CircleDashed, LineChart } from "lucide-react";

import { RelatedArticles } from "@/components/article-cards";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import {
  PageContainer,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderRight,
} from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchRelatedArticles } from "@/lib/sanity-io";
import {
  STRENGTH_STANDARDS_BIG_FOUR_URL,
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
      "This cluster currently focuses on the big four barbell lifts: squat, bench press, deadlift, and strict press, plus a combined big four standards page.",
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
  const title = "Strength Standards by Bodyweight, Age, and Sex";
  const description =
    "Browse strength standards for squat, bench press, deadlift, and overhead press. Check beginner, intermediate, advanced, and elite benchmarks by bodyweight, age, and sex, then compare them to your estimated 1RM.";
  const keywords =
    "strength standards, strength levels, strength standards by bodyweight, strength calculator, bench press standards, squat standards, deadlift standards, overhead press standards";
  const canonicalURL = STRENGTH_STANDARDS_HUB_URL;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: title,
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
            name: "Strength Standards",
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
            Strength Standards
          </PageHeaderHeading>
          <PageHeaderDescription>
            Browse benchmark pages for squat, bench press, deadlift, and
            strict press. These standards are designed for the question most
            lifters actually ask: how strong is this lift for someone like me?
          </PageHeaderDescription>
          <PageHeaderRight>
            <div className="hidden gap-2 text-muted-foreground md:flex md:flex-col xl:flex-row">
              <Link
                href={STRENGTH_STANDARDS_BIG_FOUR_URL}
                className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
              >
                <h3 className="text-base font-semibold">Big Four Standards</h3>
                <p className="text-sm">
                  See all four lifts together on one standards page.
                </p>
              </Link>
              <Link
                href="/calculator"
                className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
              >
                <h3 className="text-base font-semibold">1RM Calculator</h3>
                <p className="text-sm">
                  Estimate a max, then come back here for context.
                </p>
              </Link>
            </div>
          </PageHeaderRight>
        </PageHeader>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Personalise The Standards</CardTitle>
              <CardDescription>
                Your age, sex, and bodyweight change the benchmark. Use your
                real profile rather than comparing against anonymous gym myths.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <AthleteBioInlineSettings />
            </CardContent>
          </Card>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {STRENGTH_STANDARDS_PAGES.map((page) => (
              <Card key={page.slug} className="h-full">
                <CardHeader>
                  <CardTitle>{page.pageTitle}</CardTitle>
                  <CardDescription>{page.intro}</CardDescription>
                </CardHeader>
                <CardContent className="flex h-full flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    {page.supportingCopy}
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Link
                      href={getStrengthStandardsUrl(page.slug)}
                      className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Open {page.navLabel} Standards
                    </Link>
                    <Link
                      href={page.calculatorUrl}
                      className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
                    >
                      {page.navLabel} 1RM Calculator
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <InfoCard
              title="Use Standards For Context"
              description="Strength standards tell you what a lift means. They turn an isolated number into a category like beginner, intermediate, advanced, or elite."
              icon={<BicepsFlexed className="h-5 w-5" />}
            />
            <InfoCard
              title="Use Calculators For Estimates"
              description="A 1RM calculator is still the cleanest way to estimate your max from a recent hard set. The two tools complement each other."
              icon={<Calculator className="h-5 w-5" />}
            />
            <InfoCard
              title="Use Insight Pages For Depth"
              description="If you want charts, PR history, videos, and richer lift-by-lift guidance, the older insight pages are still the deeper destination."
              icon={<LineChart className="h-5 w-5" />}
            />
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="mb-4 text-xl font-semibold">Strength Standards FAQ</h2>
            <div className="space-y-4">
              {FAQ_ITEMS.map(({ question, answer }) => (
                <article key={question} className="rounded-lg border p-4">
                  <h3 className="text-base font-semibold">{question}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{answer}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <QuickLinkCard
              href={STRENGTH_STANDARDS_BIG_FOUR_URL}
              title="Big Four Standards"
              description="Check all four benchmark lifts on one page."
              icon={<BicepsFlexed className="h-5 w-5" />}
            />
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

function InfoCard({ title, description, icon }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground">
        {description}
      </CardContent>
    </Card>
  );
}

function QuickLinkCard({ href, title, description, icon }) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground">
          {description}
        </CardContent>
      </Card>
    </Link>
  );
}
