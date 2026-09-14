/*
 * Article sitemap, listing each published article with its updatedAt as lastmod.
 *
 * Articles now live in content/articles/ and change only with a deploy, but the
 * route stays at /server-sitemap.xml because Search Console already has that URL
 * registered. next-sitemap owns every static route (see next-sitemap.config.js)
 * and excludes article slugs so the two sitemaps never list the same URL. The
 * markdown files reach this function through outputFileTracingIncludes in
 * next.config.js.
 */
import { getServerSideSitemapLegacy } from "next-sitemap";

import { getPublishedArticles } from "@/lib/articles";

const SITE_URL = "https://www.strengthjourneys.xyz";

export async function getServerSideProps(ctx) {
  let fields = [];

  try {
    fields = getPublishedArticles()
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((article) => ({
        loc: `${SITE_URL}/articles/${article.slug}`,
        lastmod: article.updatedAt,
        changefreq: "weekly",
        priority: 0.7,
      }));
  } catch (error) {
    // Serve an empty sitemap rather than a 500 - Google reports a failed fetch
    // against the whole submitted sitemap, which is worse than a quiet gap.
    console.error("server-sitemap: failed to read article content", error);
  }

  ctx.res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );

  return getServerSideSitemapLegacy(ctx, fields);
}

// Required by Next.js, but never rendered - getServerSideProps ends the response.
export default function ServerSitemap() {}
