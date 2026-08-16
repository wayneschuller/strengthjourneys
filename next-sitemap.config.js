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
  robotsTxtOptions: {
    additionalSitemaps: [`${SITE_URL}/server-sitemap.xml`],
  },
};
