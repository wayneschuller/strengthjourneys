// GET /api/sheet/read?ssid=<spreadsheetId>
//
// Reads all data from the user's Google Sheet and returns it to the client for
// parsing. This is the primary data-fetch route — SWR in use-userlift-data.js
// calls it on mount, focus, and reconnect.
//
// Two Google APIs are called in parallel:
//   • Sheets API (values A:Z) — returns raw row/column data
//   • Drive API (file metadata) — returns filename, webViewLink, modifiedTime,
//     and trashed status. If trashed, responds 404 so the UI can prompt re-link.
//
// Query:
//   ssid: string  — Google Spreadsheet ID (from localStorage sheetInfo)
//
// Returns: Google Sheets values payload + { name, webViewLink, modifiedTime,
//          modifiedByMeTime } merged in from Drive. The client passes this to
//          parseData() to produce the ParsedData array.
//
// Post-response side effect: updates a KV record (sj:user:<email>) to track
// last-seen time and trigger a one-time "returning user" founder notification
// within 7 days of first connection and after a 12-hour gap. It also keeps
// lightweight sheet-read date/count metadata for support and Google Sheets API
// usage optimisation; it must not store lift data or sheet contents.

import { authOptions, promptDeveloper } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { kv } from "@/lib/kv";
import { getUserKvKey } from "@/lib/user-kv-keys";
import { devLog } from "@/lib/processing-utils";

// The client unlinks a sheet and starts recovery only when a response carries
// this code. It marks a status as Google's own answer about this sheet: it is
// gone, in the trash, not ours to open, or not a spreadsheet the API can
// read. A bare 400, 403 or 404 can come from anything between the browser and
// Google, and none of those is a reason to forget a lifter's sheet.
const SHEET_UNAVAILABLE = "SHEET_UNAVAILABLE";
const SHEET_UNAVAILABLE_STATUSES = [400, 403, 404];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const RETURN_WINDOW_MS = 7 * ONE_DAY_MS;
const RETURN_GAP_MS = 12 * 60 * 60 * 1000;

export default async function handler(req, res) {
  // Start session fetch immediately
  const sessionPromise = getServerSession(req, res, authOptions);

  // Extract ssid from query immediately (synchronous operation)
  const { ssid } = req.query;

  // Validate ssid early (before waiting for session)
  if (!ssid || ssid === "null") {
    res.status(400).json({ error: "Missing ssid parameter" });
    return;
  }

  // Now await session (we've done all synchronous work first)
  const session = await sessionPromise;

  if (!session) {
    res.status(401).json({ error: "You must be logged in." });
    return;
  }

  // 401, not 400: a missing token is an auth problem, not a sheet problem,
  // and must never read as one.
  if (!session.accessToken) {
    res.status(401).json({ error: "Auth missing accessToken" });
    return;
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
  };

  try {
    const t0 = Date.now();
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A:Z?dateTimeRenderOption=FORMATTED_STRING`;
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${ssid}?fields=name,trashed,webViewLink,modifiedTime,modifiedByMeTime`;

    // The browser may say "I have read these rows in full, and nothing I know
    // of has changed them since" (see mayAnswerUnchanged in
    // use-userlift-data.js). For those reads Drive is asked first, and if its
    // modifiedTime is the one the browser holds, the rows are not fetched at
    // all: the browser keeps its copy. Every other read fetches both at once.
    const knownModifiedTime = req.headers["x-sheet-modified-time"] ?? null;
    const browserCopyTag = req.headers["if-none-match"] ?? null;
    const mayAnswerUnchanged =
      req.headers["x-sheet-unchanged-ok"] === "1" &&
      Boolean(knownModifiedTime) &&
      Boolean(browserCopyTag);

    let sheetsMs = null;
    let driveMs = null;

    const startSheetsFetch = () => {
      const startedAt = Date.now();
      return fetch(sheetsUrl, { method: "GET", headers }).then((res) => {
        sheetsMs = Date.now() - startedAt;
        return res;
      });
    };
    const drivePromise = fetch(driveUrl, { method: "GET", headers }).then(
      (res) => {
        driveMs = Date.now() - t0;
        return res;
      },
    );

    let sheetsRes = null;
    let driveRes;
    if (mayAnswerUnchanged) {
      driveRes = await drivePromise;
    } else {
      [sheetsRes, driveRes] = await Promise.all([
        startSheetsFetch(),
        drivePromise,
      ]);
      if (driveMs > sheetsMs) {
        devLog(
          `read-sheet ANOMALY: Drive slower than Sheets (sheets=${sheetsMs}ms, drive=${driveMs}ms) - Drive metadata must not be the bottleneck; investigate Drive slowness.`,
        );
      }
    }

    const driveData = driveRes.ok ? await driveRes.json() : null;
    if (driveData?.trashed) {
      res.status(404).json({
        error: "This Google Sheet is in the trash.",
        code: SHEET_UNAVAILABLE,
      });
      return;
    }

    if (
      mayAnswerUnchanged &&
      driveData?.modifiedTime &&
      driveData.modifiedTime === knownModifiedTime
    ) {
      res.setHeader("ETag", browserCopyTag);
      res.status(304).end();
      logRead({
        path: "skipped",
        driveMs,
        totalMs: Date.now() - t0,
      });
      await recordSheetRead({ session, ssid, rowCount: null });
      return;
    }

    if (!sheetsRes) sheetsRes = await startSheetsFetch();

    const bodyStartedAt = Date.now();
    const data = await sheetsRes.json();
    const bodyMs = Date.now() - bodyStartedAt;

    if (!sheetsRes.ok) {
      // Extract Google's own error message (format: { error: { message, code, status } })
      const googleMessage =
        data?.error?.message ||
        sheetsRes.statusText ||
        "Unknown error from Google Sheets API";
      console.error(
        `[read-sheet] Google Sheets API ${sheetsRes.status}: ${googleMessage}`,
        { ssid },
      );
      res.status(sheetsRes.status).json({
        error: googleMessage,
        ...(SHEET_UNAVAILABLE_STATUSES.includes(sheetsRes.status)
          ? { code: SHEET_UNAVAILABLE }
          : {}),
      });
      return;
    }

    if (driveData) {
      Object.assign(data, {
        name: driveData.name,
        webViewLink: driveData.webViewLink,
        modifiedTime: driveData.modifiedTime,
        modifiedByMeTime: driveData.modifiedByMeTime,
      });
    }

    const sendStartedAt = Date.now();
    res.status(200).json(data);
    const sendMs = Date.now() - sendStartedAt;

    const rowCount = data.values?.length ?? 0;
    logRead({
      path: mayAnswerUnchanged ? "driveFirst" : "full",
      rowCount,
      modifiedState: !driveData?.modifiedTime
        ? "modifiedTime unavailable"
        : !knownModifiedTime
          ? "no earlier modifiedTime from this browser"
          : knownModifiedTime === driveData.modifiedTime
            ? "modifiedTime unchanged"
            : "modifiedTime changed",
      // Next answers 304 when the rows match the copy the browser holds.
      rowsState:
        res.statusCode === 304
          ? "rows unchanged"
          : browserCopyTag
            ? "rows changed"
            : "browser had no copy",
      driveMs,
      sheetsMs,
      bodyMs,
      sendMs,
      totalMs: Date.now() - t0,
    });

    await recordSheetRead({ session, ssid, rowCount });
  } catch (error) {
    // Google's own 4xx responses are passed through above. Anything thrown
    // here is a network failure reaching Google (DNS, timeout, offline dev
    // box), so answer 502 and let the client retry.
    console.error("[read-sheet] could not reach Google:", error);
    res.status(502).json({ error: "Could not reach Google Sheets." });
  }
}

// Prompts the developer to offer personal support at key moments, and keeps
// the read counts. Runs after the response is sent so the user never waits
// for this. `rowCount` is null when the rows were not fetched.
async function recordSheetRead({ session, ssid, rowCount }) {
  try {
    const kvKey = getUserKvKey(session.user.email);
    const record = (await kv.get(kvKey)) || {};
    const now = new Date();
    const nowIso = now.toISOString();
    const todayKey = nowIso.slice(0, 10);
    const meta = { rowCount };
    const sheetReadDays =
      record.sheetReadDays && typeof record.sheetReadDays === "object"
        ? record.sheetReadDays
        : {};
    const currentDayReads =
      typeof sheetReadDays[todayKey] === "number" &&
      Number.isFinite(sheetReadDays[todayKey])
        ? sheetReadDays[todayKey]
        : 0;
    const currentTotalReads =
      typeof record.sheetReadCount === "number" &&
      Number.isFinite(record.sheetReadCount)
        ? record.sheetReadCount
        : 0;

    const nextRecord = {
      ...record,
      connectedAt: record.connectedAt || nowIso,
      connectionMethod: record.connectionMethod || "manual_picker",
      lastSeenAt: nowIso,
      lastSheetReadAt: nowIso,
      lastSheetReadDate: todayKey,
      sheetReadCount: currentTotalReads + 1,
      // Privacy boundary: this is per-user support metadata for debugging
      // data-loading issues and optimising Google Sheets API usage. Store
      // successful read dates/counts only; never store lift data, sheet
      // contents, full request history, or anything read from the sheet.
      sheetReadDays: {
        ...sheetReadDays,
        [todayKey]: currentDayReads + 1,
      },
    };

    // Missing KV on a successful sheet read usually means a pre-KV legacy user
    // returning via existing local browser state. Quietly backfill instead of
    // sending a false "newly activated" email.
    if (!record.activationPromptedAt) {
      nextRecord.connectionMethod =
        record.connectionMethod || "legacy_local_relink";
      nextRecord.provisionedSheetId = record.provisionedSheetId || ssid;
      nextRecord.activationPromptedAt = nowIso;
      devLog("[sheet-flow] legacy KV backfill after successful local relink", {
        email: session.user.email,
        ssid,
      });
    }

    // Return email (once) if user came back after a meaningful gap and still within
    // a short post-activation window where feedback is most useful.
    const lastSeenMs = record.lastSeenAt
      ? new Date(record.lastSeenAt).getTime()
      : null;
    const connectedMs = nextRecord.connectedAt
      ? new Date(nextRecord.connectedAt).getTime()
      : null;
    const withinReturnWindow =
      typeof connectedMs === "number" &&
      Number.isFinite(connectedMs) &&
      now.getTime() - connectedMs <= RETURN_WINDOW_MS;
    const meaningfulGap =
      typeof lastSeenMs === "number" &&
      Number.isFinite(lastSeenMs) &&
      now.getTime() - lastSeenMs >= RETURN_GAP_MS;

    if (
      nextRecord.activationPromptedAt &&
      !record.returnPromptedAt &&
      withinReturnWindow &&
      meaningfulGap
    ) {
      await promptDeveloper("returning", session.user, {
        ...meta,
        connectionMethod: nextRecord.connectionMethod,
        lastActiveAt: record.lastSeenAt,
        connectedAt: nextRecord.connectedAt,
      });
      nextRecord.returnPromptedAt = nowIso;
    }

    await kv.set(kvKey, nextRecord);
  } catch (err) {
    console.error("[personal-support] sheet activity check failed:", err);
  }
}

// One line per read, in production too, saying which way the read went and
// where the time was spent. It is how to tell whether asking Drive first is
// paying for itself, and whether Drive's modifiedTime keeps up with the rows.
function logRead({
  path,
  rowCount,
  modifiedState,
  rowsState,
  driveMs,
  sheetsMs,
  bodyMs,
  sendMs,
  totalMs,
}) {
  if (path === "skipped") {
    console.log(
      `[read-sheet] Rows fetch skipped: Drive metadata returned in ${driveMs}ms with modifiedTime unchanged since this browser's last full read, so the browser keeps the copy it has. Whole request ${totalMs}ms.`,
    );
    return;
  }

  const handling = `Then ${bodyMs}ms to download and parse the rows and ${sendMs}ms to fingerprint and send them. Whole request ${totalMs}ms.`;

  if (path === "driveFirst") {
    console.log(
      `[read-sheet] Drive asked first: metadata returned in ${driveMs}ms (modifiedTime changed), so ${rowCount} rows were fetched in a further ${sheetsMs}ms (${rowsState}). ${handling}` +
        (rowsState === "rows unchanged"
          ? " Only the timestamp had moved: usually Drive catching up with a change this browser already had."
          : ""),
    );
    return;
  }

  console.log(
    `[read-sheet] Full read (first load, or the app asked for one): Drive metadata returned in ${driveMs}ms (${modifiedState}); ${rowCount} rows fetched concurrently in ${sheetsMs}ms (${rowsState}). ${handling}` +
      (modifiedState === "modifiedTime unchanged" &&
      rowsState === "rows changed"
        ? " Drive's modifiedTime had not caught up with this change yet, which is why reads after a change never ask Drive first."
        : ""),
  );
}
