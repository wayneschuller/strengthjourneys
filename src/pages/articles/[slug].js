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
import { format } from "date-fns";

import { sanityIOClient, urlFor } from "@/lib/sanity-io.js";

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

      return (
        <div className="relative my-8 h-96 w-full">
          <Image
            src={imageUrl}
            alt={value.alt || " "}
            fill
            style={{ objectFit: "contain" }}
          />
        </div>
      );
    },
  },
};

export default function ArticlePost({ article }) {
  const canonicalUrl = `https://www.strengthjourneys.xyz/articles/${article.slug.current}`;
  const publishDate = new Date(article.publishedAt).toISOString();
  const formattedDate = format(new Date(article.publishedAt), "MMMM d, yyyy");

  devLog(article);

  let bannerImageUrl = null;
  let ogImageUrl = null;

  if (article.mainImage) {
    bannerImageUrl = urlFor(article.mainImage)
      .width(1200)
      .height(400)
      .fit("clip")
      .quality(90)
      .auto("format")
      .url();

    ogImageUrl = urlFor(article.mainImage)
      .width(400)
      .height(400)
      .fit("clip")
      .quality(70)
      .auto("format")
      .url();
  }

  const description = article.description ?? article.title;

  return (
    <div className="mx-2 mb-10 flex items-center justify-center">
      <Head>
        <title>{article.title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={article.title} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:description" content={description} />
        <meta property="article:published_time" content={publishDate} />

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
            url: canonicalUrl,
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

      <Card className="shadow-lg shadow-primary-foreground ring-0 ring-border hover:ring-1">
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
          <article className="prose max-w-3xl text-foreground prose-headings:text-foreground">
            <header>
              <h1 className="tracking-tighter text-foreground">
                {article.title}
              </h1>
              <h3 className="mt-2 text-sm font-light text-muted-foreground">
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
        <CardFooter>
          <div className="mt-8 text-center">
            <Link href="/articles" className="text-blue-600 hover:underline">
              ← Back to the Strength and Lifting Articles Library
            </Link>
          </div>
        </CardFooter>
      </Card>
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

  devLog(paths);

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
