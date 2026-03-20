import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { BicepsFlexed, BookOpen, Calculator, CircleDashed } from "lucide-react";

import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { RelatedArticles } from "@/components/article-cards";
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
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { fetchRelatedArticles } from "@/lib/sanity-io";
import {
  STRENGTH_STANDARDS_HUB_URL,
  STRENGTH_STANDARDS_PAGES,
  getStrengthStandardsPageBySlug,
  getStrengthStandardsUrl,
} from "@/lib/strength-standards-pages";

const STANDARD_LEVELS = [
  { key: "physicallyActive", label: "Physically Active" },
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
  { key: "elite", label: "Elite" },
];

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
        "@type": "WebPage",
        name: page.seoTitle,
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
            name: "Strength Standards",
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
  const standard = standards?.[page.liftType];
  const unitLabel = isMetric ? "kg" : "lb";

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
          <div className="hidden gap-2 text-muted-foreground md:flex md:flex-col xl:flex-row">
            <Link
              href={page.calculatorUrl}
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">{page.navLabel} 1RM Calculator</h3>
              <p className="text-sm">
                Estimate your max from a recent heavy set.
              </p>
            </Link>
            <Link
              href={page.insightUrl}
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">{page.navLabel} Guide</h3>
              <p className="text-sm">
                Go deeper with progress charts, PRs, videos, and more.
              </p>
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
            <AthleteBioInlineSettings />
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
          </CardContent>
        </Card>

        {standard && (
          <section className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            {STANDARD_LEVELS.map(({ key, label }) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{label}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl font-bold">
                    {standard[key]}
                    <span className="ml-1 text-base font-medium text-muted-foreground">
                      {unitLabel}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SupportCard
            title={`Use ${page.navLabel} Standards`}
            description={`Use this page when the question is "how strong is my ${page.navLabel.toLowerCase()} for someone my size?" Standards are interpretation, not estimation.`}
            icon={<BicepsFlexed className="h-5 w-5" />}
          />
          <SupportCard
            title={`Use The ${page.navLabel} Calculator`}
            description={`Use the ${page.navLabel.toLowerCase()} 1RM calculator when you want to turn a recent set into an estimated max, then return here for context.`}
            icon={<Calculator className="h-5 w-5" />}
          />
          <SupportCard
            title={`Use The ${page.navLabel} Guide`}
            description={`Use the broader ${page.navLabel.toLowerCase()} insight page when you want videos, PR history, progress charts, and training context beyond the standards alone.`}
            icon={<BookOpen className="h-5 w-5" />}
          />
        </section>

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

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <QuickLinkCard
            href="/strength-standards"
            title="Strength Standards Hub"
            description="Browse the rest of the standards cluster."
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

function SupportCard({ title, description, icon }) {
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
