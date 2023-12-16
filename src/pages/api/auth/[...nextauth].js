import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const scopes = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
];

export const authOptions = {
  // Configure one or more authentication providers
  providers: [
    GoogleProvider({
      clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: scopes.join(" "),
        },
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, account }) => {
      if (account) {
        console.log(`account not undefined!`);
        console.log(account);
      }

      if (token?.refreshToken) {
        console.log(`refresh token found in the wild`);
        console.log(token);
      }

      if (account?.access_token) {
        token.access_token = account.access_token;
      }

      // If possible pass forward the refresh_token - not sure if this works.
      // More info here: https://github.com/nextauthjs/next-auth-refresh-token-example/blob/main/pages/api/auth/%5B...nextauth%5D.js
      if (account?.refresh_token) {
        token.refresh_token = account.refresh_token;
      }
      return token;
    },
    async session({ session, token }) {
      // console.log(`session callback:`);

      session.accessToken = token.access_token; // Give the user the access_token from Google
      session.refreshToken = token.refreshToken;

      // console.log(session);

      return session;
    },
  },
};

export default NextAuth(authOptions);
