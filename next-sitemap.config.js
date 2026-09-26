/*
 * Build-time sitemap for every route, written into public/ at postbuild along
 * with robots.txt.
 *
 * Only article pages carry a lastmod: their real updatedAt, read from
 * content/articles/ through src/lib/articles.js, which keeps its imports on
 * node_modules so it loads here in plain Node. /changelog carries the date of
 * its newest entry, which next.config.js already reads from the file names.
 */
const fs = require("fs");
const path = require("path");

const SITE_URL = "https://www.strengthjourneys.xyz";
const CHANGELOG_LATEST = require("./next.config.js").env
  .NEXT_PUBLIC_CHANGELOG_LATEST;

// Every curated lift in src/lib/lifts/ gets a /progress-guide/ page, but one
// without a guide block is noindex, so it stays out of the sitemap too. This
// mirrors isLiftGuideIndexable in src/lib/lifts/lift-registry.js; keep them in step.
const LIFTS_DIR = path.join(__dirname, "src/lib/lifts");
const UNINDEXED_LIFT_GUIDES = fs
  .readdirSync(LIFTS_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) =>
    JSON.parse(fs.readFileSync(path.join(LIFTS_DIR, file), "utf8")),
  )
  .filter((lift) => !lift.guide)
  .map((lift) => `/progress-guide/${lift.slug}`);

// Article routes mapped to their updatedAt, loaded once as a shared promise
// because next-sitemap transforms many routes at the same time.
let articleLastmodsPromise = null;
function getArticleLastmods() {
  articleLastmodsPromise ??= import("./src/lib/articles.js").then(
    ({ getPublishedArticles }) =>
      new Map(
        getPublishedArticles().map((article) => [
          `/articles/${article.slug}`,
          article.updatedAt,
        ]),
      ).set("/changelog", CHANGELOG_LATEST || undefined),
  );
  return articleLastmodsPromise;
}

module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  exclude: UNINDEXED_LIFT_GUIDES,
  // next-sitemap's defaults stamp every URL with the build time and a blanket
  // changefreq/priority. Google ignores changefreq and priority outright, and a
  // lastmod that is identical across all routes and resets on each deploy is a
  // freshness claim we cannot back up — the kind Google learns to discount.
  // Articles carry their real updatedAt instead and every other route emits
  // only <loc>, which keeps the one lastmod signal we do have worth trusting.
  autoLastmod: false,
  transform: async (config, route) => {
    const lastmod = (await getArticleLastmods()).get(route);
    return { loc: route, ...(lastmod && { lastmod }), alternateRefs: [] };
  },
};
