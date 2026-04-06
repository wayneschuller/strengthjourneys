import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { kv } from "@vercel/kv";
import { Resend } from "resend";
import { shouldSendFounderNotification } from "@/lib/founder-notifications";
import { isLeaderboardAdminEmail } from "@/lib/playlist-security";
import { devLog } from "@/lib/processing-utils";

const scopes = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
];
const REQUIRED_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function getUserKvKeys(email) {
  if (!email) return { exactKey: null, normalizedKey: null };

  const exactEmail = String(email);
  const normalizedEmail = exactEmail.trim().toLowerCase();
  return {
    exactKey: `sj:user:${exactEmail}`,
    normalizedKey: `sj:user:${normalizedEmail}`,
  };
}

function getGrantedScopeSupportMeta(account) {
  const grantedScopeString =
    typeof account?.scope === "string" && account.scope.trim().length > 0
      ? account.scope.trim()
      : typeof account?.granted_scope === "string" &&
          account.granted_scope.trim().length > 0
        ? account.granted_scope.trim()
        : null;

  if (!grantedScopeString) {
    return {
      grantedScopesKnown: false,
      grantedScopes: null,
      hasRequiredDriveScope: null,
    };
  }

  const grantedScopes = grantedScopeString.split(/\s+/).filter(Boolean);
  return {
    grantedScopesKnown: true,
    grantedScopes,
    hasRequiredDriveScope: grantedScopes.includes(REQUIRED_DRIVE_SCOPE),
  };
}

/**
 * Takes a token, and returns a new token with updated
 * `accessToken` and `accessTokenExpires`. If an error occurs,
 * returns the old token and an error property
 */
async function refreshAccessToken(token) {
  devLog(`refreshAccessToken()...`);

  try {
    const url =
      "https://oauth2.googleapis.com/token?" +
      new URLSearchParams({
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      });

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    devLog(`... Google happily issued a refreshed token!`);

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000, // Google will normally give us: {expires_in: 3599}
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    console.error("[next-auth] refreshAccessToken failed:", error);

    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: scopes.join(" "),
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      const grantedScopeMeta = getGrantedScopeSupportMeta(account);
      await persistSignInSupportMeta(user?.email, grantedScopeMeta);
      const signInMeta = await getSignInSupportMeta(user?.email);
      await promptDeveloper("sign-in", user, {
        ...signInMeta,
        ...grantedScopeMeta,
      });
      return true;
    },
    async jwt({ token, user, account }) {
      // account && user will be active on first time log in only
      // See: https://next-auth.js.org/configuration/callbacks
      if (account && user) {
        devLog(`Next-auth JWT callback: Fresh login to Google detected...`);
        devLog(account);

        // Return the key JWT information that next-auth stores in an encrypted cookie
        return {
          accessToken: account.access_token,

          // Ok - Google servers seem not to give us expires_in field on first login.
          // So we are just going to calculate an expiry of 1 hour (or 58 minutes)
          // Note - Google API will return a weird and irrelevant "expires_at" field
          accessTokenExpires: Date.now() + 60 * 58 * 1000,

          refreshToken: account.refresh_token,
          user,
        };
      }

      // Return previous JWT token if the access token has not expired yet
      if (Date.now() < token.accessTokenExpires) {
        // devLog(`Not expired yet phew. I'll give you our secret JWT token`);
        return token;
      }

      // Access token has likely expired, try to update using our refresh token
      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      // devLog(token);
      session.user = token.user;
      session.user.isLeaderboardAdmin = isLeaderboardAdminEmail(
        session.user?.email,
      );
      session.accessToken = token.accessToken;
      session.error = token.error;

      return session;
    },
  },
};

export default NextAuth(authOptions);

// ---------------------------------------------------------------------------
// Prompts the developer to offer personal support to users at key moments
// (sign-in, activation, meaningful return activity). Failures are swallowed
// and never affect the caller.
// ---------------------------------------------------------------------------

function friendlyDate(isoString) {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysAgo(isoString) {
  const days = Math.floor(
    (Date.now() - new Date(isoString).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

const PROMPT_MESSAGES = {
  "sign-in": (name, email, timeStr, meta) => ({
    subject:
      meta.hasRequiredDriveScope === false
        ? `[SJ] Sign-in missing Drive scope — ${name}`
        : `[SJ] Sign-in — ${name}`,
    text: [
      `${name} (${email}) signed in at ${timeStr}.`,
      meta.hasRequiredDriveScope != null
        ? `Drive scope granted: ${meta.hasRequiredDriveScope ? "yes" : "no"}`
        : meta.grantedScopesKnown === false
          ? "Drive scope granted: unknown"
          : null,
      Array.isArray(meta.grantedScopes) && meta.grantedScopes.length > 0
        ? `Granted scopes: ${meta.grantedScopes.join(", ")}`
        : null,
      meta.kvLookupFailed ? `KV lookup failed: ${meta.kvLookupFailed}` : null,
      meta.hasKvRecord != null ? `KV record exists: ${meta.hasKvRecord ? "yes" : "no"}` : null,
      meta.firstSignInAt
        ? `First sign-in seen: ${friendlyDate(meta.firstSignInAt)}`
        : null,
      meta.lastSignInAt
        ? `Last sign-in seen: ${friendlyDate(meta.lastSignInAt)} (${daysAgo(meta.lastSignInAt)})`
        : null,
      meta.signInCount != null ? `Sign-in count: ${meta.signInCount}` : null,
      meta.connectedAt ? `Connected at: ${friendlyDate(meta.connectedAt)}` : null,
      meta.lastSeenAt
        ? `Last seen: ${friendlyDate(meta.lastSeenAt)} (${daysAgo(meta.lastSeenAt)})`
        : null,
      meta.connectionMethod ? `Connection method: ${meta.connectionMethod}` : null,
      meta.provisioningMethod ? `Provisioning method: ${meta.provisioningMethod}` : null,
      meta.provisionedSheetId != null
        ? `Provisioned sheet ID exists: ${meta.provisionedSheetId ? "yes" : "no"}`
        : null,
      meta.activationPromptedAt
        ? `Activation prompt sent: ${friendlyDate(meta.activationPromptedAt)}`
        : null,
      meta.returnPromptedAt
        ? `Return prompt sent: ${friendlyDate(meta.returnPromptedAt)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  }),
  activated: (name, email, timeStr, meta) => ({
    subject: `[SJ] Activated — ${name}`,
    text: [
      `${name} (${email}) activated at ${timeStr}.`,
      meta.connectionMethod
        ? `Connection method: ${meta.connectionMethod}`
        : null,
      meta.provisioningMethod
        ? `Provisioning method: ${meta.provisioningMethod}`
        : null,
      meta.sheetName ? `Sheet: ${meta.sheetName}` : null,
      meta.rowCount != null ? `Rows: ${meta.rowCount}` : null,
      `\nThey're set up and in the app. Worth a welcome message.`,
    ]
      .filter(Boolean)
      .join("\n"),
  }),
  returning: (name, email, timeStr, meta) => ({
    subject: `[SJ] Returning user — ${name}`,
    text: [
      `${name} (${email}) returned and is active at ${timeStr}.`,
      meta.connectionMethod
        ? `Connection method: ${meta.connectionMethod}`
        : null,
      meta.rowCount != null ? `Rows: ${meta.rowCount}` : null,
      meta.lastActiveAt
        ? `Previous activity: ${friendlyDate(meta.lastActiveAt)} (${daysAgo(meta.lastActiveAt)})`
        : null,
      meta.connectedAt
        ? `Member since: ${friendlyDate(meta.connectedAt)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  }),
  reprovisioned: (name, email, timeStr, meta) => ({
    subject: `[SJ] Reprovisioned after missing sheet — ${name}`,
    text: [
      `${name} (${email}) was reprovisioned at ${timeStr}.`,
      meta.connectionMethod
        ? `Connection method: ${meta.connectionMethod}`
        : null,
      meta.provisioningMethod
        ? `Provisioning method: ${meta.provisioningMethod}`
        : null,
      meta.sheetName ? `New sheet: ${meta.sheetName}` : null,
      meta.previousProvisionedSheetId != null
        ? `Previous sheet ID existed: ${meta.previousProvisionedSheetId ? "yes" : "no"}`
        : null,
      meta.previousSheetState
        ? `Previous sheet state: ${meta.previousSheetState}`
        : null,
      meta.previousSheetName
        ? `Previous sheet name: ${meta.previousSheetName}`
        : null,
      meta.previousSheetHttpStatus != null
        ? `Previous sheet check status: ${meta.previousSheetHttpStatus}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  }),
  "onboarding-success": (name, email, timeStr, meta) => ({
    subject: `[SJ] Onboarding success — ${name}`,
    text: [
      `${name} (${email}) completed onboarding at ${timeStr}.`,
      meta.intent ? `Intent: ${meta.intent}` : null,
      meta.resultAction ? `Result action: ${meta.resultAction}` : null,
      meta.reason ? `Reason: ${meta.reason}` : null,
      meta.connectionMethod ? `Connection method: ${meta.connectionMethod}` : null,
      meta.provisioningMethod ? `Provisioning method: ${meta.provisioningMethod}` : null,
      meta.ssid != null ? `Sheet ID exists: ${meta.ssid ? "yes" : "no"}` : null,
      meta.sheetName ? `Sheet: ${meta.sheetName}` : null,
      meta.hadLocalSheetBefore != null
        ? `Had local sheet before: ${meta.hadLocalSheetBefore ? "yes" : "no"}`
        : null,
      meta.durationMs != null ? `Flow duration: ${meta.durationMs}ms` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  }),
  "onboarding-aborted": (name, email, timeStr, meta) => ({
    subject: `[SJ] Onboarding aborted — ${name}`,
    text: [
      `${name} (${email}) aborted onboarding at ${timeStr}.`,
      meta.intent ? `Intent: ${meta.intent}` : null,
      meta.state ? `State when closed: ${meta.state}` : null,
      meta.reason ? `Reason: ${meta.reason}` : null,
      meta.hadLocalSheetBefore != null
        ? `Had local sheet before: ${meta.hadLocalSheetBefore ? "yes" : "no"}`
        : null,
      meta.durationMs != null ? `Flow duration: ${meta.durationMs}ms` : null,
      meta.provisionError ? `Last error: ${meta.provisionError}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  }),
  "onboarding-failed": (name, email, timeStr, meta) => ({
    subject: `[SJ] Onboarding failed — ${name}`,
    text: [
      `${name} (${email}) hit an onboarding failure at ${timeStr}.`,
      meta.intent ? `Intent: ${meta.intent}` : null,
      meta.state ? `State: ${meta.state}` : null,
      meta.reason ? `Reason: ${meta.reason}` : null,
      meta.hadLocalSheetBefore != null
        ? `Had local sheet before: ${meta.hadLocalSheetBefore ? "yes" : "no"}`
        : null,
      meta.durationMs != null ? `Flow duration: ${meta.durationMs}ms` : null,
      meta.provisionError ? `Error: ${meta.provisionError}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  }),
  "large-import": (name, email, timeStr, meta) => ({
    subject: `[SJ] Large import hit request limit — ${name}`,
    text: [
      `${name} (${email}) hit the large-import save limit at ${timeStr}.`,
      meta.page ? `Page: ${meta.page}` : null,
      meta.fileName ? `File: ${meta.fileName}` : null,
      meta.entryCount != null ? `Entries: ${meta.entryCount}` : null,
      meta.payloadBytes != null ? `Payload bytes: ${meta.payloadBytes}` : null,
      meta.payloadMb != null ? `Payload MB: ${meta.payloadMb}` : null,
      meta.reason ? `Reason: ${meta.reason}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  }),
  "import-merged": (name, email, timeStr, meta) => ({
    subject: `[SJ] Import merged — ${name}`,
    text: [
      `${name} (${email}) merged imported history at ${timeStr}.`,
      meta.formatName ? `Format: ${meta.formatName}` : null,
      meta.entryCount != null ? `Imported entries: ${meta.entryCount}` : null,
      meta.insertedRows != null ? `Inserted rows: ${meta.insertedRows}` : null,
      meta.dateCount != null ? `Imported dates: ${meta.dateCount}` : null,
      meta.liftTypeCount != null ? `Lift types: ${meta.liftTypeCount}` : null,
      meta.bigFourEntryCount != null
        ? `Big Four entries: ${meta.bigFourEntryCount}`
        : null,
      meta.bigFourLiftCount != null
        ? `Big Four lift types present: ${meta.bigFourLiftCount}`
        : null,
      meta.unitSystem ? `Units: ${meta.unitSystem}` : null,
      meta.dateRange ? `Date range: ${meta.dateRange}` : null,
      meta.topLiftTypes ? `Top lifts: ${meta.topLiftTypes}` : null,
      meta.durationMs != null ? `Merge duration: ${meta.durationMs}ms` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  }),
};

async function getSignInSupportMeta(email) {
  if (!email) return {};

  try {
    const { exactKey, normalizedKey } = getUserKvKeys(email);
    const record =
      (await kv.get(exactKey)) ||
      (normalizedKey !== exactKey ? await kv.get(normalizedKey) : null) ||
      null;

    return {
      hasKvRecord: Boolean(record && Object.keys(record).length > 0),
      connectedAt: record?.connectedAt || null,
      lastSeenAt: record?.lastSeenAt || null,
      connectionMethod: record?.connectionMethod || null,
      provisioningMethod: record?.provisioningMethod || null,
      provisionedSheetId: record?.provisionedSheetId || null,
      activationPromptedAt: record?.activationPromptedAt || null,
      returnPromptedAt: record?.returnPromptedAt || null,
      firstSignInAt: record?.firstSignInAt || null,
      lastSignInAt: record?.lastSignInAt || null,
      signInCount:
        typeof record?.signInCount === "number" ? record.signInCount : null,
    };
  } catch (error) {
    return {
      kvLookupFailed: error?.message || "unknown KV error",
    };
  }
}

async function persistSignInSupportMeta(email, grantedScopeMeta) {
  if (!email) return;

  const { exactKey, normalizedKey } = getUserKvKeys(email);
  if (!exactKey) return;

  const existingRecord =
    (await kv.get(exactKey)) ||
    (normalizedKey !== exactKey ? await kv.get(normalizedKey) : null) ||
    {};
  const nowIso = new Date().toISOString();
  const currentCount =
    typeof existingRecord?.signInCount === "number" &&
    Number.isFinite(existingRecord.signInCount)
      ? existingRecord.signInCount
      : 0;

  const nextRecord = {
    ...existingRecord,
    firstSignInAt: existingRecord.firstSignInAt || nowIso,
    lastSignInAt: nowIso,
    signInCount: currentCount + 1,
  };

  if (grantedScopeMeta.grantedScopesKnown) {
    nextRecord.lastGrantedScopes = grantedScopeMeta.grantedScopes || [];
  }
  if (grantedScopeMeta.hasRequiredDriveScope != null) {
    nextRecord.lastRequiredDriveScopeGranted =
      grantedScopeMeta.hasRequiredDriveScope;
  }

  await kv.set(exactKey, nextRecord);
}

export async function promptDeveloper(event, user, meta = {}) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.FEEDBACK_EMAIL_TO;
    if (!apiKey || !to || !user?.email) return;
    if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") return;
    if (!shouldSendFounderNotification(event)) return;

    const name = user.name || user.email;
    const timeStr =
      new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "UTC",
      }) + " UTC";

    const builder = PROMPT_MESSAGES[event];
    if (!builder) return;

    const { subject, text } = builder(name, user.email, timeStr, meta);
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "Strength Journeys <feedback@updates.strengthjourneys.xyz>",
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error(`[personal-support] promptDeveloper(${event}) failed:`, err);
  }
}
