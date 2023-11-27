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
      if (account?.access_token) {
        token.access_token = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.access_token; // Give the user the access_token from Google
      return session;
    },
  },
};

export default NextAuth(authOptions);
