/**
 * Lift Explorer: the directory of every lift. The big four lead as large
 * artwork tiles, the other drawn lifts follow as smaller tiles, and the rest
 * of a lifter's history sits underneath as text. Every lift links to its
 * /progress-guide/ page, which is where a single lift is explored.
 *
 * Old links carried ?liftType= to open a lift in place. Those now forward to
 * that lift's guide, keeping any other query and the hash.
 */

import { useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { Layers } from "lucide-react";

import { RelatedArticles } from "@/components/article-cards";
import { LiftGrid } from "@/components/lift-explorer/lift-grid";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
  PageHeaderRight,
} from "@/components/page-header";
import { getLiftGuidePath } from "@/lib/lifts/registry";
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
    "Browse every lift you train. The big four, a gallery of barbell lifts, and everything else in your log, sorted by volume, recency or name. Pick one to open its progress guide.";
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

  // Forward an old ?liftType= link to that lift's guide, carrying the rest of
  // the query (PR deep links use prScope and prReps) and the hash along.
  useEffect(() => {
    if (!router.isReady) return;
    const { liftType, ...rest } = router.query;
    if (typeof liftType !== "string" || !liftType) return;
    const pathname = getLiftGuidePath(liftType);
    if (!pathname) return;
    const hash = window.location.hash.replace(/^#/, "");
    router.replace({ pathname, query: rest, hash: hash || undefined });
  }, [router]);

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={Layers}>Lift Explorer</PageHeaderHeading>
        <PageHeaderDescription>
          Every lift you train, in one place. Pick one to open its progress
          guide: your records, your progress, and how to do it well.
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
      <LiftGrid />
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}
