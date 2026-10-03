# Sentry Observability & Triage — Design

**Date:** 2026-10-03
**Status:** Approved (design), pending spec review
**Branch / worktree:** `feature/sentry-observability` in `.worktrees/sentry-observability` (from `origin/development`)

## Goal

Use Sentry as the real source of truth for server errors and as input for fixing
bugs with Claude Code:

1. **Capture**: every unexpected 500 from the API layer reaches Sentry with useful
   context (user id, role, release).
2. **Access**: Claude Code can read Sentry issues through the Sentry MCP server.
3. **Triage**: an on-demand project skill (`/sentry-triage`) produces a report of
   the most impactful issues with probable cause and proposed fix. Report only.

## Context / problem

- `@sentry/nextjs` v10 is configured (server, edge, client) and source maps are
  uploaded via `withSentryConfig`.
- `src/instrumentation.ts` exports `onRequestError = Sentry.captureRequestError`,
  which only sees **unhandled** errors.
- API routes (`src/app/api/**`, ~84 `catch` blocks) catch everything, log with pino
  and return `apiError('INTERNAL_ERROR', …, 500)`. Those errors **never reach
  Sentry**. Today Sentry only receives React render errors (`error.tsx`,
  `global-error.tsx`) and a few manual `captureException` calls.
- No user/role context is attached to events.

## Constraints

- **Sentry Developer (free) plan**: 5,000 errors/month, 1 user. Over quota, events
  are dropped (no charge). Capture must be limited to genuine 500s; 4xx are never
  sent. Noise must be filtered to protect the quota.
- Seer (Sentry's AI autofix) is paid and not used; Claude Code does the analysis.
- `sendDefaultPii: false` stays: no email, name or cookies in events.
- Client-facing API responses must not change (same `code`, `message`, `key`, status).

## Part 1 — Capture and context

### 1a. `src/lib/api-error-handler.ts` (new)

```ts
export function handleApiError(
    error: unknown,
    opts: { message: string; key?: string; context?: Record<string, unknown> }
): Response
```

Behavior:

- `error instanceof Response` → return it unchanged, no Sentry call (this is how
  `requireAuth` / `requireRole` guards short-circuit today).
- Otherwise:
  - `logger.error({ err: error, ...opts.context }, opts.message)` — key `err` so pino
    serializes the stack (current code uses `{ error }`).
  - `Sentry.captureException(error, { tags: { area: 'api' }, extra: opts.context })`.
  - return `apiError('INTERNAL_ERROR', opts.message, 500, undefined, opts.key)`.

Route path and HTTP method come from the Next.js SDK request scope; they are not
passed manually.

### 1b. Route migration

- Standard catch blocks (`if (error instanceof Response) return error` +
  `logger.error` + `apiError(…, 500, …)`) become
  `return handleApiError(error, { message, key })`, keeping each route's existing
  message and i18n key verbatim.
- Catch blocks with special handling (e.g. Prisma `P2002` → 409, validation → 400)
  keep their branches; only the final 500 fallback is replaced by
  `handleApiError`. Non-500 branches do not call Sentry.

### 1c. User context

In `requireAuth()` (`src/lib/auth.ts`), after the Prisma user is loaded:

```ts
Sentry.setUser({ id: user.id })
Sentry.setTag('role', user.role)
```

No email or name.

### 1d. Release and noise filtering

- Release: verify the SDK picks up `VERCEL_GIT_COMMIT_SHA` on Vercel builds; if it
  does not, set `release` explicitly in the Sentry configs.
- Client `beforeSend` (`src/instrumentation-client.ts`): drop `AbortError`,
  `ChunkLoadError` (stale chunks after a deploy) and errors whose frames all come
  from browser extensions (`chrome-extension://`, `moz-extension://`).

### 1e. Tests

- Unit tests for `handleApiError` (`tests/unit/api-error-handler.test.ts`) with
  `@sentry/nextjs` and the logger mocked:
  - `Response` input → same response returned, `captureException` not called;
  - `Error` input → `captureException` called once, response is 500 with
    `code: 'INTERNAL_ERROR'`, given `message` and `key`;
  - no `key` → response has no `key` field.
- Add `src/lib/api-error-handler.ts` to the coverage list in `vitest.config.ts`.
- Existing unit/integration tests for routes must stay green; tests that assert on
  `logger.error` call shape are updated to the new `err` key.

## Part 2 — Sentry MCP in Claude Code

- Commit a project `.mcp.json`:

  ```json
  { "mcpServers": { "sentry": { "type": "http", "url": "https://mcp.sentry.dev/mcp" } } }
  ```

- Auth is OAuth on first use (`/mcp` → sentry → Authenticate); no secret in the repo.
- Reachability verified on 2026-10-03 from the dev machine: `mcp.sentry.dev`
  answers `401` (auth required) in ~0.3 s, so the remote server is usable; no
  local fallback needed.
- Add a short "Sentry" section to `CLAUDE.md`: how to authenticate the MCP server,
  org `zerocento`, project `javascript-nextjs`, and that `/sentry-triage` exists.

## Part 3 — `/sentry-triage` skill (on-demand)

- Location: `.claude/skills/sentry-triage/SKILL.md` in the **main tree**, alongside
  the existing project skills. `.claude` is gitignored, so the skill is local and
  not part of the branch.
- Invocation:
  - `/sentry-triage` → unresolved issues, last 7 days;
  - `/sentry-triage <period>` (e.g. `14d`) → custom window;
  - `/sentry-triage <ISSUE-ID>` → deep analysis of one issue (debug use case).
- Flow:
  1. List unresolved issues via Sentry MCP, sorted by event count and users affected.
  2. Classify each: **new** (first seen in window), **regressed**, **growing**,
     **stable/noise**.
  3. For the top 5 by impact: read stacktrace and breadcrumbs, open the repo files
     referenced by in-app frames, state probable cause and proposed fix.
  4. Flag noisy issues that should be filtered in `beforeSend`.
- Output (in chat):
  - summary table: issue id, title, events, users, role tag, first-seen release;
  - per highlighted issue: probable cause, `file:line`, proposed fix, confidence
    (high / medium / low);
  - monthly quota usage if the MCP exposes it.
- Hard rule in the skill: **report only**. No code edits, no GitHub issues, no PRs.
  A fix starts only on explicit user request, via the normal workflow
  (systematic-debugging).
- Verification: one real run after the user has authenticated the MCP server.

## Out of scope

- Scheduled/cloud triage routine (possible later: a `/schedule` routine reusing
  the same skill).
- Automatic GitHub issues or fix PRs.
- Session Replay, performance tuning of `tracesSampleRate`, Sentry Logs.
- Client-side capture of failed `fetch` calls (the server already captures 500s).

## Success criteria

- A forced 500 inside a migrated route's `try` block (temporary local change, an
  authenticated request, not committed) shows up in Sentry with stacktrace, `role`
  tag, user id and release. The existing `sentry-example-api` is not a valid check:
  it throws uncaught and is already captured by `onRequestError`.
- 4xx responses produce no Sentry events.
- `npm run type-check`, `npm run lint`, `npm run test:unit` pass.
- `/sentry-triage` produces a report from real Sentry data after MCP login.
- `implementation-docs/CHANGELOG.md` updated.
