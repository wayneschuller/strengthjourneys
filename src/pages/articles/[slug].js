import { createClient } from "@sanity/client";
import { PortableText } from "@portabletext/react";
import Head from "next/head";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  useCdn: false,
  apiVersion: "2021-03-25",
  token: process.env.SANITY_API_TOKEN,
});

export default function ArticlePost({ article }) {
  return (
    <div className="mx-4 mb-10 flex items-center justify-center">
      <Head>
        <title>{article.title}</title>
        <meta name="description" content={article.title} />
      </Head>
      <Card className="shadow-lg shadow-primary-foreground ring-0 ring-black hover:ring-1 dark:ring-white">
        <CardHeader></CardHeader>
        <CardContent>
          <article className="prose prose-orange dark:prose-invert">
            <header>
              <h1>{article.title}</h1>
              {article.author && (
                <h2>
                  by <a href={article.author.url}>{article.author.name}</a>
                </h2>
              )}
            </header>
            <PortableText value={article.body} />
            {article.footer && (
              <footer>
                <PortableText value={article.footer} />
              </footer>
            )}
          </article>
        </CardContent>
      </Card>
    </div>
  );
}

export async function getStaticPaths() {
  const paths = await client.fetch(
    `*[_type == "post" && defined(slug.current) && publishedAt < now() && defined(body)][].slug.current`,
  );

  return {
    paths: paths.map((slug) => ({ params: { slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const { slug } = params;

  const article = await client.fetch(
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

  if (!article) {
    return { notFound: true };
  }

  return {
    props: { article },
    revalidate: 60,
  };
}
