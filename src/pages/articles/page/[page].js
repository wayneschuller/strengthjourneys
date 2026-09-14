/*
 * Article library archive pages (/articles/page/N, N >= 2). Carries on the
 * regular article list from /articles; featured articles only appear there.
 */
import Head from "next/head";
import { LibraryBig } from "lucide-react";

import { getPublishedArticles } from "@/lib/articles";
import {
  ArticleGrid,
  ArticlePagination,
  buildArticlePageHref,
} from "@/components/article-cards";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";

const siteName = "Strength Journeys";
const pageTitleBase = "Strength and Lifting Articles Library";
const description =
  "Browse older strength, lifting and fitness articles from the Strength Journeys archive.";
const siteBaseUrl = "https://www.strengthjourneys.xyz";
const REGULAR_ARTICLES_PAGE_SIZE = 12;

// Featured articles only appear on /articles, so the archive pages carry on
// through the regular list.
function getRegularArticles() {
  return getPublishedArticles().filter((article) => !article.featured);
}

export async function getStaticPaths() {
  const regularArticles = getRegularArticles();
  const totalPages = Math.ceil(regularArticles.length / REGULAR_ARTICLES_PAGE_SIZE);

  return {
    paths: Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => ({
      params: { page: String(index + 2) },
    })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const page = Number.parseInt(params.page, 10);

  if (!Number.isInteger(page) || page < 2) {
    return { notFound: true };
  }

  const regularArticles = getRegularArticles();
  const totalPages = Math.ceil(regularArticles.length / REGULAR_ARTICLES_PAGE_SIZE);

  if (page > totalPages) {
    return { notFound: true };
  }

  const startIndex = (page - 1) * REGULAR_ARTICLES_PAGE_SIZE;
  const pageArticles = regularArticles.slice(
    startIndex,
    startIndex + REGULAR_ARTICLES_PAGE_SIZE,
  );

  return {
    props: {
      page,
      totalPages,
      pageArticles,
      startIndex,
    },
  };
}

export default function ArticleArchivePage({
  page,
  totalPages,
  pageArticles,
  startIndex,
}) {
  const pageTitle = `${pageTitleBase} - Page ${page} | ${siteName}`;
  const canonicalHref = buildArticlePageHref(page);
  const canonicalUrl = `${siteBaseUrl}${canonicalHref}`;
  const prevHref = page > 1 ? buildArticlePageHref(page - 1) : null;
  const nextHref = page < totalPages ? buildArticlePageHref(page + 1) : null;

  return (
    <PageContainer>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        {prevHref && <link rel="prev" href={`${siteBaseUrl}${prevHref}`} />}
        {nextHref && <link rel="next" href={`${siteBaseUrl}${nextHref}`} />}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta
          property="og:image"
          content="https://www.strengthjourneys.xyz/strength_journeys_articles_og.png"
        />
        <meta
          property="og:image:alt"
          content="Strength Journeys article archive pages"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CollectionPage",
              name: `${pageTitleBase} - Page ${page}`,
              description,
              url: canonicalUrl,
              isPartOf: {
                "@type": "CollectionPage",
                url: `${siteBaseUrl}/articles`,
                name: pageTitleBase,
              },
              mainEntity: {
                "@type": "ItemList",
                itemListElement: pageArticles.map((article, index) => ({
                  "@type": "ListItem",
                  position: startIndex + index + 1,
                  item: {
                    "@type": "Article",
                    url: `${siteBaseUrl}/articles/${article.slug}`,
                    headline: article.title,
                    author: "Strength Journeys Staff",
                    datePublished: article.publishedAt,
                  },
                })),
              },
            }),
          }}
        />
      </Head>

      <PageHeader>
        <PageHeaderHeading icon={LibraryBig}>{pageTitleBase}</PageHeaderHeading>
        <PageHeaderDescription>
          More strength, lifting, and fitness articles from the library, page{" "}
          {page} of {totalPages}.
        </PageHeaderDescription>
      </PageHeader>

      <section aria-label={`Articles, page ${page}`} className="pb-12">
        <ArticleGrid articles={pageArticles} />
        <ArticlePagination page={page} totalPages={totalPages} />
      </section>
    </PageContainer>
  );
}
