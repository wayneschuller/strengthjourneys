import { useCallback } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { RelatedArticles } from "@/components/article-cards";
import { TopLiftsCard } from "@/components/lift-explorer/top-lifts-card";
import { LiftDetailPanel } from "@/components/lift-explorer/lift-detail-panel";
import { Card, CardContent } from "@/components/ui/card";
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
  const { liftTypes, parsedData, isLoading } = useUserLiftingData();
  const requestedLiftType =
    typeof router.query.liftType === "string" ? router.query.liftType : null;
  const requestedLiftSelection =
    requestedLiftType && liftTypes?.length
      ? liftTypes.find((lift) => lift.liftType === requestedLiftType)?.liftType ?? null
      : null;

  // No ?liftType means "auto" — default to the user's most frequent lift
  const effectiveLiftType =
    requestedLiftSelection ?? liftTypes?.[0]?.liftType ?? null;

  // The URL is the single source of truth for the selection, so a lift view is
  // shareable and the back button walks the lifts you looked at. Shallow keeps
  // the switch instant (no getStaticProps re-run) and scroll:false preserves
  // the reading position in the long detail panel.
  const handleSelectLift = useCallback(
    (liftType) => {
      if (!liftType || liftType === effectiveLiftType) return;

      router.push(
        { pathname: "/lift-explorer", query: { ...router.query, liftType } },
        undefined,
        { shallow: true, scroll: false },
      );
    },
    [effectiveLiftType, router],
  );

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
              <h3 className="text-base font-semibold">Session Explorer</h3>
              <p className="text-sm">
                Log sets and browse your sessions day by day.
              </p>
            </Link>
          </div>
        </PageHeaderRight>
      </PageHeader>
      {effectiveLiftType ? (
        <section className="mt-4 flex flex-col gap-6 xl:flex-row">
          {/* Left: narrow lift list */}
          <div className="shrink-0 xl:w-1/5">
            <TopLiftsCard
              selectedLiftType={effectiveLiftType}
              onSelectLift={handleSelectLift}
            />
          </div>
          {/* Right: detail panel expands to fill remaining space */}
          <div className="min-w-0 flex-1">
            <LiftDetailPanel liftType={effectiveLiftType} />
          </div>
        </section>
      ) : (
        // parsedData stays null until auth and the sheet fetch have both
        // settled, so it — not isLoading alone — is what separates "still
        // arriving" from "genuinely nothing logged".
        <NothingToExploreYet isResolving={isLoading || !parsedData} />
      )}
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}

/**
 * Fallback for the rare case where there is nothing to explore — a linked sheet
 * with no parseable lifts. Without it the page renders a header over blank space
 * because both the lift list and the detail panel bail out on empty data.
 *
 * @param {Object} props
 * @param {boolean} props.isResolving - True while auth/sheet data is still settling.
 */
function NothingToExploreYet({ isResolving }) {
  return (
    <Card className="mt-4">
      <CardContent className="text-muted-foreground py-10 text-center">
        {isResolving ? (
          <p>Reading your lifting history…</p>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p>No lifts to explore yet.</p>
            <p className="text-sm">
              Log a set in the{" "}
              <Link href="/log" className="underline underline-offset-4">
                Session Explorer
              </Link>{" "}
              and this page fills itself in.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
