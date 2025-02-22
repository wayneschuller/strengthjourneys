"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { NextSeo } from "next-seo";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { useReadLocalStorage } from "usehooks-ts";
import { Separator } from "@/components/ui/separator";
import { devLog } from "@/lib/processing-utils";
import { RelatedArticles } from "@/components/article-cards";

// Here are the analyzer dashboard cards
import { SessionAnalysisCard } from "@/components/analyzer/session-analysis-card";
import { SelectedLiftsIndividualLiftCards } from "@/components/analyzer/lift-achievements-card";
import { ConsistencyCard } from "@/components/analyzer/consistency-card";
import { LiftTypeFrequencyPieCard } from "@/components/analyzer/lift-frequency-pie-card";
import { MonthsHighlightsCard } from "@/components/analyzer/months-highlights-card";
import { ActivityHeatmapsCard } from "@/components/analyzer/heatmap-card";
import { InspirationCard } from "@/components/analyzer/inspiration-card";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Trophy, Grid2x2Check } from "lucide-react";

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

export default function ConquestGrid({ relatedArticles }) {
  // OG Meta Tags
  const description =
    "Unlock free insights into your strength training with our PR Analyzer. Track PRs, consistency and detailed squat/bench/deadlift analysis.";
  const title = "PR Conquest Grid | Strength Journeys";
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
              alt: "Strength Journeys PR Conquest Grid",
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
      <ConquestGridMain relatedArticles={relatedArticles} />
    </>
  );
}

function ConquestGridMain({ relatedArticles }) {
  const { data: session, status: authStatus } = useSession();
  const { isLoading } = useUserLiftingData();
  const ssid = useReadLocalStorage("ssid");

  if (!isLoading && authStatus === "authenticated" && !ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <ChooseSheetInstructionsCard session={session} />
      </div>
    );

  return (
    <div className="container">
      <PageHeader>
        <PageHeaderHeading icon={Grid2x2Check}>
          PR Conquest Grid
        </PageHeaderHeading>
        <PageHeaderDescription>
          Track and conquer your barbell lifting PRs with the PR Conquest Map, a
          precise grid visualizing e1RM data from your Google Sheets log. Dark
          green marks achieved PRs, light green indicates guaranteed new PRs,
          and light yellow highlights probable challenges, offering a serious,
          data-driven approach to measure and expand your strength progress.
        </PageHeaderDescription>
      </PageHeader>
      <></>
      <RelatedArticles articles={relatedArticles} />
    </div>
  );
}
