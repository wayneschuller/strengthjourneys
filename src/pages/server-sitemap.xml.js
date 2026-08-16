/*
 * Dynamic sitemap for Sanity article URLs.
 *
 * Articles are published in the sibling Sanity studio without a code deploy, so
 * their URLs are served from this SSR route instead of the build-time sitemap.
 * next-sitemap still owns every static route (see next-sitemap.config.js) and
 * excludes article slugs so the two sitemaps never list the same URL.
 */
import { getServerSideSitemapLegacy } from "next-sitemap";

import { sanityIOClient } from "@/lib/sanity-io";

const SITE_URL = "https://www.strengthjourneys.xyz";

const ARTICLE_SITEMAP_QUERY = `
  *[
    _type == "post" &&
    defined(slug.current) &&
    publishedAt < now() &&
    defined(body)
  ] | order(_updatedAt desc) {
    "slug": slug.current,
    _updatedAt
  }
`;

export async function getServerSideProps(ctx) {
  let fields = [];

  try {
    const articles = await sanityIOClient.fetch(ARTICLE_SITEMAP_QUERY);

    fields = (articles ?? []).map((article) => ({
      loc: `${SITE_URL}/articles/${article.slug}`,
      lastmod: article._updatedAt,
      changefreq: "weekly",
      priority: 0.7,
    }));
  } catch (error) {
    // Serve an empty sitemap rather than a 500 - Google reports a failed fetch
    // against the whole submitted sitemap, which is worse than a quiet gap.
    console.error(
      "server-sitemap: failed to fetch article URLs from Sanity",
      error,
    );
  }

  ctx.res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );

  return getServerSideSitemapLegacy(ctx, fields);
}

// Required by Next.js, but never rendered - getServerSideProps ends the response.
export default function ServerSitemap() {}
