/*
 * Article cards for the article library and for "related articles" blocks on
 * tool pages. The library leads with photo-forward tiles, so every card draws
 * the article's cover from public/ (see src/lib/articles.js), cropped to fit
 * with its optional coverFocus point kept in frame.
 */
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  FileText,
  Newspaper,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// The typography plugin ships its own grey palette. Pointing its variables at
// the theme tokens keeps article and changelog text correct in every theme pack, light or
// dark, without a `prose-invert` toggle.
export const PROSE_THEME_STYLE = {
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

// UTC so the statically rendered date and the hydrated one always agree,
// whatever timezone the build server or the reader happens to be in.
const articleDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatArticleDate(publishedAt) {
  return articleDateFormatter.format(new Date(publishedAt));
}

/**
 * Photo-forward bento of featured articles. The first article leads as a large
 * tile and the rest fill in around it.
 *
 * @param {Object} props
 * @param {Array<Object>} props.articles - Article summaries with slug, title,
 *   publishedAt, description, cover and optional coverFocus/coverAlt.
 */
export function FeaturedArticles({ articles }) {
  if (!articles?.length) return null;
  const [leadArticle, ...otherArticles] = articles;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      <ArticleReveal index={0} className="md:col-span-2 lg:row-span-2">
        <FeaturedArticleTile article={leadArticle} isLead />
      </ArticleReveal>
      {otherArticles.map((article, index) => {
        // An odd count leaves one tile alone on the two-column layout, so let
        // it stretch across rather than sit beside an empty gap.
        const isLonelyLastTile =
          otherArticles.length % 2 === 1 && index === otherArticles.length - 1;
        return (
          <ArticleReveal
            key={article.slug}
            index={index + 1}
            className={cn(isLonelyLastTile && "md:col-span-2 lg:col-span-1")}
          >
            <FeaturedArticleTile article={article} />
          </ArticleReveal>
        );
      })}
    </div>
  );
}

/**
 * Responsive grid of article summary cards.
 *
 * @param {Object} props
 * @param {Array<Object>} props.articles - Article summaries from src/lib/articles.js.
 */
export function ArticleGrid({ articles, titleAs }) {
  if (!articles?.length) return null;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, index) => (
        <ArticleReveal key={article.slug} index={index}>
          <ArticleSummaryCard article={article} titleAs={titleAs} />
        </ArticleReveal>
      ))}
    </div>
  );
}

/**
 * Card linking to an article: cover image on top, then date, title and a
 * clamped description so cards in a row keep a tidy rhythm.
 *
 * @param {Object} props
 * @param {Object} props.article - Article summary with slug, title, publishedAt,
 *   description, cover and optional coverFocus/coverAlt.
 * @param {string} [props.titleAs="h2"] - Heading element for the title. Use a
 *   lower level where the cards sit under another page's own h2 sections, so
 *   they don't muddy that page's heading outline.
 */
export function ArticleSummaryCard({ article, titleAs: TitleTag = "h2" }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      prefetch={false}
      className="group focus-visible:ring-ring block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Card className="flex h-full flex-col overflow-hidden transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-xl">
        <div className="bg-muted relative aspect-[16/9] overflow-hidden">
          <ArticleCoverImage
            article={article}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 420px"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <time
            dateTime={article.publishedAt}
            className="text-muted-foreground text-sm"
          >
            {formatArticleDate(article.publishedAt)}
          </time>
          <TitleTag className="text-lg leading-snug font-semibold text-balance">
            {article.title}
          </TitleTag>
          {article.description && (
            <p className="text-muted-foreground line-clamp-3 text-sm text-pretty">
              {article.description}
            </p>
          )}
          <div className="mt-auto flex justify-end pt-2">
            <span className="bg-muted text-foreground group-hover:bg-primary group-hover:text-primary-foreground flex size-8 items-center justify-center rounded-full transition-colors duration-300">
              <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/**
 * Numbered pagination for the article library. Page 1 lives at /articles and
 * later pages at /articles/page/N.
 *
 * @param {Object} props
 * @param {number} props.page - Current page, 1-based.
 * @param {number} props.totalPages - Total number of library pages.
 */
export function ArticlePagination({ page, totalPages }) {
  if (!totalPages || totalPages < 2) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav
      aria-label="Article library pages"
      className="mt-12 flex flex-wrap items-center justify-center gap-2"
    >
      {page > 1 && (
        <Button asChild variant="ghost" className="rounded-full">
          <Link href={buildArticlePageHref(page - 1)}>
            <ArrowLeft className="size-4" />
            Newer
          </Link>
        </Button>
      )}
      {pages.map((pageNumber) => (
        <Button
          key={pageNumber}
          asChild
          size="icon"
          variant={pageNumber === page ? "default" : "outline"}
          className="rounded-full"
        >
          <Link
            href={buildArticlePageHref(pageNumber)}
            aria-current={pageNumber === page ? "page" : undefined}
          >
            {pageNumber}
          </Link>
        </Button>
      ))}
      {page < totalPages && (
        <Button asChild variant="ghost" className="rounded-full">
          <Link href={buildArticlePageHref(page + 1)}>
            Older
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      )}
    </nav>
  );
}

export function buildArticlePageHref(page) {
  return page === 1 ? "/articles" : `/articles/page/${page}`;
}

/**
 * Row of related articles with links, shown on tool and lift guide pages.
 *
 * @param {Object} props
 * @param {Array<{slug: string, title: string, publishedAt: string, cover: string}>} props.articles - Article summaries.
 */
export function RelatedArticles({ articles }) {
  if (!articles || articles.length === 0) return null;
  // Four fill one row on a wide screen.
  const limitedArticles = articles.slice(0, 4);

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Newspaper className="mr-2" />
          Related Articles
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 items-center justify-center gap-4 md:grid-cols-3 xl:grid-cols-4">
          {limitedArticles.map((article) => (
            <div key={article.slug} className="group h-full rounded-lg border">
              <Link
                prefetch={false}
                href={`/articles/${article.slug}`}
                className="hover:bg-muted flex h-full items-center justify-center rounded-md p-2 align-middle transition-colors duration-200"
              >
                <FileText className="group-hover:text-primary mr-3 h-10 text-gray-400" />
                <span className="group-hover:text-primary mr-3 w-2/3 flex-grow text-balance">
                  {article.title}
                  <div className="text-muted-foreground">
                    {formatArticleDate(article.publishedAt)}
                  </div>
                </span>
                <ArticleImage article={article} className="w-28" />
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Large or medium featured tile: the photo fills the tile and a dark gradient
// keeps the white title legible on any image, in every theme.
function FeaturedArticleTile({ article, isLead = false }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      prefetch={false}
      className="group focus-visible:ring-ring block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Card
        className={cn(
          "relative flex h-full flex-col justify-end overflow-hidden bg-neutral-900 shadow-md transition-shadow duration-300 group-hover:shadow-2xl",
          isLead ? "min-h-[24rem] md:min-h-[28rem]" : "min-h-[15rem]",
        )}
      >
        <ArticleCoverImage
          article={article}
          sizes={
            isLead
              ? "(max-width: 768px) 100vw, (max-width: 1024px) 100vw, 66vw"
              : "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          }
          priority={isLead}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/5 transition-opacity duration-300 group-hover:from-black/95"
        />
        <div
          className={cn(
            "relative flex flex-col gap-2 text-white",
            isLead ? "p-6 md:p-8" : "p-5",
          )}
        >
          <time dateTime={article.publishedAt} className="text-sm text-white/75">
            {formatArticleDate(article.publishedAt)}
          </time>
          <h2
            className={cn(
              "leading-tight font-bold text-balance drop-shadow-sm",
              isLead ? "text-2xl md:text-4xl" : "text-lg md:text-xl",
            )}
          >
            {article.title}
          </h2>
          {article.description && (
            <p
              className={cn(
                "text-pretty text-white/85",
                isLead
                  ? "line-clamp-3 max-w-2xl text-base md:text-lg"
                  : "line-clamp-2 text-sm",
              )}
            >
              {article.description}
            </p>
          )}
          {isLead && (
            <span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors duration-300 group-hover:bg-white/90">
              Read the article
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}

// Fill-mode cover image cropped to its box, keeping the article's coverFocus
// point in frame. Alt text stays descriptive so the covers keep their
// image-search relevance.
function ArticleCoverImage({ article, sizes, priority = false }) {
  return (
    <Image
      src={article.cover}
      alt={article.coverAlt || `${article.title} article image`}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      style={article.coverFocus ? { objectPosition: article.coverFocus } : undefined}
    />
  );
}

// Staggered spring entrance, skipped for readers who prefer reduced motion.
// Deliberately a slide with no fade: an opacity-0 start would ship the library's
// main content hidden in the server HTML and hold back the LCP image until
// hydration, which costs SEO for a purely decorative flourish.
function ArticleReveal({ index, className, children }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn("h-full", className)}
      initial={prefersReducedMotion ? false : { y: 16 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 26,
        delay: prefersReducedMotion ? 0 : Math.min(index, 6) * 0.05,
      }}
    >
      {children}
    </motion.div>
  );
}

// Small cropped square thumbnail used by the compact RelatedArticles rows.
const ArticleImage = ({ article, className }) => {
  return (
    <div
      className={cn(
        "relative w-full transform justify-center overflow-hidden rounded-lg transition-transform duration-300 group-hover:scale-110",
        "aspect-[3/1] md:aspect-square md:max-w-[150px]",
        className,
      )}
    >
      <Image
        src={article.cover}
        alt={article.coverAlt || `${article.title} article image`}
        width={600}
        height={600}
        sizes="(max-width: 768px) 100vw, 150px"
        className="h-full w-full object-cover"
        style={article.coverFocus ? { objectPosition: article.coverFocus } : undefined}
      />
    </div>
  );
};
