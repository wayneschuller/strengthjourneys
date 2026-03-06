export const OPEN_SHEET_SETUP_EVENT = "open-sheet-setup";

export function openSheetSetupDialog(intent = "bootstrap") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPEN_SHEET_SETUP_EVENT, {
      detail: { intent },
    }),
  );
}
