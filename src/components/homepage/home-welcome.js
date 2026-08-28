/**
 * Activation home for a lifter who is signed in but has no linked sheet.
 *
 * This is a third home state, not a variant of the hero. The hero's job is to
 * convince a stranger to sign in; this user already did, so re-arguing the case
 * wastes the whole fold and reads as though the app did not notice them. The
 * dashboard is no better — it is a mirror, and there is nothing yet to reflect.
 *
 * So the job here is activation: name the lifter, then ask the one question that
 * actually branches — is their training history in another app, or are they
 * starting to log here? An importer with five years of Hevy data does not want
 * to be told how to squat; a genuine beginner does.
 *
 * Three populations reach this page, not two:
 *   1. new lifters, with no history anywhere
 *   2. Strength Journeys users on a new device, whose sheet is sitting in Drive
 *   3. experienced lifters whose history lives in another app
 *
 * Only two of them get a branch. The setup dialog auto-opens for anyone signed
 * in without a linked sheet, and it searches Drive before it offers to create
 * anything — so case 2 is normally solved before this page is ever seen. The
 * case-2 lifter who ends up here is one who dismissed that dialog, which makes
 * this a recovery path rather than a peer decision, and it gets the quieter
 * line beneath the fork. It still has to be visible: someone with ten years of
 * training they cannot currently see is in the most alarming state on the site,
 * and needs to be told the sheet is still there.
 *
 * Case 3 is deliberately routed to import before sheet setup. The preview runs
 * entirely client-side, so they see their own history rendered before we ask
 * for Drive scope — the ask lands at loss aversion rather than at suspicion,
 * and a refusal still leaves them a working session.
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
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BigFourLiftCards } from "@/components/homepage/big-four-lift-cards";
import { StarterContentRail } from "@/components/homepage/starter-content-rail";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";

/*
 * Entrance choreography. The page arrives in reading order — who you are, what we are asking,
 * then the two ways out — so the eye is led rather than presented with everything at once.
 *
 * Only opacity and transform are animated, both of which Motion drops automatically for anyone
 * with prefers-reduced-motion set, because _app.js wraps the tree in MotionConfig
 * reducedMotion="user". Those lifters get the same layout, arriving instantly.
 */
const columnStagger = {
  hidden: {},
  show: { transition: { delayChildren: 0.15, staggerChildren: 0.07 } },
};

const riseIn = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 240, damping: 26 },
  },
};

const optionsStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

// The lifts arrive a beat after the headline: they are the invitation, not the ask.
const showcaseIn = {
  hidden: { opacity: 0, y: 26, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: 0.3, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const railIn = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.55, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * One branch of the "where are you starting from?" fork. Both branches carry
 * equal visual weight on purpose — we genuinely do not know which lifter this
 * is, so pre-picking one for them would just be a guess wearing a primary
 * button.
 */
function StartingPointOption({ title, description, children }) {
  return (
    <motion.div
      variants={riseIn}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="border-border bg-card hover:border-foreground/25 flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {description}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </motion.div>
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
    <motion.div className="w-full" initial="hidden" animate="show">
      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-2 xl:gap-12">
        <motion.div variants={columnStagger}>
          <motion.p
            variants={riseIn}
            className="text-muted-foreground text-center text-sm font-semibold tracking-wide uppercase lg:text-left"
          >
            You&rsquo;re signed in
          </motion.p>
          <motion.h1
            variants={riseIn}
            className="mt-3 mb-4 text-center text-3xl leading-tight font-extrabold tracking-tight text-balance lg:text-left lg:text-4xl"
          >
            {firstName ? `Welcome, ${firstName}.` : "Welcome."}
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            Let&rsquo;s find your starting point.
          </motion.h1>
          <motion.p
            variants={riseIn}
            className="text-muted-foreground mb-6 max-w-xl text-center text-base leading-relaxed text-pretty lg:text-left"
          >
            Nothing is linked yet, so there is nothing to lose. Pick whichever of
            these sounds like you.
          </motion.p>

          <motion.div variants={optionsStagger} className="flex flex-col gap-3">
            <StartingPointOption
              title="I&rsquo;ve been training in another app"
              description="Hevy, Strong, Wodify, or your own spreadsheet. See it here instantly — nothing is saved until you say so."
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
              title="I want to start logging here"
              description="We&rsquo;ll set up a Google Sheet you own, and you can log your first session into it today."
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
                Set Up My Lifting Log
              </Button>
            </StartingPointOption>
          </motion.div>

          {/* The recovery path for a returning lifter whose sheet is already in Drive. Quiet,
              because the setup dialog auto-opens and normally resolves this before the page is
              seen — anyone reading it here dismissed that dialog. Visible, because they have
              training history they currently cannot see, and need telling it still exists. */}
          <motion.p
            variants={riseIn}
            className="text-muted-foreground mt-4 text-center text-xs lg:text-left"
          >
            Used Strength Journeys before?{" "}
            <button
              type="button"
              onClick={() => {
                gaEvent(GA_EVENT_TAGS.HOME_WELCOME_ACTION, {
                  action: "recover_existing_sheet",
                });
                openSheetSetupDialog("bootstrap");
              }}
              className="text-foreground font-medium underline underline-offset-4 hover:no-underline"
            >
              We&rsquo;ll find your sheet in Drive.
            </button>
          </motion.p>

          <motion.p
            variants={riseIn}
            className="text-muted-foreground mt-2 text-center text-xs lg:text-left"
          >
            Free forever. Your data stays yours.
          </motion.p>
        </motion.div>

        {/* The Big Four in the slot the public hero gives to product screenshots.
            Nothing here needs a sheet, so it stays useful for as long as the
            lifter takes to decide. */}
        <motion.div variants={showcaseIn}>
          <p className="text-muted-foreground mb-3 text-center text-sm font-semibold tracking-wide uppercase lg:text-left">
            Or start by learning the lifts
          </p>
          <BigFourLiftCards
            lifts={lifts}
            animated={false}
            enhancedStats={false}
            gridClassName="grid grid-cols-1 gap-4 sm:grid-cols-2"
          />
        </motion.div>
      </div>

      <motion.div variants={railIn}>
        <StarterContentRail articles={starterArticles} />
      </motion.div>
    </motion.div>
  );
}
