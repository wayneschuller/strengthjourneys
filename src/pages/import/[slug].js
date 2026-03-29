import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import {
  CheckCircle2,
  GitMerge,
  Shield,
  Upload,
} from "lucide-react";

import { ImportWorkflowSection } from "@/components/onboarding/import-workflow-section";
import {
  PageContainer,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getImportAppPageBySlug,
  getImportAppUrl,
  IMPORT_APP_PAGES,
} from "@/lib/import-app-guides";

export async function getStaticPaths() {
  return {
    paths: IMPORT_APP_PAGES.map((page) => ({ params: { slug: page.slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const page = getImportAppPageBySlug(params.slug);

  return {
    props: {
      page,
    },
    revalidate: 60 * 60,
  };
}

function ImportAppPage({ page }) {
  const canonicalURL = getImportAppUrl(page.slug);
  const relatedPages = IMPORT_APP_PAGES.filter(
    (item) => item.slug !== page.slug,
  );
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: page.title,
        description: page.metaDescription,
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
            name: "Import",
            item: "https://www.strengthjourneys.xyz/import",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `Import ${page.appName}`,
            item: canonicalURL,
          },
        ],
      },
      {
        "@type": "HowTo",
        name: `How to export data from ${page.appName}`,
        description: page.metaDescription,
        step: page.exportSteps.map((step, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          text: step,
          name: step,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: page.faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
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
        title={page.title}
        description={page.metaDescription}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: page.title,
          description: page.metaDescription,
          type: "article",
          site_name: "Strength Journeys",
        }}
      />

      <PageContainer className="pb-16">
        <PageHeader>
          <PageHeaderHeading icon={Upload}>
            {page.heroTitle}
          </PageHeaderHeading>
          <PageHeaderDescription>
            <p>{page.hookLine}. {page.heroDescription}</p>
          </PageHeaderDescription>
        </PageHeader>

        {/* Upload area — front and center */}
        <div id="import-section">
          <ImportWorkflowSection
            title={`Import from ${page.appName}`}
          />
        </div>

        {/* Privacy badge */}
        <p className="text-muted-foreground mx-auto -mt-8 mb-10 max-w-5xl text-center text-xs">
          <Shield className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          Your preview stays in your browser. If you choose to save it,
          Strength Journeys writes it into a Google Sheet in your own Drive and
          does not keep a server-side copy.
        </p>

        <div className="mx-auto max-w-5xl space-y-8">
          {/* Why it matters + What you get — side by side */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-semibold leading-none tracking-tight">Why move your {page.appName} data?</h2>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-7">
                  {page.whyItMatters}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-semibold leading-none tracking-tight">What you get</h2>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm leading-6">
                  {page.whatYouGet.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <CheckCircle2 className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                      <span className="text-muted-foreground">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Export steps + Merge — side by side */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-semibold leading-none tracking-tight">
                  How to export from {page.appName}
                </h2>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4 text-sm leading-6">
                  {page.exportSteps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span
                        className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                        aria-label={`Step ${index + 1}`}
                      >
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-2xl font-semibold leading-none tracking-tight">{page.mergeTitle}</h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <GitMerge className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-muted-foreground text-sm leading-6">
                    {page.mergeBody}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FAQ */}
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-semibold leading-none tracking-tight">Common questions</h2>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {page.faqItems.map((item, index) => (
                  <AccordionItem value={`item-${index}`} key={item.question}>
                    <AccordionTrigger>{item.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm leading-6">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Bottom CTA — scroll to import */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <h2 className="text-lg font-semibold">
                Ready to see your {page.appName} data come alive?
              </h2>
              <Button
                onClick={() =>
                  document
                    .getElementById("import-section")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Now
              </Button>
            </CardContent>
          </Card>

          {/* Related apps */}
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-semibold leading-none tracking-tight">Importing from another app too?</h2>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {relatedPages.map((relatedPage) => (
                <Link
                  key={relatedPage.slug}
                  href={`/import/${relatedPage.slug}`}
                  className="hover:bg-muted/40 rounded-lg border p-4 transition-colors"
                >
                  <div className="mb-1 font-semibold">
                    {relatedPage.appName}
                  </div>
                  <p className="text-muted-foreground text-sm leading-6">
                    Export from {relatedPage.appName} and merge it with your
                    other training data.
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}

export default ImportAppPage;
