/** @format */

import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/toaster";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });

export default function App({ Component, pageProps }) {
  return (
    <>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <div className={`min-h-screen bg-background ${inter.className}`}>
          <Layout>
            <Component {...pageProps} />
          </Layout>
          <Toaster />
        </div>
      </ThemeProvider>
      <Analytics />
    </>
  );
}
