import Head from "next/head";
import Link from "next/link";
import { LibraryBig } from "lucide-react";

import { sanityIOClient } from "@/lib/sanity-io.js";
import { ArticleSummaryCard } from "@/components/article-cards";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Button } from "@/components/ui/button";

const siteName = "Strength Journeys";
const pageTitleBase = "Strength and Lifting Articles Library";
const description =
  "Browse older strength, lifting and fitness articles from the Strength Journeys archive.";
const siteBaseUrl = "https://www.strengthjourneys.xyz";
const REGULAR_ARTICLES_PAGE_SIZE = 12;

function splitArticlesByFeaturedCategory(articles) {
  const regularArticles = articles?.filter(
    (article) =>
      !article.categories?.some(
        (category) => category.title === "Featured Articles",
      ),
  ) ?? [];

  return { regularArticles };
}

function buildPaginationHref(page) {
  return page === 1 ? "/articles" : `/articles/page/${page}`;
}

async function fetchArticlesForArchive() {
  return sanityIOClient.fetch(`
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
}

export async function getStaticPaths() {
  const articles = await fetchArticlesForArchive();
  const { regularArticles } = splitArticlesByFeaturedCategory(articles);
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

  const articles = await fetchArticlesForArchive();
  const { regularArticles } = splitArticlesByFeaturedCategory(articles);
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
    revalidate: 60 * 60,
  };
}

export default function ArticleArchivePage({
  page,
  totalPages,
  pageArticles,
  startIndex,
}) {
  const pageTitle = `${pageTitleBase} - Page ${page} | ${siteName}`;
  const canonicalHref = buildPaginationHref(page);
  const canonicalUrl = `${siteBaseUrl}${canonicalHref}`;
  const prevHref = page > 1 ? buildPaginationHref(page - 1) : null;
  const nextHref = page < totalPages ? buildPaginationHref(page + 1) : null;

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
          Archive page {page} of {totalPages}. Older strength, lifting, and fitness articles.
        </PageHeaderDescription>
      </PageHeader>

      <section>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Archive Page {page}</h2>
          <Link href="/articles" className="text-sm text-blue-600 hover:underline">
            Back to main article library
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {pageArticles.map((article) => (
            <ArticleSummaryCard key={article.slug} article={article} />
          ))}
        </div>

        <nav
          aria-label="Article archive pagination"
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          {prevHref && (
            <Button asChild variant="outline">
              <Link href={prevHref}>Previous Page</Link>
            </Button>
          )}
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          {nextHref && (
            <Button asChild variant="outline">
              <Link href={nextHref}>Next Page</Link>
            </Button>
          )}
        </nav>
      </section>
    </PageContainer>
  );
}
