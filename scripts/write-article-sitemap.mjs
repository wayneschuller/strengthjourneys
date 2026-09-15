/**
 * Writes public/server-sitemap.xml at postbuild time, straight after
 * next-sitemap, listing every article with its updatedAt as lastmod.
 *
 * Articles only change with a deploy, so a static file serves this with no
 * function behind it. The file keeps the /server-sitemap.xml name because
 * Search Console already has that URL registered, and next-sitemap's robots.txt
 * points to it. Like the static sitemap it emits no changefreq or priority,
 * which Google ignores.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

import { getPublishedArticles } from "../src/lib/articles.js";

const SITE_URL = "https://www.strengthjourneys.xyz";
const OUTPUT_PATH = path.join(process.cwd(), "public", "server-sitemap.xml");

// Slugs are validated as lowercase-hyphenated and dates are ISO strings, so
// nothing written here needs XML escaping.
const urls = getPublishedArticles()
  .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  .map(
    (article) =>
      `<url><loc>${SITE_URL}/articles/${article.slug}</loc><lastmod>${article.updatedAt}</lastmod></url>`,
  );

writeFileSync(
  OUTPUT_PATH,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
);
console.log(`Wrote ${urls.length} article URLs to public/server-sitemap.xml`);
