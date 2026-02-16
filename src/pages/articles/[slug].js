import { PortableText } from "@portabletext/react";
import Image from "next/image";
import Head from "next/head";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import { devLog } from "@/lib/processing-utils";
import { ArticleFeedback } from "@/components/article-feedback";
import {
  TopArticleShareButton,
  ArticleShareFooterCta,
  MobileFloatingArticleShareButton,
} from "@/components/article-share-controls";
import { format } from "date-fns";

import { sanityIOClient, urlFor } from "@/lib/sanity-io.js";

const SITE_NAME = "Strength Journeys";
const DEFAULT_OG_IMAGE_URL =
  "https://www.strengthjourneys.xyz/strength_journeys_articles_og.png";

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

const components = {
  types: {
    image: ({ value }) => {
      if (!value?.asset?._ref) {
        return null;
      }

      // These will be in article images. These will be portrait landscpe so go slightly wider than higher
      const imageUrl = urlFor(value)
        .width(600)
        .height(400)
        .fit("clip")
        .quality(80)
        .auto("format")
        .url();

      const imageLinkUrl = getImageLinkUrl(value?.url);
      const isExternalImageLink = typeof imageLinkUrl === "string"
        ? /^https?:\/\//i.test(imageLinkUrl)
        : false;

      const image = (
        <Image
          src={imageUrl}
          alt={value.alt || " "}
          fill
          style={{ objectFit: "contain" }}
        />
      );

      return (
        <div className="relative my-8 h-96 w-full">
          {imageLinkUrl ? (
            <a
              href={imageLinkUrl}
              target={isExternalImageLink ? "_blank" : undefined}
              rel={isExternalImageLink ? "noopener noreferrer" : undefined}
              className="block h-full w-full"
              aria-label="Open image link"
            >
              {image}
            </a>
          ) : (
            image
          )}
        </div>
      );
    },
  },
};

export default function ArticlePost({ article }) {
  const canonicalUrl = `https://www.strengthjourneys.xyz/articles/${article.slug.current}`;
  const publishDate = new Date(article.publishedAt).toISOString();
  const formattedDate = format(new Date(article.publishedAt), "MMMM d, yyyy");

  // devLog(article);

  let bannerImageUrl = null;
  let ogImageUrl = DEFAULT_OG_IMAGE_URL;

  if (article.mainImage) {
    bannerImageUrl = urlFor(article.mainImage)
      .width(1200)
      .height(400)
      .fit("clip")
      .quality(90)
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
  const modifiedDate = article._updatedAt
    ? new Date(article._updatedAt).toISOString()
    : null;

  return (
    <div className="mx-2 mb-10 flex items-center justify-center">
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

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            datePublished: publishDate,
            ...(modifiedDate && { dateModified: modifiedDate }),
            url: canonicalUrl,
            image: ogImageUrl,
            author: {
              "@type": "Organization",
              name: "Strength Journeys Staff",
            },
            publisher: {
              "@type": "Organization",
              name: "Strength Journeys",
            },
          })}
        </script>
      </Head>

      <Card className="shadow-primary-foreground ring-border shadow-lg ring-0 hover:ring-1">
        <CardHeader className="px-3 md:px-6">
          <div className="mb-4">
            <Link
              href="/articles"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to Articles
            </Link>
          </div>
          {bannerImageUrl && <Banner imageUrl={bannerImageUrl} />}
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          <article className="prose text-foreground prose-headings:text-foreground prose-strong:text-foreground max-w-3xl">
            <header>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-foreground tracking-tighter">
                  {article.title}
                </h1>
                <TopArticleShareButton
                  title={article.title}
                  slug={article.slug.current}
                  url={canonicalUrl}
                />
              </div>
              <h3 className="text-muted-foreground mt-2 text-sm font-light">
                Published at: {formattedDate}
              </h3>

              {/* Let's leave out the article author for now */}
              {false && article.author && (
                <h2>
                  by <a href={article.author.url}>{article.author.name}</a>
                </h2>
              )}
            </header>
            <PortableText value={article.body} components={components} />
            {article.footer && (
              <footer>
                <PortableText value={article.footer} components={components} />
              </footer>
            )}
          </article>
        </CardContent>
        <CardFooter className="flex w-full flex-col items-start gap-6">
          <div className="flex w-full flex-col gap-4 border-t pt-6 md:flex-row md:items-center md:justify-between">
            <ArticleFeedback slug={article.slug.current} />
            <ArticleShareFooterCta
              title={article.title}
              slug={article.slug.current}
              url={canonicalUrl}
            />
          </div>
          <div className="text-center">
            <Link href="/articles" className="text-blue-600 hover:underline">
              ← Back to the Strength and Lifting Articles Library
            </Link>
          </div>
        </CardFooter>
      </Card>
      <MobileFloatingArticleShareButton
        title={article.title}
        slug={article.slug.current}
        url={canonicalUrl}
      />
    </div>
  );
}

const Banner = ({ imageUrl }) => (
  <div className="relative h-32 w-full overflow-hidden rounded-lg">
    {/* Adjust height as needed */}
    <Image
      src={imageUrl}
      alt="Banner"
      fill
      style={{ objectFit: "cover" }}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw"
      priority
    />
  </div>
);

export async function getStaticPaths() {
  const paths = await sanityIOClient.fetch(
    `*[_type == "post" && defined(slug.current) && publishedAt < now() && defined(body)][].slug.current`,
  );

  // devLog(paths);

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

  const article = await sanityIOClient.fetch(
    `*[_type == "post" && slug.current == $slug && publishedAt < now() && defined(body)][0]`,
    { slug },
  );

  const articleOLDGROQ = await sanityIOClient.fetch(
    `*[_type == "post" && slug.current == $slug && publishedAt < now() && defined(body)][0]{
      title,
      body,
      "slug": slug.current,
      publishedAt,
      "author": author->{name, "url": website},
      footer,
      mainImage,
      description
    }`,
    { slug },
  );

  // devLog(article);

  if (!article) {
    return { notFound: true };
  }

  return {
    props: { article },
    revalidate: 60 * 60, // Revalidate every hour, matching the listing page
  };
}
