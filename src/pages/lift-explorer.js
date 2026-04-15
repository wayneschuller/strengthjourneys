import { useState } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { RelatedArticles } from "@/components/article-cards";
import { TopLiftsCard } from "@/components/lift-explorer/top-lifts-card";
import { LiftDetailPanel } from "@/components/lift-explorer/lift-detail-panel";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
  PageHeaderRight,
} from "@/components/page-header";
import Link from "next/link";
import { Layers } from "lucide-react";

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
 * Lift Explorer page. Renders SEO metadata and delegates rendering to the main client component.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles related to the PR Analyzer topic, fetched via ISR.
 */
export default function LiftExplorer({ relatedArticles }) {
  // OG Meta Tags
  const description =
    "Explore your full lifting history lift by lift. Select any movement to see your personal journey, records across every rep range, and training frequency at a glance.";
  const title = "Lift Explorer - Explore Your Lifting History | Strength Journeys";
  const canonicalURL = "https://www.strengthjourneys.xyz/lift-explorer";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_analyzer_og.png";
  const keywords =
    "lift explorer, strength training, personal records, lifting history, rep max, lift frequency, strength journey, PR tracker, barbell lifts, workout history";

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
              alt: "Strength Journeys Lift Explorer",
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
      <LiftExplorerMain relatedArticles={relatedArticles} />
    </>
  );
}

/**
 * Inner client component for the Lift Explorer page.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles to display in the related articles section.
 */
function LiftExplorerMain({ relatedArticles }) {
  const router = useRouter();
  const { liftTypes } = useUserLiftingData();
  const [selectedLiftType, setSelectedLiftType] = useState(null);
  const requestedLiftType =
    typeof router.query.liftType === "string" ? router.query.liftType : null;
  const requestedLiftSelection =
    requestedLiftType && liftTypes?.length
      ? liftTypes.find((lift) => lift.liftType === requestedLiftType)?.liftType ?? null
      : null;

  // null means "auto" — default to the user's most frequent lift
  const effectiveLiftType =
    selectedLiftType ?? requestedLiftSelection ?? liftTypes?.[0]?.liftType ?? null;

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={Layers}>Lift Explorer</PageHeaderHeading>
        <PageHeaderDescription>
          Explore your lifting history lift by lift. Select any movement to see
          your personal journey, records across every rep range, and how often
          you train it.
        </PageHeaderDescription>
        <PageHeaderRight>
          <div className="text-muted-foreground hidden gap-2 md:flex md:flex-col">
            <Link
              href="/log"
              className="hover:bg-muted block rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <h3 className="text-base font-semibold">Log Session</h3>
              <p className="text-sm">
                Log your workout and track sets in real time.
              </p>
            </Link>
          </div>
        </PageHeaderRight>
      </PageHeader>
      <section className="mt-4 flex flex-col gap-6 xl:flex-row">
        {/* Left: narrow lift list */}
        <div className="shrink-0 xl:w-1/5">
          <TopLiftsCard
            selectedLiftType={effectiveLiftType}
            onSelectLift={setSelectedLiftType}
          />
        </div>
        {/* Right: detail panel expands to fill remaining space */}
        <div className="min-w-0 flex-1">
          <LiftDetailPanel liftType={effectiveLiftType} />
        </div>
      </section>
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}
