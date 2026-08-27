import { readUserRecord } from "@/lib/user-kv-keys";
import { parseData } from "@/lib/data-sources/import-dispatcher";
import { getTrainingRewardMetrics } from "@/lib/rewards/progression";

/*
 * Server-verified training metrics.
 *
 * Theme progress is computed client-side, which is fine for deciding what colours someone sees.
 * It is not fine for deciding how much their vote is worth: a number the browser asserts is a
 * number the browser can invent, and making vote weight visible only sharpens the incentive.
 *
 * So the server reads the sheet itself, with the user's own OAuth token, and runs the same
 * parser the app uses. Claiming a higher tier would mean owning a Google Sheet that genuinely
 * contains that much logged training — at which point it isn't really a forgery.
 *
 * Deliberately stateless. Nothing derived from the sheet is written anywhere: no spreadsheet
 * id, no counters, no cached verdict. The sheet read route sets the boundary — "never store
 * lift data, sheet contents, or anything read from the sheet" — and a vote is not a good reason
 * to widen it. The cost is a Sheets read per weight lookup, softened by the private HTTP cache
 * on /api/vote-weight and the ten minute vote throttle.
 *
 * A spreadsheet id supplied by the client is used for the life of the request and then dropped.
 */

const SHEETS_TIMEOUT_MS = 8000;

async function fetchSheetValues(ssid, accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(ssid)}/values/A:Z?dateTimeRenderOption=FORMATTED_STRING`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(SHEETS_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data?.values) ? data.values : null;
}

/**
 * Resolves the caller's training metrics by reading their sheet. Stores nothing.
 *
 * @param {Object} params
 * @param {Object} params.session - next-auth session; needs user.email and accessToken.
 * @param {string} [params.ssid] - Spreadsheet id from the client, used for this request only.
 * @returns {Promise<Object|null>} Metrics object, or null when we cannot establish any.
 */
export async function getVerifiedTrainingMetrics({ session, ssid }) {
  const email = session?.user?.email;
  if (!email || !session.accessToken) return null;

  const { record } = await readUserRecord(email);

  // Prefer an id the app already holds from provisioning or linking. Otherwise fall back to the
  // one the client passed, for this request only — it is never written back.
  const sheetId =
    record?.provisionedSheetId || (typeof ssid === "string" ? ssid : null);
  if (!sheetId) return null;

  try {
    const values = await fetchSheetValues(sheetId, session.accessToken);
    if (!values) return null;

    return getTrainingRewardMetrics(parseData(values));
  } catch (error) {
    console.error("Could not verify training metrics:", error.message);
    return null;
  }
}
