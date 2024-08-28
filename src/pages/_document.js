/** @format */

"use client";

import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
     <Head>
        <script 
          defer 
          data-domain="strengthjourneys.xyz" 
          src="https://plausible.io/js/script.js"
        />
        {/* Other head elements */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
