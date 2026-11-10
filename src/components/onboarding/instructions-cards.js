import { openSheetSetupDialog } from "@/lib/sheet/open-sheet-setup";
import { Button } from "@/components/ui/button";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import Image from "next/image";
import { Check, FileUp } from "lucide-react";
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";

import SampleImage from "../../../public/sample_google_sheet_fuzzy_border.png";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/sheet/google-sheets-icon";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Full-width card explaining the three-step setup process: log lifts in a Google Sheet,
 * sign in, connect the sheet, then explore the app. Adapts its CTAs to auth state.
 *
 * @param {Object} props - No props; reads session and sheet context internally.
 */
export function GettingStartedCard() {
  const { status: authStatus } = useSession();

  const { sheetInfo, dataSource } = useUserLiftingData();
  const isConnected = !!sheetInfo?.ssid;

  if (authStatus === "authenticated" && isConnected) return null;
  if (dataSource === "restoring") return null;

  return (
    <Card
      data-first-visit=""
      className="relative overflow-hidden border hover:ring-0"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
      >
        <div className="from-primary/10 absolute -top-20 left-8 h-64 w-64 rounded-full bg-gradient-to-br to-transparent blur-3xl" />
        <div className="from-chart-2/15 absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-gradient-to-tr to-transparent blur-3xl" />
      </div>
      <CardHeader className="relative">
        <div className="bg-background/85 text-muted-foreground mb-3 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-sm">
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-4 w-4 shrink-0"
            aria-hidden
          />
          Google Sheets setup, simplified
        </div>
        <CardTitle className="max-w-2xl text-2xl tracking-tight md:text-3xl">
          Track the lifts that got you here. See what&apos;s next.
        </CardTitle>
        <CardDescription className="max-w-2xl text-base leading-relaxed">
          Sign in once and Strength Journeys sets up your lifting log, then
          turns every session into PR history, e1RM trends, tonnage charts, and
          a full training dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: "🏋️",
                text: "Built for serious lifting history, not generic workout logging.",
              },
              {
                icon: "📊",
                text: "Every set becomes a data point: PRs, trends, and session recaps.",
              },
              {
                icon: "🔒",
                text: "Your data lives in your own Google Sheet, not on our servers.",
              },
            ].map(({ icon, text }) => (
              <div
                key={text}
                className="bg-card/85 ring-border rounded-2xl p-4 text-sm leading-relaxed shadow-sm ring-1"
              >
                <span className="mb-2 block text-lg">{icon}</span>
                {text}
              </div>
            ))}
          </div>
          <div className="bg-background/75 ring-border flex flex-col items-start gap-4 rounded-2xl p-5 shadow-sm ring-1">
            {authStatus !== "authenticated" ? (
              <>
                <GoogleSignInButton
                  size="lg"
                  className="gap-2 px-6"
                  iconSize={18}
                  cta="getting_started_card"
                >
                  Start tracking your lifts
                </GoogleSignInButton>
                <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
                  Free forever. No app to install.{" "}
                  <Link
                    href="/privacy-policy.html"
                    className="hover:text-foreground underline"
                  >
                    Your data lives in your own Google Sheet
                  </Link>
                  .
                </p>
                <p className="text-muted-foreground text-sm">
                  Already have lifting data?{" "}
                  <Link
                    href="/import"
                    className="hover:text-foreground underline"
                  >
                    Import a CSV
                  </Link>{" "}
                  to explore the app instantly.
                </p>
              </>
            ) : isConnected ? (
              <div className="text-primary inline-flex items-center gap-2 text-sm font-medium">
                <Check className="h-4 w-4" />
                Your lifting log is connected.
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                Signed in. Strength Journeys is setting up your dashboard above.
              </div>
            )}
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.4 }}
          className="bg-card/90 mx-auto w-full max-w-sm overflow-hidden rounded-3xl border p-3 shadow-sm lg:mx-0 lg:ml-auto"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                The spreadsheet we set up for you
              </p>
              <p className="text-muted-foreground text-xs">
                Clean rows. Fast logging. Built to age well.
              </p>
            </div>
            <a
              href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground shrink-0 text-sm underline underline-offset-4 transition-colors"
            >
              Preview design
            </a>
          </div>
          <div className="bg-background overflow-hidden rounded-2xl border shadow-inner">
            <Image
              src={SampleImage}
              alt="Preview of the Strength Journeys Google Sheets lifting log design"
              className="h-auto w-full scale-[1.01]"
              priority={false}
            />
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}

/**
 * Vertical card for the Strength Year in Review sidebar when user is signed in
 * but has not connected a Google Sheet yet. Prompts them to connect so they
 * can see their real recap instead of demo data.
 */
export function ConnectSheetRecapCard() {
  const { dataSource } = useUserLiftingData();

  if (dataSource !== "none") return null;

  return (
    <Card className="flex min-w-[14rem] flex-col md:min-w-[18rem]">
      <CardHeader className="space-y-2 pt-6 pb-5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-5 w-5 shrink-0"
            aria-hidden
          />
          See your year in review
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Start your lifting log, or import your history from another app, and
          your recap builds itself from your own sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-2 pb-8">
        <Button
          size="default"
          className="flex w-full items-center justify-center gap-2"
          onClick={() => {
            openSheetSetupDialog("bootstrap");
          }}
        >
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-4 w-4 shrink-0"
            aria-hidden
          />
          Choose Data Source
        </Button>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your recap will show sessions, tonnage, PRs, most-trained lifts, and
          seasonal patterns — all from your own data.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Stands in for a data page's charts when a signed-in lifter has no log yet.
 * Starting a log runs the usual sheet setup, which also asks again for Drive
 * access if it was declined; importing previews another app's history.
 *
 * @param {Object} props
 * @param {string} props.payoff - What this page shows once there are lifts, e.g. "Your tonnage chart".
 */
export function StartLiftingLogCard({ payoff }) {
  const router = useRouter();
  const { dataSource } = useUserLiftingData();

  if (dataSource !== "none") return null;

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">Start your lifting log</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          {payoff} fills in from your own sessions. Log your first set, or bring
          your history over from another app.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1.5">
          <Button
            className="flex items-center gap-2"
            onClick={() => openSheetSetupDialog("bootstrap")}
          >
            <img
              src={GOOGLE_SHEETS_ICON_URL}
              alt=""
              className="h-4 w-4 shrink-0"
              aria-hidden
            />
            Start my lifting log
          </Button>
          <p className="text-muted-foreground text-xs">
            A free Google Sheet in your own Drive.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Button variant="outline" asChild>
            <Link
              href={{ pathname: "/import", query: { returnTo: router.asPath } }}
              className="flex items-center gap-2"
            >
              <FileUp className="h-4 w-4" />
              Import from another app
            </Link>
          </Button>
          <p className="text-muted-foreground text-xs">
            Preview first, save when you&apos;re ready.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Vertical card for demo mode sidebars (e.g. Strength Year in Review).
 * Compact layout to fit narrow columns; other instruction cards are horizontal.
 */
export function DemoModeSignInCard() {
  const { status: authStatus } = useSession();
  const { dataSource } = useUserLiftingData();

  if (authStatus === "authenticated") return null;
  if (dataSource === "restoring") return null;

  return (
    <Card
      data-first-visit=""
      className="flex min-w-[14rem] flex-col md:min-w-[18rem]"
    >
      <CardHeader className="space-y-2 pt-6 pb-5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-5 w-5 shrink-0"
            aria-hidden
          />
          See your year
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          This is sample data. Sign in to create your lifting log automatically
          or import the data you already have.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-2 pb-8">
        <GoogleSignInButton
          size="default"
          className="flex w-full items-center justify-center gap-2"
          iconSize={18}
          cta="year_recap_card"
        >
          Sign in with Google
        </GoogleSignInButton>
        <div className="text-muted-foreground space-y-5 text-sm">
          <p className="leading-relaxed">
            Your recap will show your sessions, tonnage, PRs, most-trained
            lifts, and seasonal patterns — all from your own data.
          </p>
          <ol className="list-inside list-decimal space-y-3 leading-relaxed">
            <li>Sign in with Google.</li>
            <li>
              New here? We can create your lifting log automatically in your
              Google Drive.
            </li>
            <li>
              Already have data? Import a file or choose an existing Google
              Sheet.
            </li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
