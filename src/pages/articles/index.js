/*
 * Article library landing page (/articles). Featured articles lead as a photo
 * bento, then the newest regular articles fill page 1; older regular articles
 * continue at /articles/page/N. Content comes from content/articles/ at build.
 */
import Head from "next/head";
import { LibraryBig } from "lucide-react";

import { getPublishedArticles } from "@/lib/articles";
import {
  ArticleGrid,
  ArticlePagination,
  FeaturedArticles,
} from "@/components/article-cards";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";

const pageTitle = "Strength and Lifting Articles Library";
const siteName = "Strength Journeys";
const description = `Browse our collection of strength, lifting and fitness articles on various topics. Updated regularly with the latest insights and information.`;
const canonicalUrl = "https://www.strengthjourneys.xyz/articles";
const REGULAR_ARTICLES_PAGE_SIZE = 12;

export async function getStaticProps() {
  const articles = getPublishedArticles();
  const featuredArticles = articles.filter((article) => article.featured);
  const regularArticles = articles.filter((article) => !article.featured);
  const firstRegularArticlesPage = regularArticles.slice(0, REGULAR_ARTICLES_PAGE_SIZE);
  const totalPages = Math.max(
    Math.ceil(regularArticles.length / REGULAR_ARTICLES_PAGE_SIZE),
    1,
  );

  return {
    props: {
      featuredArticles,
      regularArticles: firstRegularArticlesPage,
      totalPages,
    },
  };
}

export default function ArticleListingPage({
  featuredArticles,
  regularArticles,
  totalPages,
}) {
  const fullTitle = `${pageTitle} | ${siteName}`;

  return (
    <PageContainer>
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        {totalPages > 1 && (
          <link rel="next" href={`${canonicalUrl}/page/2`} />
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

      <div className="pb-12">
        {featuredArticles.length > 0 && (
          <section aria-label="Featured articles" className="mb-12">
            <FeaturedArticles articles={featuredArticles} />
          </section>
        )}

        <section aria-label="Latest articles">
          <ArticleGrid articles={regularArticles} />
          <ArticlePagination page={1} totalPages={totalPages} />
        </section>
      </div>
    </PageContainer>
  );
}
