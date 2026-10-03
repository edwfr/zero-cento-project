// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { shouldDropClientEvent } from "@/lib/sentry-filters";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV,
  // Same sampling as server/edge; keeps span usage within the free plan.
  tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  enableLogs: true,
  // No PII (IP address, request headers) — aligned with server/edge.
  sendDefaultPii: false,

  // Drop browser noise (aborted fetches, stale chunks, extensions) to protect the free-plan quota.
  beforeSend(event) {
    return shouldDropClientEvent(event) ? null : event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
