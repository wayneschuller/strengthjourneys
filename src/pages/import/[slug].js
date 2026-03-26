import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { FileSpreadsheet, GitMerge, ShieldCheck, Upload } from "lucide-react";

import { ImportWorkflowSection } from "@/components/import-workflow-section";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getImportAppPageBySlug,
  getImportAppUrl,
  IMPORT_APP_PAGES,
} from "@/lib/import-seo-pages";

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
        name: page.seoTitle,
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
            name: "Import Data",
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
        title={page.seoTitle}
        description={page.metaDescription}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: page.seoTitle,
          description: page.metaDescription,
          type: "article",
          site_name: "Strength Journeys",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content: page.keywords,
          },
        ]}
      />

      <PageContainer className="pb-16">
        <PageHeader>
          <PageHeaderHeading icon={Upload}>{page.heroTitle}</PageHeaderHeading>
          <PageHeaderDescription>
            <p>{page.heroDescription}</p>
          </PageHeaderDescription>
        </PageHeader>

        <ImportWorkflowSection
          title={`Start Importing from ${page.appName}`}
          description={`Upload your ${page.appName} export here. Strength Journeys will parse the file in your browser, let you preview it, and if you are signed in, write it into a Google Sheet you own.`}
        />

        <div className="mx-auto max-w-5xl space-y-8 px-3 sm:px-[2vw] md:px-[3vw] lg:px-[4vw] xl:px-[5vw]">
          <div className="grid gap-4 lg:grid-cols-[1.25fr,0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>
                  Turn your {page.appName} export into a sheet you own
                </CardTitle>
                <CardDescription>
                  Import CSV, XLS, or XLSX files in the browser, preview the
                  result, and store the final version in your own Google Sheet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm leading-6">
                  {page.intro}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{page.comparisonTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm leading-6">
                  {page.comparisonBullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <ShieldCheck className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                      <span className="text-muted-foreground">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>How to export data from {page.appName}</CardTitle>
                <CardDescription>
                  The practical answer: export the file, then bring it into
                  Strength Journeys so the data ends up in Google Sheets.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4 text-sm leading-6">
                  {page.exportSteps.map((step, index) => (
                    <li key={step} className="flex gap-3">
                      <span className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
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
                <CardTitle>{page.mergeTitle}</CardTitle>
                <CardDescription>
                  Strength Journeys is the bridge when your history is spread
                  across more than one app.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <GitMerge className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-muted-foreground text-sm leading-6">
                    {page.mergeBody}
                  </p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <FileSpreadsheet className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-muted-foreground text-sm leading-6">
                    The end state is simple: one owned Google Sheet, one cleaner
                    history, and one place to keep future imports instead of
                    scattered app exports.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{page.appName} import FAQ</CardTitle>
              <CardDescription>
                Short answers for the searches lifters actually make before they
                move old workout data.
              </CardDescription>
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

          <Card>
            <CardHeader>
              <CardTitle>Also importing from another app?</CardTitle>
              <CardDescription>
                Use these guides to bring multiple training histories into the
                same Strength Journeys sheet.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {relatedPages.map((relatedPage) => (
                <Link
                  key={relatedPage.slug}
                  href={`/import/${relatedPage.slug}`}
                  className="hover:bg-muted/40 rounded-lg border p-4 transition-colors"
                >
                  <div className="mb-1 font-semibold">
                    Import {relatedPage.appName} Data
                  </div>
                  <p className="text-muted-foreground text-sm leading-6">
                    See how to export {relatedPage.appName}, import it into
                    Strength Journeys, and merge it into Google Sheets.
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
