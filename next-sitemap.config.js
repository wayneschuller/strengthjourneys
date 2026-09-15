/*
 * Build-time sitemap for the static routes only.
 *
 * Article URLs go in /server-sitemap.xml, which scripts/write-article-sitemap.mjs
 * writes straight after this step with each article's updatedAt as lastmod.
 * They are excluded here to avoid listing the same URL twice.
 */
const fs = require("fs");
const path = require("path");

const SITE_URL = "https://www.strengthjourneys.xyz";

// Every curated lift in src/lib/lifts/ gets a /progress-guide/ page, but one
// without a guide block is noindex, so it stays out of the sitemap too. This
// mirrors isLiftGuideIndexable in src/lib/lifts/lift-registry.js; keep them in step.
const LIFTS_DIR = path.join(__dirname, "src/lib/lifts");
const UNINDEXED_LIFT_GUIDES = fs
  .readdirSync(LIFTS_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(fs.readFileSync(path.join(LIFTS_DIR, file), "utf8")))
  .filter((lift) => !lift.guide)
  .map((lift) => `/progress-guide/${lift.slug}`);

module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  // Article slugs live in the article sitemap; the listing and its pagination
  // are ordinary static routes and stay here.
  exclude: [
    "/articles/*",
    "!/articles/page/*",
    ...UNINDEXED_LIFT_GUIDES,
  ],
  // next-sitemap's defaults stamp every URL with the build time and a blanket
  // changefreq/priority. Google ignores changefreq and priority outright, and a
  // lastmod that is identical across all routes and resets on each deploy is a
  // freshness claim we cannot back up — the kind Google learns to discount. The
  // article sitemap carries real per-article updatedAt values, so emitting only
  // <loc> here keeps the one lastmod signal we do have worth trusting.
  autoLastmod: false,
  transform: async (config, path) => ({ loc: path, alternateRefs: [] }),
  robotsTxtOptions: {
    additionalSitemaps: [`${SITE_URL}/server-sitemap.xml`],
  },
};
