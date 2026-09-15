/*
 * Single article page (/articles/[slug]) rendered from a markdown file in
 * content/articles/, turned into HTML at build time by src/lib/articles.js.
 * Editorial layout: title and meta first, then a wide cover image, a readable
 * prose column whose colours come from the active theme's tokens, and a few
 * related articles to carry on with. Fully static: a new or edited article
 * goes live with the deploy that carries it.
 */
import Image from "next/image";
import Head from "next/head";
import Link from "next/link";
import { motion, useScroll, useSpring } from "motion/react";
import { ArrowLeft, LibraryBig } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ArticleFeedback } from "@/components/feedback";
import { ArticleGrid, formatArticleDate } from "@/components/article-cards";
import {
  TopArticleShareButton,
  ArticleShareFooterCta,
  MobileFloatingArticleShareButton,
} from "@/components/article-share-controls";

import { getArticleBySlug, getPublishedArticles } from "@/lib/articles";

const SITE_NAME = "Strength Journeys";
const SITE_URL = "https://www.strengthjourneys.xyz";
const RELATED_ARTICLE_COUNT = 3;
const WORDS_PER_MINUTE = 230;

// The typography plugin ships its own grey palette. Pointing its variables at
// the theme tokens keeps article text correct in every theme pack, light or
// dark, without a `prose-invert` toggle.
const PROSE_THEME_STYLE = {
  "--tw-prose-body": "var(--foreground)",
  "--tw-prose-headings": "var(--foreground)",
  "--tw-prose-lead": "var(--muted-foreground)",
  "--tw-prose-links": "var(--foreground)",
  "--tw-prose-bold": "var(--foreground)",
  "--tw-prose-counters": "var(--muted-foreground)",
  "--tw-prose-bullets": "var(--muted-foreground)",
  "--tw-prose-hr": "var(--border)",
  "--tw-prose-quotes": "var(--foreground)",
  "--tw-prose-quote-borders": "var(--border)",
  "--tw-prose-captions": "var(--muted-foreground)",
  "--tw-prose-code": "var(--foreground)",
};

export default function ArticlePost({ article, relatedArticles }) {
  const canonicalUrl = `${SITE_URL}/articles/${article.slug}`;
  const readingMinutes = Math.max(
    1,
    Math.round(article.wordCount / WORDS_PER_MINUTE),
  );

  const ogImageUrl = `${SITE_URL}${article.cover}`;
  const description = article.description ?? article.title;
  const pageTitle = `${article.title} | ${SITE_NAME}`;
  const ogImageAlt = article.coverAlt ?? article.title;
  const coverImageAlt = article.coverAlt ?? `${article.title} banner image`;

  return (
    <div className="px-4 pb-16 sm:px-6">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={article.title} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:alt" content={ogImageAlt} />
        <meta property="og:description" content={description} />
        <meta property="article:published_time" content={article.publishedAt} />
        <meta property="article:modified_time" content={article.updatedAt} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={canonicalUrl} />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImageUrl} />
        <meta name="twitter:image:alt" content={ogImageAlt} />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description,
            datePublished: article.publishedAt,
            dateModified: article.updatedAt,
            url: canonicalUrl,
            mainEntityOfPage: canonicalUrl,
            image: ogImageUrl,
            author: {
              "@type": "Organization",
              name: "Strength Journeys Staff",
            },
            publisher: {
              "@type": "Organization",
              name: "Strength Journeys",
              logo: {
                "@type": "ImageObject",
                url: "https://www.strengthjourneys.xyz/nav_logo_light.png",
              },
            },
          })}
        </script>
      </Head>

      <ReadingProgressBar />

      <article>
        <header className="mx-auto max-w-3xl pt-2 md:pt-6">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground -ml-3 rounded-full"
          >
            <Link href="/articles">
              <ArrowLeft className="size-4" />
              All articles
            </Link>
          </Button>

          <h1 className="mt-6 text-4xl leading-[1.08] font-bold tracking-tighter text-balance md:text-5xl lg:text-6xl">
            {article.title}
          </h1>

          {article.description && (
            <p className="text-muted-foreground mt-5 text-lg leading-relaxed text-pretty md:text-xl">
              {article.description}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-4 border-y py-3">
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
              <time dateTime={article.publishedAt}>
                {formatArticleDate(article.publishedAt)}
              </time>
              <span aria-hidden="true">·</span>
              <span>{readingMinutes} min read</span>
            </p>
            <TopArticleShareButton
              title={article.title}
              slug={article.slug}
              url={canonicalUrl}
            />
          </div>
        </header>

        <div className="bg-muted relative mx-auto mt-8 aspect-[16/10] max-w-5xl overflow-hidden rounded-2xl shadow-lg md:mt-10 md:aspect-[2/1]">
          <Image
            src={article.cover}
            alt={coverImageAlt}
            fill
            priority
            sizes="(max-width: 1100px) 100vw, 1024px"
            className="object-cover"
            style={
              article.coverFocus ? { objectPosition: article.coverFocus } : undefined
            }
          />
        </div>

        {/* Built from the article's own markdown at build time; raw HTML in the
            source is dropped by the renderer, so this is not user input. */}
        <div
          className="prose prose-lg prose-headings:tracking-tight prose-headings:text-balance prose-h2:mt-14 prose-h2:text-3xl prose-h2:font-bold prose-h3:mt-10 prose-a:decoration-2 prose-a:underline-offset-4 prose-a:transition-colors prose-li:marker:text-muted-foreground mx-auto mt-10 max-w-3xl md:mt-14"
          style={PROSE_THEME_STYLE}
          dangerouslySetInnerHTML={{ __html: article.html }}
        />
      </article>

      <div className="bg-muted/50 mx-auto mt-14 flex max-w-3xl flex-col gap-6 rounded-2xl border p-6 md:flex-row md:items-center md:justify-between">
        <ArticleFeedback slug={article.slug} />
        <ArticleShareFooterCta
          title={article.title}
          slug={article.slug}
          url={canonicalUrl}
        />
      </div>

      {relatedArticles?.length > 0 && (
        <section
          aria-label="More articles"
          className="mx-auto mt-16 max-w-6xl border-t pt-12"
        >
          <ArticleGrid articles={relatedArticles} titleAs="h3" />
        </section>
      )}

      <div className="mt-10 flex justify-center">
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/articles">
            <LibraryBig className="size-4" />
            Browse the Strength and Lifting Articles Library
          </Link>
        </Button>
      </div>

      <MobileFloatingArticleShareButton
        title={article.title}
        slug={article.slug}
        url={canonicalUrl}
      />
    </div>
  );
}

// Thin bar pinned to the top of the viewport that fills as the reader scrolls.
function ReadingProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden="true"
      className="bg-primary fixed inset-x-0 top-0 z-50 h-1 origin-left"
      style={{ scaleX }}
    />
  );
}

export async function getStaticPaths() {
  return {
    paths: getPublishedArticles().map((article) => ({
      params: { slug: article.slug },
    })),
    // Every published article is prerendered; anything else is a 404.
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const article = getArticleBySlug(params.slug);

  return {
    props: {
      article,
      relatedArticles: pickRelatedArticles(article, getPublishedArticles()),
    },
  };
}

// Rank the rest of the library by how many topic categories it shares with
// this article, newest first on ties.
function pickRelatedArticles(article, libraryArticles) {
  const topics = new Set(article.categories);

  return libraryArticles
    .filter((candidate) => candidate.slug !== article.slug)
    .map((candidate, recencyRank) => ({
      candidate,
      recencyRank,
      sharedTopics: candidate.categories.filter((title) => topics.has(title)).length,
    }))
    .sort(
      (a, b) => b.sharedTopics - a.sharedTopics || a.recencyRank - b.recencyRank,
    )
    .slice(0, RELATED_ARTICLE_COUNT)
    .map(({ candidate }) => candidate);
}
