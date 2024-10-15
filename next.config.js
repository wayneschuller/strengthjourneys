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
    ],
  },

  // These two articles were manually jsxed before we had sanity.io 202409
  // We could delete these in a few months once Google indexing has caught up
  async redirects() {
    return [
      {
        source: "/articles/own-your-lifting-data",
        destination:
          "/articles/the-power-of-owning-your-lifting-data-with-google-sheets",
        permanent: true,
      },
      {
        source: "/articles/henry-rollins-the-iron-and-the-soul",
        destination: "/articles/the-iron-and-the-soul-author-henry-rollins",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
