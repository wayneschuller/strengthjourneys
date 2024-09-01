import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";

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
