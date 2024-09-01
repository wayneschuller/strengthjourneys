import { createClient } from "@sanity/client";
import { PortableText } from "@portabletext/react";
import { devLog } from "@/lib/processing-utils";

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  useCdn: false,
  apiVersion: "2021-03-25",
  token: process.env.SANITY_API_TOKEN,
});

export default function ArticlePost({ article }) {
  return (
    <article className="mx-auto max-w-2xl py-8">
      <h1 className="mb-4 text-4xl font-bold">{article.title}</h1>
      <div className="prose prose-lg">
        <PortableText value={article.body} />
      </div>
    </article>
  );
}

export async function getStaticPaths() {
  console.log("getStaticPaths: Starting to fetch paths");
  const paths = await client.fetch(
    `*[_type == "post" && defined(slug.current) && publishedAt < now() && defined(body)][].slug.current`,
    // GROQ Query Explanation:
    // *                                 - Fetch all documents
    // [_type == "post"                  - Filter for documents of type "post"
    // && defined(slug.current)          - Ensure the slug field exists and is not null
    // && publishedAt < now()            - Ensure the publish date is in the past (i.e., the post is published)
    // && defined(body)]                 - Ensure the body field exists and is not null
    // [].slug.current                   - From the resulting documents, select only the slug.current field
  );
  console.log(`getStaticPaths: Fetched ${paths.length} paths`);
  console.log("getStaticPaths: Paths:", paths);

  return {
    paths: paths.map((slug) => ({ params: { slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const { slug } = params;
  console.log(`getStaticProps: Fetching article for slug: ${slug}`);

  const article = await client.fetch(
    `*[_type == "post" && slug.current == $slug && publishedAt < now() && defined(body)][0]{
      title,
      body,
      "slug": slug.current,
      publishedAt
    }`,
    { slug },
    // GROQ Query Explanation:
    // *                                 - Fetch all documents
    // [_type == "post"                  - Filter for documents of type "post"
    // && slug.current == $slug          - Match the slug to the one we're looking for
    // && publishedAt < now()            - Ensure the publish date is in the past (i.e., the post is published)
    // && defined(body)]                 - Ensure the body field exists and is not null
    // [0]                               - Select the first (and should be only) matching document
    // {                                 - From that document, return an object with the following fields:
    //   title,                          - The title field
    //   body,                           - The body field (Portable Text)
    //   "slug": slug.current,           - Rename slug.current to just slug
    //   publishedAt                     - The publishedAt field
    // }
  );

  console.log(
    `getStaticProps: Article fetch result:`,
    article
      ? `Title: ${article.title}, Published: ${article.publishedAt}, Has body: ${Boolean(article.body)}`
      : "No article found",
  );

  if (!article) {
    console.log(`getStaticProps: No article found for slug: ${slug}`);
    return { notFound: true };
  }

  console.log(`getStaticProps: Successfully fetched article: ${article.title}`);

  return {
    props: { article },
    revalidate: 60, // Revalidate every 60 seconds
  };
}
