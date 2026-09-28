/**
 * Global HTML document shell for the Pages Router app.
 * Keep cross-site metadata here so crawlers and browsers receive the same icon and theme hints on every route.
 */

import { Html, Head, Main, NextScript } from "next/document";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";

// The server cannot see localStorage, so it renders the first-visit page. For
// a returning lifter this marks <html> before the first paint, and CSS hides
// every [data-first-visit] element until React takes over (dataSource
// "restoring" in use-userlift-data.js removes the mark).
const RESTORING_SCRIPT = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  LOCAL_STORAGE_KEYS.SHEET_INFO,
)}));if(s&&s.ssid)document.documentElement.setAttribute("data-restoring","")}catch(e){}`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <script dangerouslySetInnerHTML={{ __html: RESTORING_SCRIPT }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
