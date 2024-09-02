import Head from "next/head";

// Remember to import this on every page.
// It has some defaults so if nothing is passed as props, we will have something
// The defaults work well for the root index
export const TitleSEOHead = ({
  title,
  description,
  canonicalURL,
  ogType = "website",
  ogImage,
  ogImageAlt,
}) => {
  const siteName = "Strength Journeys";
  const defaultTitle =
    "Strength Journeys | Free Barbell Lifting Progress Tracker and Analysis Tools";
  const defaultDescription =
    "Track and analyze your barbell lifting progress with Strength Journeys. Free tools include PR analyzer, strength visualizer, 1RM calculator, and more. Integrate with Google Sheets for easy data management. Open source and perfect for powerlifters and strength athletes.";
  const defaultURL = "https://www.strengthjourneys.xyz/";

  const defaultOGImage = "https://www.strengthjourneys.xyz/202409-og-image.png";

  const fullTitle = title ? `${title} | ${siteName}` : defaultTitle;
  const finalOGImage = ogImage || defaultOGImage;

  return (
    <Head>
      <title key="title">{fullTitle}</title>
      <meta
        name="description"
        content={description || defaultDescription}
        key="description"
      />
      {canonicalURL && (
        <link rel="canonical" href={canonicalURL} key="canonical" />
      )}
      <meta property="og:type" content={ogType} key="og:type" />
      <meta property="og:site_name" content={siteName} key="og:site_name" />
      <meta property="og:title" content={fullTitle} key="og:title" />
      <meta
        property="og:description"
        content={description || defaultDescription}
        key="og:description"
      />
      {canonicalURL && (
        <meta property="og:url" content={canonicalURL} key="og:url" />
      )}
      <meta property="og:image" content={finalOGImage} key="og:image" />
      {ogImageAlt && (
        <meta property="og:image:alt" content={ogImageAlt} key="og:image:alt" />
      )}
      <meta
        name="twitter:card"
        content="summary_large_image"
        key="twitter:card"
      />
      <meta name="twitter:title" content={fullTitle} key="twitter:title" />
      <meta
        name="twitter:description"
        content={description || defaultDescription}
        key="twitter:description"
      />
      <meta name="twitter:image" content={finalOGImage} key="twitter:image" />
      {ogImageAlt && (
        <meta
          name="twitter:image:alt"
          content={ogImageAlt}
          key="twitter:image:alt"
        />
      )}
    </Head>
  );
};
