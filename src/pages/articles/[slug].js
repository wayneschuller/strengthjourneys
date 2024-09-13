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
      return (
        <div className="relative my-8 h-96 w-full">
          <Image
            src={urlFor(value).url()}
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
  const canonicalUrl = `https://www.strengthjourneys.xyz/articles/${article.slug}`;
  const publishDate = new Date(article.publishedAt).toISOString();
  const formattedDate = format(new Date(article.publishedAt), "MMMM d, yyyy");

  devLog(article);

  return (
    <div className="mx-4 mb-10 flex items-center justify-center">
      <Head>
        <title>{article.title}</title>
        <meta name="description" content={article.title} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.title} />
        <meta property="article:published_time" content={publishDate} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={canonicalUrl} />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={article.title} />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            datePublished: publishDate,
            url: canonicalUrl,
            // "author": {
            //   "@type": "Person",
            //   "name": "Author Name"
            // },
            // "publisher": {
            //   "@type": "Organization",
            //   "name": "Your Organization Name"
            // }
          })}
        </script>
      </Head>

      <Card className="shadow-lg shadow-primary-foreground ring-0 ring-black hover:ring-1 dark:ring-white">
        <CardHeader></CardHeader>
        <CardContent>
          <article className="prose prose-orange dark:prose-invert">
            <header>
              <h1>{article.title}</h1>
              <h3 className="mt-2 text-sm font-light text-gray-600 dark:text-gray-400">
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
    `*[_type == "post" && slug.current == $slug && publishedAt < now() && defined(body)][0]{
      title,
      body,
      "slug": slug.current,
      publishedAt,
      "author": author->{name, "url": website},
      footer
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
