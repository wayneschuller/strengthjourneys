/**
 * Landing-page hero for Strength Journeys.
 * Keep the CTA branching aligned with auth + sheet-link state so setup and
 * import actions feel consistent with the rest of the onboarding flow.
 */

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Upload } from "lucide-react";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";
import { SloganCarousel } from "@/components/homepage/slogan-carousel";
import { Button } from "@/components/ui/button";

/**
 * Landing page hero section. Renders the slogan carousel, headline, Google sign-in
 * button, and the animated spreadsheet/app screenshot showcase side by side.
 *
 * @param {Object} props - No props.
 */
export function HeroSection() {
  return (
    <div>
      <div className="mb-8 flex flex-row justify-center">
        <SloganCarousel />
      </div>
      <div className="mx-auto max-w-3xl">
        <p className="mt-4 text-center text-2xl font-bold tracking-tight md:text-3xl">
          Welcome to Strength Journeys
        </p>
        <h1 className="mb-4 mt-2 text-balance text-center text-3xl font-extrabold leading-tight tracking-tight md:mb-8 md:text-4xl xl:text-5xl">
          Free barbell lifting analysis tools that turn your lifting data
          into powerful, visual insights.
        </h1>
        <PageDescription />
        <HeroPrimaryCta />
      </div>
    </div>
  );
}

// Internal helper: paragraph describing the app's core value proposition with links.
const PageDescription = () => (
  <></>
);

// Internal helper: prominent hero CTA area for unauthenticated visitors and
// authenticated demo-mode users who still need to set up a sheet.
function HeroPrimaryCta() {
  const { status: authStatus } = useSession();
  const { hasUserData, sheetInfo } = useUserLiftingData();

  if (hasUserData) return null;

  // Treat "loading" the same as "unauthenticated" — this matches SSR output so
  // there's no hydration mismatch, then React updates once auth resolves.
  const isAuthed = authStatus === "authenticated";
  const hasSsid = isAuthed && !!sheetInfo?.ssid;
  const importCtaLabel = hasSsid
    ? "Import More Lifting History"
    : "Import From Another Fitness App";
  const importCtaDescription = isAuthed
    ? hasSsid
      ? "Instant preview first. Merge new entries into your linked sheet when you're ready."
      : "Instant preview first. Save your data into a free Google Sheet when you're ready."
    : "Instant preview. No sign-in required.";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Primary + secondary CTAs side by side on sm+, stacked on mobile */}
      <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
        {/* Primary CTA column */}
        <div className="flex w-full flex-col items-center sm:w-auto">
          {isAuthed ? (
            <Button
              size="lg"
              className="w-full hover:ring-2 sm:w-auto"
              onClick={() => {
                openSheetSetupDialog("bootstrap");
              }}
            >
              <img
                src={GOOGLE_SHEETS_ICON_URL}
                alt=""
                className="h-5 w-5 shrink-0"
                aria-hidden
              />
              Set Up Your Free Lifting Log
            </Button>
          ) : (
            <GoogleSignInButton
              size="lg"
              className="w-full hover:ring-2 sm:w-auto"
              cta="hero"
            >
              <span className="hidden sm:inline">Start Your Strength Journey</span>
              <span className="sm:hidden">Start Your Journey</span>
            </GoogleSignInButton>
          )}
          <p className="mt-1.5 text-xs text-slate-500">
            Free forever. Your data stays yours.
          </p>
        </div>

        {/* Secondary CTA column */}
        {(
          <div className="flex w-full flex-col items-center sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
              asChild
              onClick={() => gaEvent(GA_EVENT_TAGS.HERO_IMPORT_CLICK, { page: "/" })}
            >
              <Link
                href={{
                  pathname: "/import",
                  query: { from: "hero", returnTo: "/" },
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                {importCtaLabel}
              </Link>
            </Button>
            <p className="mt-1.5 text-center text-xs text-slate-500 sm:text-left">
              {importCtaDescription}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

