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
      <title>{fullTitle}</title>
      <meta name="description" content={description || defaultDescription} />
      {canonicalURL && <link rel="canonical" href={canonicalURL} />}

      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link
        rel="icon"
        type="image/png"
        sizes="48x48"
        href="/favicon-48x48.png"
      />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="index, follow" />

      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta
        property="og:description"
        content={description || defaultDescription}
      />
      {canonicalURL && <meta property="og:url" content={canonicalURL} />}
      <meta property="og:image" content={finalOGImage} />
      {ogImageAlt && <meta property="og:image:alt" content={ogImageAlt} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta
        name="twitter:description"
        content={description || defaultDescription}
      />
      <meta name="twitter:image" content={finalOGImage} />
      {ogImageAlt && <meta name="twitter:image:alt" content={ogImageAlt} />}
    </Head>
  );
};
