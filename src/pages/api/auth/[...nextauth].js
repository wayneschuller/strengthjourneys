import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

const scopes = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
];

const JWT_SECRET = String(process.env.NEXTAUTH_SECRET);

const authorizationUrl = new URL(
  "https://accounts.google.com/o/oauth2/v2/auth",
);
authorizationUrl.searchParams.set("prompt", "consent");
authorizationUrl.searchParams.set("access_type", "offline");
authorizationUrl.searchParams.set("response_type", "code");

export const authOptions = {
  // Configure one or more authentication providers
  providers: [
    GoogleProvider({
      clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorizationUrl: authorizationUrl.toString(),
      scope: scopes.join(" "),
    }),
  ],
  secret: JWT_SECRET,
  jwt: {
    encryption: true,
    secret: JWT_SECRET,
  },
  debug: process.env.NODE_ENV === "development",
  callbacks: {
    jwt: async (token, user, account) => {
      console.log(token);
      console.log(account);
      if (account) {
        token.accessToken = account?.accessToken;
        token.refreshToken = account?.refreshToken;
      }

      return token;
    },
    session: async (session, user) => {
      session.accessToken = user.accessToken;
      session.refreshToken = user.refreshToken;

      return session;
    },
  },
};

export default NextAuth(authOptions);
