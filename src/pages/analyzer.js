import { useSession } from "next-auth/react";
import { useState } from "react";
import { NextSeo } from "next-seo";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { RelatedArticles } from "@/components/article-cards";

// Here are the analyzer dashboard cards
import { ConsistencyCard } from "@/components/analyzer/consistency-card"; // full card, not currently in use — keep
import { TopLiftsCard } from "@/components/analyzer/top-lifts-card";
import { InspirationCard } from "@/components/analyzer/inspiration-card";
import { LiftDetailPanel } from "@/components/analyzer/lift-detail-panel";
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

/**
 * PR Analyzer page. Renders SEO metadata and delegates rendering to AnalyzerMain.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles related to the PR Analyzer topic, fetched via ISR.
 */
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

/**
 * Inner client component for the PR Analyzer page. Renders the full dashboard of analyzer cards
 * (session analysis, consistency, monthly highlights, heatmaps, lift accordion) and related articles.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles to display in the related articles section.
 */
function AnalyzerMain({ relatedArticles }) {
  const { data: session, status: authStatus } = useSession();
  const { isLoading, sheetInfo, liftTypes } = useUserLiftingData();
  const [selectedLiftType, setSelectedLiftType] = useState(null);

  // null means "auto" — default to the user's most frequent lift
  const effectiveLiftType = selectedLiftType ?? liftTypes?.[0]?.liftType ?? null;

  if (!isLoading && authStatus === "authenticated" && !sheetInfo?.ssid)
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
      <section className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Col 1: pie card + inspiration */}
        <div className="flex flex-col gap-6">
          <TopLiftsCard
            selectedLiftType={effectiveLiftType}
            onSelectLift={setSelectedLiftType}
          />
          <InspirationCard />
        </div>
        {/* Cols 2–3: lift detail panel */}
        <div className="xl:col-span-2">
          <LiftDetailPanel liftType={effectiveLiftType} />
        </div>
      </section>
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}
