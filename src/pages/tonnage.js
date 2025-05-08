"use client";

import Head from "next/head";
import { useEffect, useState, useContext } from "react";
import { NextSeo } from "next-seo";
import { useSession, signIn } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { devLog } from "@/lib/processing-utils";
import { useReadLocalStorage } from "usehooks-ts";
import { VisualizerShadcn } from "@/components/visualizer/visualizer-shadcn";
import { SessionAnalysisCard } from "@/components/analyzer/session-analysis-card";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Bus } from "lucide-react";

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
  const title = "Strength Journeys Tonnage Metrics";
  const canonicalURL = "https://www.strengthjourneys.xyz/tonnage-visualizer";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_visualizer_og.png";
  const description =
    "Big picture visualization of your tonnage and weight moved over time.";
  const keywords =
    "tonnage visualizer, tonnage tracker, tonnage progress, tonnage journey, tonnage analytics";

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
              alt: "Strength Journeys Tonnage Metrics",
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
  const { isLoading } = useUserLiftingData();
  const ssid = useReadLocalStorage("ssid");
  const [highlightDate, setHighlightDate] = useState(null);

  if (!isLoading && authStatus === "authenticated" && !ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <ChooseSheetInstructionsCard session={session} />
      </div>
    );

  return (
    <div className="container">
      <PageHeader>
        <PageHeaderHeading icon={Bus}>Tonnage Metrics</PageHeaderHeading>
        <PageHeaderDescription>
          See your total weight moved over time.
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
    </div>
  );
}
