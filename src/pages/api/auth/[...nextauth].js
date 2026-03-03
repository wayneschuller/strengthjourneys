import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { Resend } from "resend";
import { devLog } from "@/lib/processing-utils";

const scopes = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
];

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
    console.log(error);

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
    async signIn({ user }) {
      await promptDeveloper("sign-in", user);
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
      session.accessToken = token.accessToken;
      session.error = token.error;

      return session;
    },
  },
};

export default NextAuth(authOptions);

// ---------------------------------------------------------------------------
// Prompts the developer to offer personal support to users at key moments
// (sign-in, first sheet connection, ongoing activity). Failures are swallowed
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
  "sign-in": (name, email, timeStr) => ({
    subject: `[SJ] Sign-in — ${name}`,
    text: `${name} (${email}) signed in at ${timeStr}.`,
  }),
  "sheet-connected": (name, email, timeStr, meta) => ({
    subject: `[SJ] Sheet connected — ${name}`,
    text: [
      `${name} (${email}) connected their sheet at ${timeStr}.`,
      meta.rowCount != null ? `Rows: ${meta.rowCount}` : null,
      `\nThey're set up and in the app. Worth a welcome message.`,
    ]
      .filter(Boolean)
      .join("\n"),
  }),
  active: (name, email, timeStr, meta) => ({
    subject: `[SJ] Active — ${name}`,
    text: [
      `${name} (${email}) is using the app. Seen at ${timeStr}.`,
      meta.rowCount != null ? `Rows: ${meta.rowCount}` : null,
      meta.lastActiveAt
        ? `Last active: ${friendlyDate(meta.lastActiveAt)} (${daysAgo(meta.lastActiveAt)})`
        : null,
      meta.connectedAt
        ? `Member since: ${friendlyDate(meta.connectedAt)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  }),
};

export async function promptDeveloper(event, user, meta = {}) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.FEEDBACK_EMAIL_TO;
    if (!apiKey || !to || !user?.email) return;

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
