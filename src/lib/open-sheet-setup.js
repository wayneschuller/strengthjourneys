/**
 * Opens the shared sheet-setup dialog from anywhere in the app.
 * The optional `action` detail is reserved for rare recovery rails like
 * "resume saving imported preview data" after a scope repair.
 */
export const OPEN_SHEET_SETUP_EVENT = "open-sheet-setup";

export function openSheetSetupDialog(intent = "bootstrap", options = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPEN_SHEET_SETUP_EVENT, {
      detail: {
        intent,
        action: options?.action || null,
      },
    }),
  );
}
