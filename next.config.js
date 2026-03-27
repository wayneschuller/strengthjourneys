/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["geist"],

  // Added by WS 20240901
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/**",
      },
    ],
  },

  // These two articles were manually jsxed before we had sanity.io 202409
  // We could delete these in a few months once Google indexing has caught up
  async redirects() {
    return [
      // 2026-03-08: Legacy analyzer route now maps to the home dashboard/landing page.
      {
        source: "/analyzer",
        destination: "/",
        permanent: true,
      },
      // 2026-03-08: Legacy strength level calculator now resolves to the public strength levels hub.
      {
        source: "/strength-level-calculator",
        destination: "/strength-levels",
        permanent: true,
      },
      // 2026-03-20: Big Four standards now live on the public strength levels hub.
      {
        source: "/big-four-strength-standards-calculator",
        destination: "/strength-levels",
        permanent: true,
      },
      // 2026-03-27: Strength potential charts now live inside Lift Explorer.
      {
        source: "/barbell-strength-potential",
        destination: "/lift-explorer",
        permanent: true,
      },
      // 2024-09-01: Preserve traffic from the old manually-authored article slug after Sanity migration.
      {
        source: "/articles/own-your-lifting-data",
        destination:
          "/articles/the-power-of-owning-your-lifting-data-with-google-sheets",
        permanent: true,
      },
      // 2024-09-01: Preserve traffic from the old manually-authored article slug after Sanity migration.
      {
        source: "/articles/henry-rollins-the-iron-and-the-soul",
        destination: "/articles/the-iron-and-the-soul-author-henry-rollins",
        permanent: true,
      },
      // 2026-03-25: Insight pages moved under /progress-guide/ cluster.
      {
        source: "/barbell-squat-insights",
        destination: "/progress-guide/squat",
        permanent: true,
      },
      {
        source: "/barbell-bench-press-insights",
        destination: "/progress-guide/bench-press",
        permanent: true,
      },
      {
        source: "/barbell-deadlift-insights",
        destination: "/progress-guide/deadlift",
        permanent: true,
      },
      {
        source: "/barbell-strict-press-insights",
        destination: "/progress-guide/strict-press",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
