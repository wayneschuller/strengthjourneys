const { createClient } = require("@sanity/client");

async function fetchArticleSitemapEntries() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

  if (!projectId || !dataset) {
    return [];
  }

  try {
    const sanityClient = createClient({
      projectId,
      dataset,
      useCdn: false,
      apiVersion: "2023-05-03",
    });

    const articles = await sanityClient.fetch(`
      *[
        _type == "post" &&
        defined(slug.current) &&
        publishedAt < now() &&
        defined(body)
      ]{
        "slug": slug.current,
        _updatedAt
      }
    `);

    return articles.map((article) => ({
      loc: `/articles/${article.slug}`,
      lastmod: article._updatedAt,
    }));
  } catch (error) {
    console.error("next-sitemap: failed to fetch article URLs from Sanity", error);
    return [];
  }
}

module.exports = {
  siteUrl: "https://strengthjourneys.xyz",
  generateRobotsTxt: true,
  additionalPaths: async () => fetchArticleSitemapEntries(),
};
