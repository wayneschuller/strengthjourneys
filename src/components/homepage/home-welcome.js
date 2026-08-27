/**
 * Activation home for a lifter who is signed in but has no linked sheet.
 *
 * This is a third home state, not a variant of the hero. The hero's job is to
 * convince a stranger to sign in; this user already did, so re-arguing the case
 * wastes the whole fold and reads as though the app did not notice them. The
 * dashboard is no better — it is a mirror, and there is nothing yet to reflect.
 *
 * So the job here is activation: name the lifter, then ask the one question that
 * actually branches — do they have training history somewhere else, or are they
 * starting from nothing? That fork is also the segmentation. An importer with
 * five years of Hevy data does not want to be told how to squat; a genuine
 * beginner does. Answering it routes each to the right next thing instead of
 * showing both the same compromise.
 *
 * The Big Four cards take the slot the product showcase holds on the public
 * hero. Screenshots of features sell the app to a stranger; this lifter has
 * already bought in, so the space is better spent inviting them to learn the
 * lifts they are about to log.
 *
 * Note for the incremental-permissions work: the import branch needs no Drive
 * scope at all — it previews client-side — so it stays available even if the
 * user has declined or has not yet been asked. Keep it that way. The sheet
 * branch is the only one that should ever trigger a scope request.
 */

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BigFourLiftCards } from "@/components/homepage/big-four-lift-cards";
import { StarterContentRail } from "@/components/homepage/starter-content-rail";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";

/**
 * One branch of the "where are you starting from?" fork. Both branches carry
 * equal visual weight on purpose — we genuinely do not know which lifter this
 * is, so pre-picking one for them would just be a guess wearing a primary
 * button.
 */
function StartingPointOption({ title, description, children }) {
  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {description}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Signed-in, no-sheet home state. Renders the welcome + starting-point fork
 * beside a 2x2 grid of the Big Four lift cards, with the starting-out reading
 * rail underneath.
 *
 * @param {Object} props
 * @param {Array<Object>} [props.starterArticles=[]] - Featured Sanity articles passed down
 *   from the home page's getStaticProps, forwarded to the reading rail.
 * @param {Array<Object>} props.lifts - Big Four lift config, same shape the landing page row uses.
 */
export function HomeWelcome({ starterArticles = [], lifts }) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.trim()?.split(/\s+/)[0] || null;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-2 xl:gap-12">
        <div>
          <p className="text-muted-foreground text-center text-sm font-semibold tracking-wide uppercase lg:text-left">
            You&rsquo;re signed in
          </p>
          <h1 className="mt-3 mb-4 text-center text-3xl leading-tight font-extrabold tracking-tight text-balance lg:text-left lg:text-4xl">
            {firstName ? `Welcome, ${firstName}.` : "Welcome."}
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            Let&rsquo;s find your starting point.
          </h1>
          <p className="text-muted-foreground mb-6 max-w-xl text-center text-base leading-relaxed text-pretty lg:text-left">
            Nothing is linked yet, so there is nothing to lose. Pick whichever of
            these sounds like you.
          </p>

          <div className="flex flex-col gap-3">
            <StartingPointOption
              title="I&rsquo;ve been lifting elsewhere"
              description="Hevy, Strong, Wodify, or your own spreadsheet. Instant preview first — nothing is saved until you say so."
            >
              <Button
                className="w-full sm:w-auto"
                asChild
                onClick={() =>
                  gaEvent(GA_EVENT_TAGS.HOME_WELCOME_ACTION, {
                    action: "import_history",
                    destination: "/import",
                  })
                }
              >
                <Link
                  href={{
                    pathname: "/import",
                    query: { from: "home_welcome", returnTo: "/" },
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import My History
                </Link>
              </Button>
            </StartingPointOption>

            <StartingPointOption
              title="I&rsquo;m starting fresh"
              description="New to the barbell, or you have never kept a log. We create a Google Sheet you own and you log your first session into it."
            >
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  gaEvent(GA_EVENT_TAGS.HOME_WELCOME_ACTION, {
                    action: "create_sheet",
                  });
                  openSheetSetupDialog("bootstrap");
                }}
              >
                <img
                  src={GOOGLE_SHEETS_ICON_URL}
                  alt=""
                  className="mr-2 h-4 w-4 shrink-0"
                  aria-hidden
                />
                Create My Lifting Log
              </Button>
            </StartingPointOption>
          </div>

          <p className="text-muted-foreground mt-3 text-center text-xs lg:text-left">
            Free forever. Your data stays yours.
          </p>
        </div>

        {/* The Big Four in the slot the public hero gives to product screenshots.
            Nothing here needs a sheet, so it stays useful for as long as the
            lifter takes to decide. */}
        <div>
          <p className="text-muted-foreground mb-3 text-center text-sm font-semibold tracking-wide uppercase lg:text-left">
            Or start by learning the lifts
          </p>
          <BigFourLiftCards
            lifts={lifts}
            animated={false}
            enhancedStats={false}
            gridClassName="grid grid-cols-1 gap-4 sm:grid-cols-2"
          />
        </div>
      </div>

      <StarterContentRail articles={starterArticles} />
    </div>
  );
}
