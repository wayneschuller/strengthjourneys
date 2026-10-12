/**
 * Loads the sheet setup dialog only once a lifter is signed in.
 * The dialog does nothing for a signed-out visitor, yet it is one of the
 * largest pieces of the app shell, so the layout mounts this instead and the
 * dialog's code stays out of every signed-out page load.
 */

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  OPEN_SHEET_SETUP_EVENT,
  openSheetSetupDialog,
} from "@/lib/sheet/open-sheet-setup";

export function SheetSetupDialogLoader() {
  const { status: authStatus } = useSession();
  // Kept once loaded, so the dialog is still mounted to tidy up after itself
  // when the lifter signs out.
  const [Dialog, setDialog] = useState(null);
  const [, setIsSetupDismissed] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHEET_SETUP_DISMISSED,
    false,
    { initializeWithValue: false },
  );
  const missedOpenRef = useRef(null);

  useEffect(() => {
    if (authStatus !== "authenticated" || Dialog) return undefined;
    let cancelled = false;
    import("@/components/onboarding/sheet-setup-dialog")
      .then((module) => {
        if (!cancelled) setDialog(() => module.SheetSetupDialog);
      })
      .catch((error) => {
        console.error("[sheet-setup] dialog failed to load:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus, Dialog]);

  // The dialog forgets a dismissed setup whenever it sees a signed-out
  // visitor. It is no longer mounted for one who arrives signed out, so the
  // same reset happens here.
  useEffect(() => {
    if (authStatus === "unauthenticated") setIsSetupDismissed(false);
  }, [authStatus, setIsSetupDismissed]);

  // A signed-in lifter can ask for setup in the moment before the dialog has
  // loaded. Keep the request and hand it over once the dialog is listening.
  // Requests from signed-out visitors were never acted on and still are not.
  useEffect(() => {
    if (Dialog || authStatus !== "authenticated") return undefined;
    const rememberOpen = (event) => {
      missedOpenRef.current = event?.detail || {};
    };
    window.addEventListener(OPEN_SHEET_SETUP_EVENT, rememberOpen);
    return () => {
      window.removeEventListener(OPEN_SHEET_SETUP_EVENT, rememberOpen);
    };
  }, [authStatus, Dialog]);

  // Runs after the dialog's own effects on the render that first mounts it,
  // so its listener is already in place.
  useEffect(() => {
    const missed = missedOpenRef.current;
    if (!Dialog || !missed) return;
    missedOpenRef.current = null;
    openSheetSetupDialog(missed.intent, { action: missed.action });
  }, [Dialog]);

  return Dialog ? <Dialog /> : null;
}
