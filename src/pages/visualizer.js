"use client";

import Head from "next/head";
import { useEffect, useState, useContext } from "react";
import { NextSeo } from "next-seo";
import { useSession, signIn } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { devLog } from "@/lib/processing-utils";
import { VisualizerShadcn } from "@/components/visualizer/visualizer-shadcn";
import { SessionAnalysisCard } from "@/components/analyzer/session-analysis-card";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { LineChart } from "lucide-react";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { RelatedArticles } from "@/components/article-cards";

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Strength Visualizer";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

export default function Visualizer({ relatedArticles }) {
  // OG Meta Tags
  const title = "Strength Journeys Lift Strength Visualizer";
  const canonicalURL = "https://www.strengthjourneys.xyz/visualizer";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_visualizer_og.png";
  const description =
    "Big picture visualization of your strength journey. Charted E1RMs for each lift to identify trends and show your overall progress.";
  const keywords =
    "strength visualizer, lift strength tracker, weightlifting progress, strength journey, personal record tracker, powerlifting analytics, bodybuilding progress, fitness data visualization, strength gains over time, workout progress tracker";

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
              alt: "Strength Journeys Strength Visualizer",
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
      <VisualizerMain relatedArticles={relatedArticles} />
    </>
  );
}

function VisualizerMain({ relatedArticles }) {
  const { data: session, status: authStatus } = useSession();
  const { isLoading, sheetInfo } = useUserLiftingData();
  const [highlightDate, setHighlightDate] = useState(null);

  if (!isLoading && authStatus === "authenticated" && !sheetInfo?.ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <ChooseSheetInstructionsCard session={session} />
      </div>
    );

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={LineChart}>
          Strength Visualizer
        </PageHeaderHeading>
        <PageHeaderDescription>
          Visualize your E1RM for every set and every lift. See your complete
          strength journey.
        </PageHeaderDescription>
      </PageHeader>
      <section className="flex flex-col gap-5 md:flex-row">
        <div className="w-full lg:w-1/2 xl:w-2/3">
          <VisualizerShadcn setHighlightDate={setHighlightDate} />
        </div>
        <div className="w-full lg:w-1/2 xl:w-1/3">
          <SessionAnalysisCard
            highlightDate={highlightDate}
            setHighlightDate={setHighlightDate}
          />
        </div>
      </section>
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}
