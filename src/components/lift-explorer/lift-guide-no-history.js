/**
 * What a progress guide shows in place of the analysis when the visitor has
 * no history for the lift yet.
 *
 * A signed-in lifter with a sheet gets the log prompt for this lift, since one
 * set is all the page needs. Everyone else (demo mode, an imported file that
 * lacks this lift, or signed in without a sheet) gets the sign-in request with
 * the import drop target, so a visitor can see their own history here without
 * making an account. Nothing renders while auth or a returning lifter's data
 * is still resolving, so nobody with history is ever asked to sign in.
 */

import Image from "next/image";
import { useSession } from "next-auth/react";

import { LiftLogCta } from "@/components/lift-explorer/lift-log-cta";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { ImportWorkflowSection } from "@/components/onboarding/import-workflow-section";
import { Button } from "@/components/ui/button";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { formatDateToYmdLocal } from "@/lib/date-utils";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";

// The card repeats on every guide without data, so its words rotate by lift
// and day rather than reading identically page after page.
const SIGNED_OUT_COPY = [
  {
    title: "See your {lift} progress here",
    description:
      "Sign in with Google to start a free lifting log in your own Google Sheet, or drop a workout export below to preview your {lift} history right now.",
  },
  {
    title: "Bring your {lift} history to life",
    description:
      "Your sets become charts, PRs and milestones on this page. Sign in to keep a free log in Google Sheets, or preview an export from Hevy, Strong or a spreadsheet first.",
  },
  {
    title: "Chart every {lift} set you have done",
    description:
      "Sign in with Google and your {lift} sessions become a progress chart, rep records and a training timeline. Tracking somewhere else already? Drop the export below.",
  },
  {
    title: "Your {lift} story starts here",
    description:
      "Log sets in a free Google Sheet you own and this page fills with your progress. Have history in another app? Drop the file below for an instant preview.",
  },
  {
    title: "Put your {lift} numbers on this page",
    description:
      "Sign in to track {lift} in your own Google Sheet, or drop an export from your current app to see your history charted in seconds.",
  },
];

const SIGNED_IN_NO_SHEET_DESCRIPTION =
  "Connect a Google Sheet to keep a free lifting log you own, or drop a workout export below to preview your {lift} history right now.";

/**
 * @param {Object} props
 * @param {string} props.liftType - The lift the guide is about.
 */
export function LiftGuideNoHistory({ liftType }) {
  const { status: authStatus } = useSession();
  const { hasUserData, isImportedData, isLoading, isReturningUserLoading } =
    useUserLiftingData();

  if (authStatus === "loading" || isReturningUserLoading) return null;

  // Linked sheet, no sets of this lift: invite the first one.
  if (hasUserData && !isImportedData) {
    if (isLoading) return null;
    return <LiftLogCta liftType={liftType} />;
  }

  const isAuthenticated = authStatus === "authenticated";
  const copy = pickVariant(
    SIGNED_OUT_COPY,
    `${formatDateToYmdLocal(new Date())}:${liftType}`,
  );
  const fill = (text) => text.replaceAll("{lift}", liftType);

  return (
    <ImportWorkflowSection
      title={fill(copy.title)}
      description={fill(
        isAuthenticated ? SIGNED_IN_NO_SHEET_DESCRIPTION : copy.description,
      )}
      className="bg-card rounded-lg border p-5 shadow-sm md:p-6"
    >
      {isAuthenticated ? (
        <Button
          className="gap-2"
          onClick={() => openSheetSetupDialog("bootstrap")}
        >
          <Image
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4"
            aria-hidden
          />
          Connect Google Sheet
        </Button>
      ) : (
        <GoogleSignInButton cta="lift_guide_no_history" iconSize={16}>
          Sign in with Google
        </GoogleSignInButton>
      )}
    </ImportWorkflowSection>
  );
}

/** A stable choice from a variant set for a given seed. */
function pickVariant(variants, seed) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return variants[hash % variants.length];
}
