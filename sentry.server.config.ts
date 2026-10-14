import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV,
  // Local dev errors (DB hiccups, HMR) are not worth triaging and eat the free-plan quota.
  enabled: process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_APP_ENV !== "development",
  tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  enableLogs: true,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request?.cookies) delete event.request.cookies
    return event
  }
});