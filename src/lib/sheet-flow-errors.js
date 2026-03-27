/**
 * Classifies rare sheet-flow failures into stable client-facing codes.
 * Keep this narrowly focused on recovery rails so normal onboarding stays
 * optimized for the common case and callers do not branch on raw API strings.
 */

export const SHEET_FLOW_ERROR_CODES = {
  GOOGLE_DRIVE_SCOPE_MISSING: "google_drive_scope_missing",
};

const GOOGLE_DRIVE_SCOPE_PATTERNS = [
  /insufficient authentication scopes/i,
  /request had insufficient authentication scopes/i,
  /access_token_scope_insufficient/i,
];

export function classifySheetFlowError(error) {
  const message =
    typeof error?.message === "string" && error.message.trim().length > 0
      ? error.message.trim()
      : "";

  if (
    GOOGLE_DRIVE_SCOPE_PATTERNS.some((pattern) => pattern.test(message))
  ) {
    return {
      code: SHEET_FLOW_ERROR_CODES.GOOGLE_DRIVE_SCOPE_MISSING,
      httpStatus: 403,
      userMessage:
        "Strength Journeys needs Google Drive access before it can create your sheet.",
    };
  }

  return {
    code: null,
    httpStatus: 500,
    userMessage: message,
  };
}

