import { createClient } from "@sanity/client";
import { PortableText } from "@portabletext/react";
import Image from "next/image";
import Head from "next/head";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import imageUrlBuilder from "@sanity/image-url";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  useCdn: false, // Keep false because we only read at build time on Vercel
  apiVersion: "2023-05-03",
});

const builder = imageUrlBuilder(client);

function urlFor(source) {
  return builder.image(source);
}

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
            <PortableText value={article.body} components={components} />
            {article.footer && (
              <footer>
                <PortableText value={article.footer} components={components} />
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
  };
}
