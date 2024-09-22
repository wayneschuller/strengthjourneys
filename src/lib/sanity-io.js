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
