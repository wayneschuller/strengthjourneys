import { useState } from "react";
import { NextSeo } from "next-seo";
import { StartLiftingLogCard } from "@/components/onboarding/instructions-cards";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { VisualizerShadcn } from "@/components/visualizer/visualizer-shadcn";
import { TheLatestSessionCard } from "@/components/home-dashboard/the-latest-session-card";
import { BodyweightTrendCard } from "@/components/visualizer/bodyweight-trend-card";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { LineChart } from "lucide-react";

import { getRelatedArticles } from "@/lib/articles";
import { RelatedArticles } from "@/components/articles/article-cards";

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Strength Visualizer";
  const relatedArticles = getRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
  };
}

/**
 * Strength Visualizer page. Renders SEO metadata and delegates rendering to VisualizerMain.
 * @param {Object} props
 * @param {Array} props.relatedArticles - Articles related to the Strength Visualizer topic.
 */
export default function Visualizer({ relatedArticles }) {
  // OG Meta Tags
  const title = "Strength Journeys Lift Strength Visualizer";
  const canonicalURL = "https://www.strengthjourneys.xyz/visualizer";
  const ogImageURL = "https://www.strengthjourneys.xyz/og/visualizer.png";
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
          title: "Strength Visualizer: your whole lifting life on one chart",
          description:
            "Chart your estimated one rep max for every lift, from your first session to today, with meets and lifetime bests marked.",
          type: "website",
          images: [
            {
              url: ogImageURL,
              alt: "Estimated one rep max chart for squat, bench and deadlift from 2014 to 2026, with meets marked in gold",
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

/**
 * Inner client component for the Strength Visualizer page. Renders an E1RM chart alongside a session
 * analysis card so users can explore their complete strength history across all lifts.
 * @param {Object} props
 * @param {Array} props.relatedArticles - Articles to display in the related articles section.
 */
function VisualizerMain({ relatedArticles }) {
  const { dataSource } = useUserLiftingData();
  const [highlightDate, setHighlightDate] = useState(null);

  return (
    <PageContainer wide>
      <PageHeader>
        <PageHeaderHeading icon={LineChart}>
          Strength Visualizer
        </PageHeaderHeading>
        <PageHeaderDescription>
          Visualize your E1RM for every set and every lift. See your complete
          strength journey.
        </PageHeaderDescription>
      </PageHeader>
      {dataSource === "none" ? (
        <StartLiftingLogCard payoff="Your strength chart" />
      ) : (
        <section className="flex flex-col gap-5 md:flex-row">
          <div className="w-full lg:w-2/3 xl:w-3/4">
            <VisualizerShadcn setHighlightDate={setHighlightDate} />
          </div>
          <div className="w-full lg:w-1/3 xl:w-1/4">
            <TheLatestSessionCard
              highlightDate={highlightDate}
              setHighlightDate={setHighlightDate}
            />
          </div>
        </section>
      )}
      {/* Renders only for a lifter with two or more weigh-ins. */}
      <div className="mt-5">
        <BodyweightTrendCard />
      </div>
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}
