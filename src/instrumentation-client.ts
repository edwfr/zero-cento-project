// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { shouldDropClientEvent } from "@/lib/sentry-filters";

Sentry.init({
  dsn: "https://6f6bb89cfb277fd8523a512ddb9fd313@o4511254075539456.ingest.de.sentry.io/4511254077243472",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Drop browser noise (aborted fetches, stale chunks, extensions) to protect the free-plan quota.
  beforeSend(event) {
    return shouldDropClientEvent(event) ? null : event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
