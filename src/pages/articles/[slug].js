/*
 * Single article page (/articles/[slug]) rendered from Sanity Portable Text.
 * Editorial layout: title and meta first, then a wide cover image, a readable
 * prose column whose colours come from the active theme's tokens, and a few
 * related articles to carry on with.
 */
import { PortableText } from "@portabletext/react";
import Image from "next/image";
import Head from "next/head";
import Link from "next/link";
import { motion, useScroll, useSpring } from "motion/react";
import { ArrowLeft, LibraryBig } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ArticleFeedback } from "@/components/feedback";
import { ArticleGrid } from "@/components/article-cards";
import {
  TopArticleShareButton,
  ArticleShareFooterCta,
  MobileFloatingArticleShareButton,
} from "@/components/article-share-controls";

import { sanityIOClient, urlFor } from "@/lib/sanity-io.js";

const SITE_NAME = "Strength Journeys";
const DEFAULT_OG_IMAGE_URL =
  "https://www.strengthjourneys.xyz/strength_journeys_articles_og.png";
const FEATURED_CATEGORY_TITLE = "Featured Articles";
const RELATED_ARTICLE_COUNT = 3;
const WORDS_PER_MINUTE = 230;

// UTC so the statically rendered date and the hydrated one always agree.
const ARTICLE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

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
  const canonicalUrl = `https://www.strengthjourneys.xyz/articles/${article.slug.current}`;
  const publishDate = new Date(article.publishedAt).toISOString();
  const formattedDate = ARTICLE_DATE_FORMATTER.format(new Date(article.publishedAt));
  const portableTextComponents = createPortableTextComponents(article.title);
  const readingMinutes = Math.max(
    1,
    Math.round((article.wordCount ?? 0) / WORDS_PER_MINUTE),
  );

  let coverImageUrl = null;
  let ogImageUrl = DEFAULT_OG_IMAGE_URL;

  if (article.mainImage) {
    coverImageUrl = urlFor(article.mainImage)
      .width(1600)
      .height(800)
      .fit("crop")
      .quality(85)
      .auto("format")
      .url();

    ogImageUrl = urlFor(article.mainImage)
      .width(1200)
      .height(630)
      .fit("fill")
      .quality(80)
      .auto("format")
      .url();
  }

  const description =
    article.description ??
    article.title ??
    "Strength and lifting article from Strength Journeys";
  const pageTitle = `${article.title} | ${SITE_NAME}`;
  const ogImageAlt = article.mainImage?.alt ?? article.title;
  const coverImageAlt =
    article.mainImage?.alt ??
    (article.title ? `${article.title} banner image` : "Article banner image");
  const modifiedDate = article._updatedAt
    ? new Date(article._updatedAt).toISOString()
    : null;

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
        <meta property="article:published_time" content={publishDate} />
        {modifiedDate && (
          <meta property="article:modified_time" content={modifiedDate} />
        )}

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
            datePublished: publishDate,
            ...(modifiedDate && { dateModified: modifiedDate }),
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
              <time dateTime={publishDate}>{formattedDate}</time>
              <span aria-hidden="true">·</span>
              <span>{readingMinutes} min read</span>
            </p>
            <TopArticleShareButton
              title={article.title}
              slug={article.slug.current}
              url={canonicalUrl}
            />
          </div>
        </header>

        {coverImageUrl && (
          <div className="bg-muted relative mx-auto mt-8 aspect-[16/10] max-w-5xl overflow-hidden rounded-2xl shadow-lg md:mt-10 md:aspect-[2/1]">
            <Image
              src={coverImageUrl}
              alt={coverImageAlt}
              fill
              priority
              sizes="(max-width: 1100px) 100vw, 1024px"
              placeholder={article.lqip ? "blur" : "empty"}
              blurDataURL={article.lqip ?? undefined}
              className="object-cover"
            />
          </div>
        )}

        <div
          className="prose prose-lg prose-headings:tracking-tight prose-headings:text-balance prose-h2:mt-14 prose-h2:text-3xl prose-h2:font-bold prose-h3:mt-10 prose-a:decoration-2 prose-a:underline-offset-4 prose-a:transition-colors prose-li:marker:text-muted-foreground mx-auto mt-10 max-w-3xl md:mt-14"
          style={PROSE_THEME_STYLE}
        >
          <PortableText value={article.body} components={portableTextComponents} />
          {article.footer && (
            <footer>
              <PortableText value={article.footer} components={portableTextComponents} />
            </footer>
          )}
        </div>
      </article>

      <div className="bg-muted/50 mx-auto mt-14 flex max-w-3xl flex-col gap-6 rounded-2xl border p-6 md:flex-row md:items-center md:justify-between">
        <ArticleFeedback slug={article.slug.current} />
        <ArticleShareFooterCta
          title={article.title}
          slug={article.slug.current}
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
        slug={article.slug.current}
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

const getImageLinkUrl = (url) => {
  if (typeof url !== "string") {
    return null;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return null;
  }

  if (trimmedUrl.startsWith("/")) {
    return trimmedUrl;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      return parsedUrl.href;
    }
  } catch {
    return null;
  }

  return null;
};

const isExternalUrl = (url) =>
  typeof url === "string" &&
  /^https?:\/\//i.test(url) &&
  !/^https?:\/\/(www\.)?strengthjourneys\.xyz/i.test(url);

const createPortableTextComponents = (articleTitle) => ({
  types: {
    image: ({ value }) => {
      if (!value?.asset?._ref) {
        return null;
      }

      const imageUrl = urlFor(value)
        .width(1600)
        .fit("max")
        .quality(80)
        .auto("format")
        .url();
      // Fall back to a landscape box when the query didn't carry dimensions.
      const width = value.dimensions?.width ?? 1200;
      const height = value.dimensions?.height ?? 800;
      const caption = value.caption?.trim();

      const imageLinkUrl = getImageLinkUrl(value?.url);
      const isExternalImageLink = isExternalUrl(imageLinkUrl);

      const image = (
        <Image
          src={imageUrl}
          alt={value.alt?.trim() || caption || articleTitle || "Article image"}
          width={width}
          height={height}
          sizes="(max-width: 900px) 100vw, 850px"
          placeholder={value.lqip ? "blur" : "empty"}
          blurDataURL={value.lqip ?? undefined}
          className="mx-auto h-auto max-h-[80vh] w-auto max-w-full rounded-xl border shadow-sm"
        />
      );

      return (
        <figure className="not-prose my-10 md:-mx-6">
          {imageLinkUrl ? (
            <a
              href={imageLinkUrl}
              target={isExternalImageLink ? "_blank" : undefined}
              rel={isExternalImageLink ? "noopener noreferrer" : undefined}
              className="block transition-opacity hover:opacity-90"
              aria-label={caption || value.alt || "Open image link"}
            >
              {image}
            </a>
          ) : (
            image
          )}
          {caption && (
            <figcaption className="text-muted-foreground mx-auto mt-3 max-w-2xl text-center text-sm text-pretty">
              {caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },
  block: {
    // Rendered outside prose so the typography plugin's italics and curly
    // quote marks don't fight the pull-quote styling.
    blockquote: ({ children }) => (
      <blockquote className="not-prose border-primary bg-muted/50 my-10 rounded-r-xl border-l-4 px-6 py-5 text-xl leading-relaxed font-medium text-pretty md:text-2xl">
        {children}
      </blockquote>
    ),
  },
  marks: {
    link: ({ value, children }) => {
      const href = value?.href;
      const external = isExternalUrl(href);
      return (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="decoration-primary/40 hover:decoration-primary"
        >
          {children}
        </a>
      );
    },
  },
});

export async function getStaticPaths() {
  const paths = await sanityIOClient.fetch(
    `*[_type == "post" && defined(slug.current) && publishedAt < now() && defined(body)][].slug.current`,
  );

  return {
    paths: paths.map((slug) => ({ params: { slug } })),
    // 'blocking' means Next.js will server-render the page on-demand if it's not
    // generated yet. Once rendered, the result is cached for future requests.
    // This ensures new articles are accessible without showing a loading state.
    fallback: "blocking",
  };
}

export async function getStaticProps({ params }) {
  const { slug } = params;

  const [article, libraryArticles] = await Promise.all([
    sanityIOClient.fetch(
      `*[_type == "post" && slug.current == $slug && publishedAt < now() && defined(body)][0] {
        ...,
        "lqip": mainImage.asset->metadata.lqip,
        "categoryTitles": categories[]->title,
        "wordCount": length(string::split(pt::text(body), " ")),
        body[] {
          ...,
          _type == "image" => {
            "dimensions": asset->metadata.dimensions,
            "lqip": asset->metadata.lqip
          }
        }
      }`,
      { slug },
    ),
    sanityIOClient.fetch(
      `*[_type == "post" && publishedAt < now() && defined(body) && slug.current != $slug] | order(publishedAt desc) {
        title,
        "slug": slug.current,
        publishedAt,
        mainImage,
        "lqip": mainImage.asset->metadata.lqip,
        description,
        "categoryTitles": categories[]->title
      }`,
      { slug },
    ),
  ]);

  if (!article) {
    return { notFound: true };
  }

  return {
    props: {
      article,
      relatedArticles: pickRelatedArticles(article, libraryArticles),
    },
    revalidate: 60 * 60, // Revalidate every hour, matching the listing page
  };
}

// Rank the rest of the library by how many topic categories it shares with
// this article, newest first on ties. "Featured Articles" is an editorial flag
// rather than a topic, so it doesn't count as a match.
function pickRelatedArticles(article, libraryArticles) {
  const topics = new Set(
    (article.categoryTitles ?? []).filter(
      (title) => title !== FEATURED_CATEGORY_TITLE,
    ),
  );

  return (libraryArticles ?? [])
    .map((candidate, recencyRank) => ({
      candidate,
      recencyRank,
      sharedTopics: (candidate.categoryTitles ?? []).filter((title) =>
        topics.has(title),
      ).length,
    }))
    .sort(
      (a, b) => b.sharedTopics - a.sharedTopics || a.recencyRank - b.recencyRank,
    )
    .slice(0, RELATED_ARTICLE_COUNT)
    .map(({ candidate: { categoryTitles, ...related } }) => related);
}
