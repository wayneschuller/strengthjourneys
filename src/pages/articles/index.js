// File: pages/articles/index.js
import Head from "next/head";
import Link from "next/link";
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
const REGULAR_ARTICLES_PAGE_SIZE = 12;

function splitArticlesByFeaturedCategory(articles) {
  const featuredArticles = articles?.filter((article) =>
    article.categories?.some(
      (category) => category.title === "Featured Articles",
    ),
  ) ?? [];

  const regularArticles = articles?.filter(
    (article) =>
      !article.categories?.some(
        (category) => category.title === "Featured Articles",
      ),
  ) ?? [];

  return { featuredArticles, regularArticles };
}

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

  const { featuredArticles, regularArticles } = splitArticlesByFeaturedCategory(
    articles,
  );
  const firstRegularArticlesPage = regularArticles.slice(0, REGULAR_ARTICLES_PAGE_SIZE);
  const hasNextRegularPage = regularArticles.length > REGULAR_ARTICLES_PAGE_SIZE;

  return {
    props: {
      featuredArticles,
      regularArticles: firstRegularArticlesPage,
      hasNextRegularPage,
      nextRegularPageHref: hasNextRegularPage ? "/articles/page/2" : null,
    },
    revalidate: 60 * 60, // Revalidate every hour
  };
}

export default function ArticleListingPage({
  featuredArticles,
  regularArticles,
  hasNextRegularPage,
  nextRegularPageHref,
}) {
  const fullTitle = `${pageTitle} | ${siteName}`;

  return (
    <PageContainer>
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        {hasNextRegularPage && (
          <link
            rel="next"
            href={`https://www.strengthjourneys.xyz${nextRegularPageHref}`}
          />
        )}
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

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              mainEntity: {
                "@type": "ItemList",
                itemListElement: [...featuredArticles, ...regularArticles].map(
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
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-bold tracking-tight">Explore All Articles</h2>
          <p className="text-muted-foreground">
            Dive into our full library of strength, lifting, and fitness topics.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {regularArticles.map((article) => (
            <ArticleSummaryCard key={article.slug} article={article} />
          ))}
        </div>

        {hasNextRegularPage && nextRegularPageHref && (
          <div className="mt-6 flex justify-center">
            <Button asChild variant="outline">
              <Link href={nextRegularPageHref}>Browse Older Articles (Page 2)</Link>
            </Button>
          </div>
        )}
      </section>
    </PageContainer>
  );
}
