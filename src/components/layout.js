/** @format */

"use client";

import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { AppBackground } from "@/components/app-background";
import { FeedbackWidget } from "@/components/feedback-widget";

/**
 * Root layout wrapper for the app. Renders nav, main content area, footer, and app background.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content rendered inside the main element.
 */
export function Layout({ children }) {
  return (
    <div className="relative min-h-screen w-full bg-background">
      <AppBackground />

      <div className="relative z-10">
        <NavBar />
        <main className="mx-0 md:mx-[3vw] lg:mx-[4vw] xl:mx-[5vw]">
          {children}
        </main>
        <Footer />
        {process.env.NEXT_PUBLIC_FEEDBACK_WIDGET === "true" && <FeedbackWidget />}
      </div>
    </div>
  );
}
