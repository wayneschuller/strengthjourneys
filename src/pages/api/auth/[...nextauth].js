import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
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
  devLog(`refreshAccessToken() called:`);

  try {
    const url =
      "https://oauth2.googleapis.com/token?" +
      new URLSearchParams({
        clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
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

    devLog(`here is the response from Google:`);
    devLog(refreshedTokens);

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + 60 * 58 * 1000, // WS modified - just calculate one hour
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

export default NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
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
    async jwt({ token, user, account }) {
      // devLog(`Our nextauth JWT token`);
      // devLog(token);

      // account && user will be active on first time log in only
      // See: https://next-auth.js.org/configuration/callbacks
      if (account && user) {
        devLog(`FRESH login to google detected...`);
        devLog(account);

        // Return the key JWT information that next-auth will store in an encrypted cookie
        return {
          accessToken: account.access_token,
          accessTokenExpires: Date.now() + 60 * 58 * 1000, // WS modified - just add one hour minus 2 minutes
          refreshToken: account.refresh_token,
          user,
        };
      }

      devLog(
        `token.accessTokenExpires: ${token.accessTokenExpires} ${new Date(
          token.accessTokenExpires,
        ).toLocaleString()}`,
      );

      // Return previous JWT token if the access token has not expired yet
      if (Date.now() < token.accessTokenExpires) {
        devLog(`Not expired yet phew. I'll give you our secret JWT token`);
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

      // FIXME: nextauth somehow inserts session.expires somewhere which is just +60minutes.
      // We could put in the real session.expires from token.accessTokenExpires ?
      // session.expires = new Date(token.accessTokenExpires).toISOString(); // WS: If we don't pass this then next-auth just gives 60 minutes from now - it doesn't matter but it annoys me otherwise

      return session;
    },
  },
});
