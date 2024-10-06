import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";

// NOTE: The article content is a separate repo on sanity.io and is not part of the GPL licensed repo
export const sanityIOClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  useCdn: false, // Keep false because we only read at build time on Vercel
  apiVersion: "2023-05-03",
});

export const builder = imageUrlBuilder(sanityIOClient);

export function urlFor(source) {
  return builder.image(source);
}

export async function fetchRelatedArticles(category) {
  try {
    const relatedArticles = await sanityIOClient.fetch(
      `
      *[_type == "post" && publishedAt < now() && $category in categories[]->title] | order(publishedAt desc) {
        title,
        "slug": slug.current,
        publishedAt,
        categories[]-> {
          title
        },
        mainImage,
      }
    `,
      { category },
    );

    return relatedArticles || [];
  } catch (error) {
    console.error("Error fetching related articles:", error);
    return [];
  }
}

// Generic function to fetch an article by ID with error handling
export async function fetchArticleById(articleId) {
  try {
    const articleQuery = `*[_id == $articleId][0] {
      title,
      body,
      _id
    }`;

    const article = await sanityIOClient.fetch(articleQuery, { articleId });

    if (!article) {
      console.error(`Article with ID ${articleId} not found.`);
      return null; // Return null if the article isn't found
    }

    return article;
  } catch (error) {
    console.error(`Error fetching article with ID ${articleId}:`, error);
    return null; // Return null if there was an error fetching the article
  }
}
