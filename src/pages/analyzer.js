"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { NextSeo } from "next-seo";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { useReadLocalStorage } from "usehooks-ts";
import { Separator } from "@/components/ui/separator";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { RelatedArticles } from "@/components/article-cards";

// Here are the analyzer dashboard cards
import { SessionAnalysisCard } from "@/components/analyzer/session-analysis-card";
import { PopularLiftsAccordion } from "@/components/analyzer/lift-achievements-card";
import { ConsistencyCard } from "@/components/analyzer/consistency-card";
import { LiftTypeFrequencyPieCard } from "@/components/analyzer/lift-frequency-pie-card";
import { MonthsHighlightsCard } from "@/components/analyzer/months-highlights-card";
import { ActivityHeatmapsCard } from "@/components/analyzer/heatmap-card";
import { InspirationCard } from "@/components/analyzer/inspiration-card";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Trophy } from "lucide-react";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Personal Record Analyzer";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

export default function Analyzer({ relatedArticles }) {
  // OG Meta Tags
  const description =
    "Unlock free insights into your strength training with our PR Analyzer. Track PRs, consistency and detailed squat/bench/deadlift analysis.";
  const title = "PR Analyzer - Strength Progress Reports | Strength Journeys";
  const canonicalURL = "https://www.strengthjourneys.xyz/analyzer";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_analyzer_og.png";
  const keywords =
    "strength training, PR analyzer, workout progress, consistency tracking, monthly highlights, lifting journey, strength gains, personal records, workout heatmap, lift frequency analysis, strength progress reports, fitness data visualization";

  return (
    <>
      <NextSeo
        title={title}
        description={description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: title,
          description: description,
          type: "website",
          images: [
            {
              url: ogImageURL,
              alt: "Strength Journeys PR Analyzer",
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
            content: keywords,
          },
        ]}
      />
      {/* Keep the main component separate. I learned the hard way if it breaks server rendering you lose static metadata tags */}
      <AnalyzerMain relatedArticles={relatedArticles} />
    </>
  );
}

function AnalyzerMain({ relatedArticles }) {
  const { data: session, status: authStatus } = useSession();
  const { isLoading } = useUserLiftingData();
  const [highlightDate, setHighlightDate] = useState(null);
  const ssid = useReadLocalStorage(LOCAL_STORAGE_KEYS.SSID, {
    initializeWithValue: false,
  });

  if (!isLoading && authStatus === "authenticated" && ssid === null)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <ChooseSheetInstructionsCard session={session} />
      </div>
    );

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={Trophy}>PR Analyzer</PageHeaderHeading>
        <PageHeaderDescription>
          Unlock insights with your personalized strength dashboard. Track PRs,
          consistency, recent highlights and detailed analysis of your squat,
          bench, deadlift and more.
        </PageHeaderDescription>
      </PageHeader>
      <section className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="flex h-full min-w-full flex-col">
          <SessionAnalysisCard
            highlightDate={highlightDate}
            setHighlightDate={setHighlightDate}
          />
        </div>
        <div className="flex h-full min-w-full flex-col gap-6">
          <ConsistencyCard />
          <MonthsHighlightsCard />
        </div>
        <div className="grid h-full min-w-full gap-6">
          <div className="min-w-full">
            <InspirationCard />
          </div>
          <div className="flex h-full min-w-full flex-col">
            <LiftTypeFrequencyPieCard />
          </div>
        </div>
        <div className="col-span-full">
          <ActivityHeatmapsCard />
        </div>
        <Separator className="col-span-full" />
      </section>
      <PopularLiftsAccordion />
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}
