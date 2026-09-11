/**
 * The notice at the top of the read-only lift gallery that preview visitors
 * see. Demo and imported views can browse every lift but cannot log, so this
 * says so plainly and offers the one step that turns the gallery on.
 */

import Image from "next/image";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { PENDING_SHEET_ACTIONS } from "@/lib/pending-sheet-action";

export function PreviewLogCta({ isDemoMode = false, isImportedData = false }) {
  const { status: authStatus } = useSession();
  const isAuthenticated = authStatus === "authenticated";

  const message = isImportedData
    ? isAuthenticated
      ? "Save your imported history to a Google Sheet and one tap on any of these lifts starts a new set."
      : "Sign in with Google to save your imported history, and one tap on any of these lifts starts a new set."
    : isAuthenticated
      ? "Link your Google Sheet and one tap on any of these lifts starts a set in your own log."
      : "This log is a demo. Sign in with Google and one tap on any of these lifts starts a set in your own log.";

  return (
    <div className="border-primary/25 bg-primary/5 flex flex-col items-start gap-3 rounded-xl border border-dashed px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        {isDemoMode && <DemoModeBadge size="sm" />}
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
      {isAuthenticated ? (
        <Button
          size="sm"
          className="shrink-0 gap-2"
          onClick={() => {
            openSheetSetupDialog("bootstrap", {
              action: isImportedData
                ? PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT
                : null,
            });
          }}
        >
          <Image
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4"
            aria-hidden
          />
          {isImportedData
            ? "Save imported data to my sheet"
            : "Set up sheet to enable logging"}
        </Button>
      ) : (
        <GoogleSignInButton
          size="sm"
          cta="log_lift_gallery"
          callbackUrl="/log"
          className="shrink-0"
        >
          {isImportedData ? "Sign in to save imported data" : "Sign in to start logging"}
        </GoogleSignInButton>
      )}
    </div>
  );
}
