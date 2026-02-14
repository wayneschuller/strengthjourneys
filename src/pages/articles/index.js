// File: pages/articles/index.js
import { useState } from "react";
import Head from "next/head";
import { sanityIOClient } from "@/lib/sanity-io.js";
import { ArticleSummaryCard } from "@/components/article-cards";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { LibraryBig } from "lucide-react";

const pageTitle = "Strength and Lifting Articles Library";
const siteName = "Strength Journeys";
const description = `Browse our collection of strength, lifting and fitness articles on various topics. Updated regularly with the latest insights and information.`;
const canonicalUrl = "https://www.strengthjourneys.xyz/articles";
const REGULAR_ARTICLES_PAGE_SIZE = 6;
const MAX_REGULAR_ARTICLES = 12;

export async function getStaticProps() {
  const articles = await sanityIOClient.fetch(`
    *[_type == "post" && publishedAt < now()] | order(publishedAt desc) {
      title,
      "slug": slug.current,
      publishedAt,
        categories[]-> {
        title
      },
      mainImage,
      description,
    }
  `);

  const featuredArticles = articles?.filter((article) =>
    article.categories?.some(
      (category) => category.title === "Featured Articles",
    ),
  );

  const regularArticles = articles?.filter(
    (article) =>
      !article.categories?.some(
        (category) => category.title === "Featured Articles",
      ),
  );

  return {
    props: {
      featuredArticles,
      regularArticles,
    },
    revalidate: 60 * 60, // Revalidate every hour
  };
}

export default function ArticleListingPage({
  featuredArticles,
  regularArticles,
}) {
  const fullTitle = `${pageTitle} | ${siteName}`;
  const cappedRegularArticles = regularArticles.slice(0, MAX_REGULAR_ARTICLES);
  const [visibleRegularArticlesCount, setVisibleRegularArticlesCount] = useState(
    REGULAR_ARTICLES_PAGE_SIZE,
  );
  const hasMoreRegularArticles =
    visibleRegularArticlesCount < cappedRegularArticles.length;
  const remainingRegularArticles = Math.max(
    cappedRegularArticles.length - visibleRegularArticlesCount,
    0,
  );

  function handleLoadMoreRegularArticles() {
    setVisibleRegularArticlesCount(
      (currentCount) => currentCount + REGULAR_ARTICLES_PAGE_SIZE,
    );
  }

  return (
    <PageContainer>
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta
          property="og:image"
          content="https://www.strengthjourneys.xyz/strength_journeys_articles_og.png"
        />
        <meta
          property="og:image:alt"
          content="Strength Journeys Article Library - Strength and Lifting Topics"
        />

        {/* To avoid Google Search Console complaints about quotes, we use dodgilySetInnerHTML */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              mainEntity: {
                "@type": "ItemList",
                itemListElement: [
                  ...featuredArticles,
                  ...cappedRegularArticles,
                ].map(
                  (article, index) => ({
                    "@type": "ListItem",
                    position: index + 1,
                    item: {
                      "@type": "Article",
                      url: `${canonicalUrl}/${article.slug}`,
                      headline: article.title,
                      author: "Strength Journeys Staff",
                      datePublished: article.publishedAt,
                    },
                  }),
                ),
              },
              name: pageTitle,
              description: description,
              url: canonicalUrl,
            }),
          }}
        />
      </Head>
      <PageHeader>
        <PageHeaderHeading icon={LibraryBig}>{pageTitle}</PageHeaderHeading>
        <PageHeaderDescription>
          Browse our collection of strength, lifting and fitness articles on
          various topics.
        </PageHeaderDescription>
      </PageHeader>

      {featuredArticles.length > 0 && (
        <>
          <section className="mb-8">
            <div className="mb-4">
              <h2 className="text-2xl font-bold tracking-tight">
                Editor’s Picks: Featured Articles
              </h2>
              <p className="text-muted-foreground">
                Our top-curated insights to inspire your strength journey.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {featuredArticles.map((article) => (
                <ArticleSummaryCard key={article.slug} article={article} />
              ))}
            </div>
          </section>
        </>
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-bold tracking-tight">
            Explore All Articles
          </h2>
          <p className="text-muted-foreground">
            Dive into our full library of strength, lifting, and fitness topics.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {cappedRegularArticles.map((article, index) => (
            <div
              key={article.slug}
              className={index < visibleRegularArticlesCount ? "" : "hidden"}
            >
              <ArticleSummaryCard article={article} />
            </div>
          ))}
        </div>
        {hasMoreRegularArticles && (
          <div className="mt-6 flex justify-center">
            <Button onClick={handleLoadMoreRegularArticles} variant="outline">
              Load More Articles ({remainingRegularArticles} remaining)
            </Button>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
