// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://48a48e3d8c2c371a93df3873c9b3f861@o4507546876444672.ingest.us.sentry.io/4507546877952000",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.feedbackIntegration({
      // Additional SDK configuration goes in here, for example:
      colorScheme: "system",
      triggerLabel: "Give fast feedback",
      formTitle: "Fast Feedback",
      nameLabel: "Name (optional)",
      emailLabel: "Email (optional)",
      messagePlaceholder:
        "What features do you need? Is there a bug? What can we improve?",
      submitButtonLabel: "Send Feedback",
      successMessageText: "Thanks for your feedback!",
    }),
  ],
});
