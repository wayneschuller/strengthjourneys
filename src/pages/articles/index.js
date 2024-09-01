// File: pages/articles/index.js

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Head from "next/head";
import { sanityIOClient, urlFor } from "@/lib/sanity-io.js";

const pageTitle = "Strength and Lifting Articles Library";
const siteName = "Strength Journeys";
const description = `Browse our collection of strength, lifting and fitness articles on various topics. Updated regularly with the latest insights and information.`;
const canonicalUrl = "https://www.strengthjourneys.xyz/articles";

export default function ArticleListingPage({ articles }) {
  const fullTitle = `${pageTitle} | ${siteName}`;

  return (
    // <div className="container mx-auto px-4">
    <div className="mx-4 mb-4 md:mx-[5vw]">
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            mainEntity: {
              "@type": "ItemList",
              itemListElement: articles.map((article, index) => ({
                "@type": "ListItem",
                position: index + 1,
                url: `${canonicalUrl}/${article.slug}`,
              })),
            },
            name: pageTitle,
            description: description,
            url: canonicalUrl,
          })}
        </script>
      </Head>
      <h1 className="mb-6 text-center text-3xl font-bold">{pageTitle}</h1>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {articles.map((article) => (
          <Card key={article.slug} className="">
            <CardHeader>
              <CardTitle>
                <Link
                  href={`/articles/${article.slug}`}
                  className="hover:underline"
                >
                  {article.title}
                </Link>
              </CardTitle>
            </CardHeader>
            {/* <CardContent> <p className="text-sm text-gray-500"> Published on{" "} {new Date(article.publishedAt).toLocaleDateString()} </p> </CardContent> */}
          </Card>
        ))}
      </div>
    </div>
  );
}

export async function getStaticProps() {
  const articles = await sanityIOClient.fetch(`
    *[_type == "post" && publishedAt < now()] | order(publishedAt desc) {
      title,
      "slug": slug.current,
      publishedAt
    }
  `);

  return {
    props: {
      articles,
    },
    revalidate: 60 * 60, // Revalidate every hour
  };
}
