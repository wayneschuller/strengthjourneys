/*
 * Article library archive pages (/articles/page/N, N >= 2). Carries on the
 * regular article list from /articles; featured articles only appear there.
 */
import Head from "next/head";
import { LibraryBig } from "lucide-react";

import { getArticleLibraryPage } from "@/lib/articles";
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

export async function getStaticPaths() {
  const { totalPages } = getArticleLibraryPage(1);

  return {
    paths: Array.from({ length: totalPages - 1 }, (_, index) => ({
      params: { page: String(index + 2) },
    })),
    // Only real page numbers are built; anything else is a 404.
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const page = Number(params.page);
  const { articles, startIndex, totalPages } = getArticleLibraryPage(page);

  return {
    props: { page, totalPages, pageArticles: articles, startIndex },
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
