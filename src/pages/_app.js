/** @format */

import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/Layout";
import { Toaster } from "@/components/ui/toaster";
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
import { SessionProvider } from "next-auth/react";

export default function App({ Component, pageProps, session }) {
  return (
    <>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <SessionProvider session={session}>
          <div className={`min-h-screen bg-background ${inter.className}`}>
            <Layout>
              <Component {...pageProps} />
            </Layout>
            <Toaster />
          </div>
        </SessionProvider>
      </ThemeProvider>
      <Analytics />
    </>
  );
}
