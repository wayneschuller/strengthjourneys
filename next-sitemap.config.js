/*
 * Build-time sitemap for the static routes only.
 *
 * Sanity article slugs are served from the dynamic /server-sitemap.xml route
 * (src/pages/server-sitemap.xml.js) so newly published articles appear without
 * a deploy. They are excluded here to avoid listing the same URL twice.
 */
const SITE_URL = "https://www.strengthjourneys.xyz";

module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  // Article slugs live in the dynamic sitemap; the listing and its pagination
  // are ordinary static routes and stay here.
  exclude: ["/articles/*", "!/articles/page/*", "/server-sitemap.xml"],
  // next-sitemap's defaults stamp every URL with the build time and a blanket
  // changefreq/priority. Google ignores changefreq and priority outright, and a
  // lastmod that is identical across all routes and resets on each deploy is a
  // freshness claim we cannot back up — the kind Google learns to discount. The
  // article sitemap carries real per-post _updatedAt values, so emitting only
  // <loc> here keeps the one lastmod signal we do have worth trusting.
  autoLastmod: false,
  transform: async (config, path) => ({ loc: path, alternateRefs: [] }),
  robotsTxtOptions: {
    additionalSitemaps: [`${SITE_URL}/server-sitemap.xml`],
  },
};
