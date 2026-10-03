# Sentry Observability & Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every unexpected API 500 reach Sentry with user/role context, connect Claude Code to Sentry via MCP, and add an on-demand `/sentry-triage` report skill.

**Architecture:** A single helper `handleApiError()` replaces the duplicated `catch` tail in ~56 API route files: it logs with pino, calls `Sentry.captureException`, and returns the same `apiError(...)` 500 response as today. `requireAuth()` tags the Sentry scope with user id and role. A pure `shouldDropClientEvent()` filter protects the free-plan quota from browser noise. A committed `.mcp.json` exposes the remote Sentry MCP server; a local project skill drives triage from it.

**Tech Stack:** Next.js 15 App Router, `@sentry/nextjs` v10, pino, Vitest (jsdom), Claude Code MCP + skills.

**Spec:** `docs/superpowers/specs/2026-10-03-sentry-observability-design.md`

**Working directory:** `/mnt/c/dev-projects/zero-cento-project/.worktrees/sentry-observability` (branch `feature/sentry-observability`). Never write in the main tree, except Task 7 (skill file, gitignored `.claude/`).

## Global Constraints

- Sentry Developer (free) plan: 5,000 errors/month. Only genuine 500s are captured; 4xx never call Sentry.
- `sendDefaultPii: false` on server/edge stays; `Sentry.setUser` gets `{ id }` only — no email, no name.
- Client-facing API responses must not change: same `code`, `message`, `status`, `key` per route.
- Existing log messages are kept verbatim (only the payload key changes from `error` to `err`).
- `src/app/api/health/route.ts` is **not** migrated: it returns 503 with `details`, is polled, and would burn quota during a DB outage.
- Coverage: `src/lib/**` thresholds in `vitest.config.ts` are lines 94 / statements 94 / functions 97 / branches 88 — new lib files must meet them (they are picked up by the existing glob, no list edit needed).
- After each task that changes code, `implementation-docs/CHANGELOG.md` gets an entry (done once, in Task 6, covering all code tasks).
- Stage files explicitly (`git add <paths>`), never `git add -A`.

## Review Focus

1. Route that has a special non-500 branch inside the catch (e.g. Prisma P2002/P2003 → 409) — the 409 must still be returned and must **not** call Sentry. Pinned by the "special branch" rule in Task 3 and the integration tests that already cover 409s (`tests/integration/exercises.test.ts`).
2. Guard `Response` thrown by `requireRole`/ownership checks (401/403/404) inside a `try` — must pass through unchanged with no Sentry event. Pinned by Task 1 test "returns a thrown Response unchanged".
3. Non-`Error` throwables (string, plain object from Supabase) — must still produce the 500 and be captured. Pinned by Task 1 test "captures non-Error throwables".
4. A route file whose `logger` or `apiError` import becomes unused after migration — must not break `npm run lint` / `type-check`. Pinned by the lint step at the end of each migration task.
5. Unauthenticated request path — `requireAuth` throwing 401 must not set a Sentry user. Pinned by Task 2 test "does not set the Sentry user when unauthenticated".

---

### Task 1: `handleApiError` helper

**Files:**
- Create: `src/lib/api-error-handler.ts`
- Test: `tests/unit/lib/api-error-handler.test.ts`

**Interfaces:**
- Consumes: `apiError(code, message, status, details?, key?)` from `src/lib/api-response.ts`; `logger` from `src/lib/logger.ts`.
- Produces:
  ```ts
  export interface HandleApiErrorOptions {
      logMessage: string                 // pino message, kept verbatim from the old logger.error call
      message: string                    // client-facing message, kept verbatim from the old apiError call
      key?: string                       // i18n key, kept verbatim from the old apiError call
      context?: Record<string, unknown>  // ids that were in the old logger.error payload (programId, ...)
  }
  export function handleApiError(error: unknown, opts: HandleApiErrorOptions): Response
  ```
  Note: the spec sketch had a single `message`; routes log one text and return another, so the helper takes both to keep logs and responses unchanged.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lib/api-error-handler.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({
    captureException: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'

beforeEach(() => {
    vi.clearAllMocks()
})

describe('handleApiError', () => {
    it('returns a thrown Response unchanged without logging or capturing', () => {
        const guard = Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })

        const result = handleApiError(guard, { logMessage: 'x', message: 'y' })

        expect(result).toBe(guard)
        expect(Sentry.captureException).not.toHaveBeenCalled()
        expect(logger.error).not.toHaveBeenCalled()
    })

    it('captures an Error, logs it under err with context, and returns a 500', async () => {
        const boom = new Error('db down')

        const result = handleApiError(boom, {
            logMessage: 'Error fetching global admin report',
            message: 'Failed to fetch global report',
            key: 'internal.globalReportFailed',
            context: { programId: 'p1' },
        })

        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
        expect(Sentry.captureException).toHaveBeenCalledWith(boom, {
            tags: { area: 'api' },
            extra: { programId: 'p1' },
        })
        expect(logger.error).toHaveBeenCalledWith(
            { err: boom, programId: 'p1' },
            'Error fetching global admin report'
        )
        expect(result.status).toBe(500)
        expect(await result.json()).toEqual({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to fetch global report',
                key: 'internal.globalReportFailed',
            },
        })
    })

    it('omits key from the body when none is given', async () => {
        const result = handleApiError(new Error('x'), { logMessage: 'l', message: 'm' })

        const body = await result.json()
        expect(body.error).not.toHaveProperty('key')
        expect(body.error.message).toBe('m')
    })

    it('captures non-Error throwables', () => {
        const supabaseError = { message: 'rate limited', status: 429 }

        const result = handleApiError(supabaseError, { logMessage: 'l', message: 'm' })

        expect(Sentry.captureException).toHaveBeenCalledWith(supabaseError, {
            tags: { area: 'api' },
            extra: undefined,
        })
        expect(result.status).toBe(500)
    })
})
```

Note: `apiError` sets `details: undefined`, which `Response.json` drops, so `toEqual` on the body without `details` is correct.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/api-error-handler.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/api-error-handler"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/api-error-handler.ts`:

```ts
import * as Sentry from '@sentry/nextjs'
import { apiError } from './api-response'
import { logger } from './logger'

export interface HandleApiErrorOptions {
    /** pino message, kept verbatim from the route's previous logger.error call */
    logMessage: string
    /** client-facing message returned in the 500 body */
    message: string
    /** i18n key for the client-side error message */
    key?: string
    /** ids useful for debugging (programId, workoutId, ...) — sent to logs and Sentry extra */
    context?: Record<string, unknown>
}

/**
 * Shared catch tail for API route handlers.
 *
 * Guards (requireAuth/requireRole/ownership) throw a Response — those pass through
 * untouched. Anything else is an unexpected failure: log it, report it to Sentry,
 * and answer with a generic 500. Sentry is never called for 4xx.
 */
export function handleApiError(error: unknown, opts: HandleApiErrorOptions): Response {
    if (error instanceof Response) return error

    logger.error({ err: error, ...opts.context }, opts.logMessage)
    Sentry.captureException(error, { tags: { area: 'api' }, extra: opts.context })

    return apiError('INTERNAL_ERROR', opts.message, 500, undefined, opts.key)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/api-error-handler.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-error-handler.ts tests/unit/lib/api-error-handler.test.ts
git commit -m "feat(observability): add handleApiError reporting API 500s to Sentry"
```

---

### Task 2: Sentry user context in `requireAuth`

**Files:**
- Modify: `src/lib/auth.ts` (function `requireAuth`, ~line 221)
- Test: `tests/unit/lib/auth.test.ts` (`describe('requireAuth')`, ~line 234)

**Interfaces:**
- Consumes: `AuthSession` (`session.user.id`, `session.user.role`) already returned by `getSession()`.
- Produces: nothing new; side effect `Sentry.setUser({ id })` + `Sentry.setTag('role', role)` on every authenticated API call (including via `requireRole`).

- [ ] **Step 1: Write the failing tests**

In `tests/unit/lib/auth.test.ts`, add next to the existing `vi.mock('@/lib/supabase-server', ...)`:

```ts
vi.mock('@sentry/nextjs', () => ({
    setUser: vi.fn(),
    setTag: vi.fn(),
}))
```

and with the other imports:

```ts
import * as Sentry from '@sentry/nextjs'
```

Inside `describe('requireAuth', ...)` add:

```ts
    it('tags the Sentry scope with the user id and role, without PII', async () => {
        vi.mocked(Sentry.setUser).mockClear()
        vi.mocked(Sentry.setTag).mockClear()
        prismaMock.user.findUnique.mockResolvedValue(prismaUser as never)

        await requireAuth()

        expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'trainer-uuid-1' })
        expect(Sentry.setTag).toHaveBeenCalledWith('role', 'trainer')
    })

    it('does not set the Sentry user when unauthenticated', async () => {
        vi.mocked(Sentry.setUser).mockClear()
        getUser.mockResolvedValue({ data: { user: null }, error: null })

        await caught(requireAuth())

        expect(Sentry.setUser).not.toHaveBeenCalled()
    })
```

`prismaUser`, `prismaMock`, `getUser` and `caught()` already exist in this file (top of file and ~line 223). If `getSession` builds `user.id` from somewhere other than the Prisma row, adjust the expected id to whatever `(await requireAuth()).user.id` returns — the assertion is that `setUser` receives exactly `{ id: session.user.id }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/auth.test.ts -t "Sentry"`
Expected: FAIL — `setUser` not called.

- [ ] **Step 3: Implement**

In `src/lib/auth.ts` add the import at the top:

```ts
import * as Sentry from '@sentry/nextjs'
```

and change `requireAuth`:

```ts
export async function requireAuth(): Promise<AuthSession> {
    const session = await getSession()

    if (!session) {
        throw apiError(
            'UNAUTHORIZED',
            'Authentication required',
            401,
            undefined,
            AUTH_ERROR_KEYS.authenticationRequired
        )
    }

    // Attach who hit the error to any Sentry event in this request. Id only (no PII).
    Sentry.setUser({ id: session.user.id })
    Sentry.setTag('role', session.user.role)

    return session
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/lib/auth.test.ts`
Expected: PASS, all tests (old and new).

Also run the suites that import the real `@/lib/auth` to make sure the unmocked Sentry import is harmless in jsdom:
Run: `npx vitest run tests/integration/auth-session.test.ts tests/integration/rbac.test.ts`
Expected: PASS. If they fail on the `@sentry/nextjs` import, add `vi.mock('@sentry/nextjs', () => ({ setUser: vi.fn(), setTag: vi.fn(), captureException: vi.fn() }))` to `tests/unit/setup.ts` and re-run.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts tests/unit/lib/auth.test.ts
git commit -m "feat(observability): tag Sentry scope with user id and role in requireAuth"
```

---

### Task 3: Migrate API routes — batch A (all areas except `programs`, `trainee`, `users`)

**Files (modify):** every file returned by

```bash
grep -rl "INTERNAL_ERROR" src/app/api | grep -v -E "src/app/api/(programs|trainee|users|health)/"
```

(~25 files: `admin`, `auth`, `exercises`, `feedback`, `movement-pattern-colors`, `movement-patterns`, `muscle-groups`, `personal-records`, `subscription-renewals`, `trainee-measurements`, `trainer`, `weeks`).

**Interfaces:**
- Consumes: `handleApiError(error, { logMessage, message, key?, context? })` from `@/lib/api-error-handler` (Task 1).
- Produces: nothing new.

**Migration rules (apply to every `catch` that returns `apiError('INTERNAL_ERROR', …, 500, …)`):**

Rule 1 — standard tail. Before:

```ts
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error updating program skeleton')
        return apiError(
            'INTERNAL_ERROR',
            'Failed to update skeleton',
            500,
            undefined,
            'internal.default'
        )
    }
```

After:

```ts
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error updating program skeleton',
            message: 'Failed to update skeleton',
            key: 'internal.default',
            context: { programId },
        })
    }
```

- `logMessage` = second argument of the old `logger.error`, verbatim.
- `message` / `key` = second / fifth argument of the old `apiError`, verbatim. If the old call has no fifth argument, omit `key`.
- `context` = every property of the old `logger.error` payload **except** `error`. If only `error` was there, omit `context`.
- The multi-line `if (error instanceof Response) { return error }` variant is the same rule.
- If the old catch had no `instanceof Response` line, the rule still applies (the helper's pass-through is harmless).

Rule 2 — special branches. If the catch has branches that return a non-500 (e.g. `P2002` → 409 `CONFLICT`, Zod → 400), keep those branches exactly as they are, in the same order, and replace only the final 500 tail with `return handleApiError(...)`. Those branches must not call Sentry.

Rule 3 — inner try/catch that rethrows (e.g. `exercises/[id]/route.ts` P2003 block that `throw deleteError`): leave untouched; the rethrow reaches the outer catch, which is migrated by Rule 1.

Rule 4 — imports. Add `import { handleApiError } from '@/lib/api-error-handler'`. Remove `logger` and/or `apiError` from imports only if no other usage remains in the file (`logger.info`/`logger.warn` and 4xx `apiError` calls usually remain).

Rule 5 — non-500 `INTERNAL_ERROR` (e.g. 503): do not touch.

- [ ] **Step 1: Baseline**

Run: `npx vitest run tests/integration`
Expected: PASS. Record the pass count to compare after migration.

- [ ] **Step 2: Apply Rules 1–5 to every file in the batch**

Edit each file listed by the grep above.

- [ ] **Step 3: Verify no un-migrated 500 tail remains in the batch**

Run:
```bash
grep -rn -B1 -A4 "'INTERNAL_ERROR'" src/app/api | grep -v -E "src/app/api/(programs|trainee|users|health)/" | grep -E "500" ; echo "exit=$?"
```
Expected: no matching lines (`exit=1`).

- [ ] **Step 4: Type-check, lint, tests**

Run: `npm run type-check && npm run lint && npx vitest run tests/integration`
Expected: all PASS, same integration pass count as Step 1. Tests that triggered a 500 still see status 500 and the same `key`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api
git commit -m "refactor(api): report 500s to Sentry via handleApiError (batch A)"
```

---

### Task 4: Migrate API routes — batch B (`programs`)

**Files (modify):** every file returned by

```bash
grep -rl "INTERNAL_ERROR" src/app/api/programs
```

(~17 files, including `programs/[id]/skeleton/route.ts` and the `workouts/[workoutId]/exercises/**` routes with `{ error, programId, workoutId, exerciseId }` payloads).

**Interfaces:**
- Consumes: `handleApiError(error, { logMessage, message, key?, context? })` from `@/lib/api-error-handler`.
- Produces: nothing new.

**Migration rules:** identical to Task 3, repeated here so this task stands alone.

Rule 1 — standard tail. Before:

```ts
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error(
            { error, programId, workoutId },
            'Error adding exercise to workout'
        )
        return apiError('INTERNAL_ERROR', 'Failed to add exercise to workout', 500, undefined, 'internal.default')
    }
```

After:

```ts
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error adding exercise to workout',
            message: 'Failed to add exercise to workout',
            key: 'internal.default',
            context: { programId, workoutId },
        })
    }
```

- `logMessage` = second argument of the old `logger.error`, verbatim.
- `message` / `key` = second / fifth argument of the old `apiError`, verbatim; omit `key` if absent.
- `context` = old `logger.error` payload minus `error`; omit if empty.

Rule 2 — keep non-500 branches inside the catch as they are; replace only the 500 tail.
Rule 3 — inner try/catch that rethrows: leave untouched.
Rule 4 — add `import { handleApiError } from '@/lib/api-error-handler'`; remove `logger`/`apiError` imports only if unused.
Rule 5 — non-500 `INTERNAL_ERROR`: do not touch.

- [ ] **Step 1: Apply Rules 1–5 to every file in the batch**

- [ ] **Step 2: Verify no un-migrated 500 tail remains**

Run:
```bash
grep -rn -A4 "'INTERNAL_ERROR'" src/app/api/programs | grep -E "500" ; echo "exit=$?"
```
Expected: `exit=1`.

- [ ] **Step 3: Type-check, lint, tests**

Run: `npm run type-check && npm run lint && npx vitest run tests/integration`
Expected: all PASS, same integration pass count as Task 3 Step 1.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/programs
git commit -m "refactor(api): report 500s to Sentry via handleApiError (programs)"
```

---

### Task 5: Migrate API routes — batch C (`trainee`, `users`)

**Files (modify):** every file returned by

```bash
grep -rl "INTERNAL_ERROR" src/app/api/trainee src/app/api/users
```

(~13 files). Known special cases:
- `users/[id]/route.ts` has an **inner** catch (trainee data deletion) returning `apiError('INTERNAL_ERROR', 'Failed to delete user', 500, undefined, 'user.deleteFailed')` with log `'Trainee data deletion failed after auth account removal — retry to complete'` and payload `{ error, userId: id }`. Migrate it with Rule 1 too (it is a genuine 500 that must reach Sentry), keeping `key: 'user.deleteFailed'` and `context: { userId: id }`. Then migrate the outer catch normally.
- `trainee/workout-exercises/[id]/complete/route.ts` uses 2-space indentation — keep the file's indentation.

**Interfaces:**
- Consumes: `handleApiError(error, { logMessage, message, key?, context? })` from `@/lib/api-error-handler`.
- Produces: nothing new.

**Migration rules:** identical to Task 3.

Rule 1 — standard tail. Before:

```ts
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, workoutId }, 'Error submitting workout')
        return apiError(
            'INTERNAL_ERROR',
            'Failed to submit workout',
            500,
            undefined,
            'internal.default'
        )
    }
```

After:

```ts
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error submitting workout',
            message: 'Failed to submit workout',
            key: 'internal.default',
            context: { workoutId },
        })
    }
```

- `logMessage` = second argument of the old `logger.error`, verbatim.
- `message` / `key` = second / fifth argument of the old `apiError`, verbatim; omit `key` if absent.
- `context` = old `logger.error` payload minus `error`; omit if empty.

Rule 2 — keep non-500 branches inside the catch as they are; replace only the 500 tail.
Rule 3 — inner try/catch that rethrows: leave untouched.
Rule 4 — add `import { handleApiError } from '@/lib/api-error-handler'`; remove `logger`/`apiError` imports only if unused.
Rule 5 — non-500 `INTERNAL_ERROR`: do not touch.

- [ ] **Step 1: Apply Rules 1–5 to every file in the batch**

- [ ] **Step 2: Verify the whole API layer is migrated**

Run:
```bash
grep -rn -A4 "'INTERNAL_ERROR'" src/app/api | grep -E "\b500\b" ; echo "exit=$?"
grep -rl "'INTERNAL_ERROR'" src/app/api
```
Expected: first command `exit=1`; second command lists only `src/app/api/health/route.ts`.

- [ ] **Step 3: Type-check, lint, full unit + integration suite with coverage**

Run: `npm run type-check && npm run lint && npx vitest run --coverage`
Expected: all PASS; coverage thresholds met (including `src/lib/api-error-handler.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/trainee src/app/api/users
git commit -m "refactor(api): report 500s to Sentry via handleApiError (trainee, users)"
```

---

### Task 6: Client noise filter, MCP config, docs

**Files:**
- Create: `src/lib/sentry-filters.ts`
- Test: `tests/unit/lib/sentry-filters.test.ts`
- Modify: `src/instrumentation-client.ts`
- Create: `.mcp.json`
- Modify: `CLAUDE.md` (new "Sentry" subsection under "Architecture")
- Modify: `implementation-docs/CHANGELOG.md` (entry under `## [Unreleased]`)

**Interfaces:**
- Consumes: `ErrorEvent` type from `@sentry/nextjs`.
- Produces:
  ```ts
  export function shouldDropClientEvent(event: ErrorEvent): boolean
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lib/sentry-filters.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { shouldDropClientEvent } from '@/lib/sentry-filters'

function eventWith(type: string, value = 'msg', filenames: string[] = ['https://app.zerocento.it/_next/static/chunks/main.js']): ErrorEvent {
    return {
        type: undefined,
        exception: {
            values: [{
                type,
                value,
                stacktrace: { frames: filenames.map((filename) => ({ filename })) },
            }],
        },
    } as ErrorEvent
}

describe('shouldDropClientEvent', () => {
    it('drops AbortError (cancelled fetch / navigation)', () => {
        expect(shouldDropClientEvent(eventWith('AbortError'))).toBe(true)
    })

    it('drops ChunkLoadError (stale chunks after a deploy)', () => {
        expect(shouldDropClientEvent(eventWith('ChunkLoadError'))).toBe(true)
    })

    it('drops "Loading chunk N failed" reported as a plain Error', () => {
        expect(shouldDropClientEvent(eventWith('Error', 'Loading chunk 42 failed.'))).toBe(true)
    })

    it('drops errors whose frames all come from browser extensions', () => {
        const event = eventWith('TypeError', 'x', [
            'chrome-extension://abc/content.js',
            'moz-extension://def/inject.js',
        ])
        expect(shouldDropClientEvent(event)).toBe(true)
    })

    it('keeps errors with at least one app frame', () => {
        const event = eventWith('TypeError', 'x', [
            'chrome-extension://abc/content.js',
            'https://app.zerocento.it/_next/static/chunks/page.js',
        ])
        expect(shouldDropClientEvent(event)).toBe(false)
    })

    it('keeps ordinary application errors', () => {
        expect(shouldDropClientEvent(eventWith('TypeError', 'Cannot read properties of undefined'))).toBe(false)
    })

    it('keeps events without exception data', () => {
        expect(shouldDropClientEvent({ type: undefined, message: 'hello' } as ErrorEvent)).toBe(false)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/sentry-filters.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/sentry-filters"`.

- [ ] **Step 3: Implement the filter**

Create `src/lib/sentry-filters.ts`:

```ts
import type { ErrorEvent } from '@sentry/nextjs'

const NOISE_TYPES = new Set(['AbortError', 'ChunkLoadError'])
const CHUNK_LOAD_MESSAGE = /Loading chunk [\w-]+ failed/i
const EXTENSION_FRAME = /^(chrome|moz|safari(-web)?)-extension:\/\//

/**
 * Client-side noise that would eat the Sentry free-plan quota (5k errors/month)
 * without pointing at a bug in our code.
 */
export function shouldDropClientEvent(event: ErrorEvent): boolean {
    const exception = event.exception?.values?.[0]
    if (!exception) return false

    if (exception.type && NOISE_TYPES.has(exception.type)) return true
    if (exception.value && CHUNK_LOAD_MESSAGE.test(exception.value)) return true

    const filenames = (exception.stacktrace?.frames ?? [])
        .map((frame) => frame.filename)
        .filter((filename): filename is string => Boolean(filename))
    if (filenames.length > 0 && filenames.every((f) => EXTENSION_FRAME.test(f))) return true

    return false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/sentry-filters.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Wire the filter into the client config**

In `src/instrumentation-client.ts` add the import after the Sentry import:

```ts
import { shouldDropClientEvent } from "@/lib/sentry-filters";
```

and add to the `Sentry.init({ ... })` object, after `sendDefaultPii`:

```ts
  // Drop browser noise (aborted fetches, stale chunks, extensions) to protect the free-plan quota.
  beforeSend(event) {
    return shouldDropClientEvent(event) ? null : event;
  },
```

Do not change the other existing options in this file (see "Open question" at the end of the plan).

- [ ] **Step 6: Add the MCP config**

Create `.mcp.json` at the repo root:

```json
{
  "mcpServers": {
    "sentry": {
      "type": "http",
      "url": "https://mcp.sentry.dev/mcp"
    }
  }
}
```

- [ ] **Step 7: Document in CLAUDE.md**

In `CLAUDE.md`, replace the line

```
- **Error tracking**: Sentry (`sentry.server.config.ts`, `sentry.edge.config.ts`)
```

with

```
- **Error tracking**: Sentry (`sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation-client.ts`)
```

and add this subsection right before `### Testing`:

```markdown
### Sentry

- API route `catch` blocks end with `return handleApiError(error, { logMessage, message, key?, context? })` (`src/lib/api-error-handler.ts`): passes guard `Response`s through, logs with pino, reports to Sentry, returns the 500. Never call Sentry for 4xx.
- `requireAuth()` sets Sentry user `{ id }` and tag `role` — no email/name (`sendDefaultPii: false` server-side).
- Client noise filter: `shouldDropClientEvent()` in `src/lib/sentry-filters.ts`. Free plan = 5k errors/month; keep noise out.
- Sentry MCP: `.mcp.json` points to `https://mcp.sentry.dev/mcp`. First use: `/mcp` → sentry → Authenticate (OAuth). Org `zerocento`, project `javascript-nextjs`.
- Triage: local skill `/sentry-triage` (report only — no code changes).
```

- [ ] **Step 8: CHANGELOG entry**

In `implementation-docs/CHANGELOG.md`, directly under `## [Unreleased]` and the existing `### Changed` heading, add:

```markdown
### [3 Ottobre 2026] — Sentry: cattura dei 500 API e triage

- Nuovo `handleApiError` (`src/lib/api-error-handler.ts`): i `catch` delle route API ora inviano a Sentry gli errori 500 (prima venivano solo loggati con pino e Sentry non li vedeva). Risposte al client invariate; `/api/health` escluso.
- `requireAuth` imposta su Sentry id utente e ruolo (niente PII).
- Filtro rumore lato client (`shouldDropClientEvent`): scarta AbortError, ChunkLoadError ed errori da estensioni del browser, per proteggere la quota del piano gratuito.
- `.mcp.json` con il Sentry MCP server remoto, per leggere gli issue da Claude Code; sezione Sentry in `CLAUDE.md`.
```

- [ ] **Step 9: Verify**

Run: `npm run type-check && npm run lint && npx vitest run --coverage`
Expected: all PASS, coverage thresholds met.

- [ ] **Step 10: Commit**

```bash
git add src/lib/sentry-filters.ts tests/unit/lib/sentry-filters.test.ts src/instrumentation-client.ts .mcp.json CLAUDE.md implementation-docs/CHANGELOG.md
git commit -m "feat(observability): client noise filter, Sentry MCP config and docs"
```

---

### Task 7: `/sentry-triage` skill (local, not committed)

**Files:**
- Create: `/mnt/c/dev-projects/zero-cento-project/.claude/skills/sentry-triage/SKILL.md` (main tree; `.claude/` is gitignored — this is the same place as `zero-cento-backend` etc.)

**Interfaces:**
- Consumes: Sentry MCP server `sentry` (from `.mcp.json` in Task 6), authenticated by the user.
- Produces: the `/sentry-triage` slash command.

- [ ] **Step 1: Write the skill**

Create the file with this content:

````markdown
---
name: sentry-triage
description: Use when the user asks to triage Sentry, review recent production errors, or analyze a specific Sentry issue (e.g. "/sentry-triage", "/sentry-triage 14d", "/sentry-triage JAVASCRIPT-NEXTJS-42", "cosa c'è su Sentry"). Report only — never edits code.
---

# Sentry Triage (report only)

Reads issues from Sentry through the `sentry` MCP server and produces a prioritized
report with probable cause and proposed fix. Org `zerocento`, project `javascript-nextjs`.

## Hard rule

**Report only.** Do not edit files, create branches, open GitHub issues or PRs.
A fix starts only when the user explicitly asks, via superpowers:systematic-debugging.

## Preconditions

- The `sentry` MCP tools must be available. If they are not, or a call returns an
  auth error, stop and tell the user: run `/mcp` → sentry → Authenticate.
- Discover the exact tool names from the available `mcp__sentry__*` tools (issue
  search, issue details, event details). Do not guess names.

## Arguments

- none → unresolved issues, last 7 days
- `<N>d` (e.g. `14d`) → unresolved issues, last N days
- `<ISSUE-ID>` (e.g. `JAVASCRIPT-NEXTJS-42`) → single-issue deep analysis (skip to step 3 for that issue only)

## Steps

1. **List** unresolved issues in the window, sorted by event count; collect for each:
   id, title, culprit, event count, users affected, first seen, last seen,
   first-seen release, `role` tag distribution, `area` tag.
2. **Classify** each issue:
   - **new** — first seen inside the window
   - **regressed** — Sentry marks it as regressed
   - **growing** — events in the second half of the window > first half
   - **stable/noise** — everything else; also anything matching client noise
     (aborted requests, chunk loading, extensions, third-party scripts)
3. **Analyze** the top 5 by impact (users affected first, then events), excluding noise:
   - read the latest event's stacktrace and breadcrumbs;
   - open the in-app frames in this repo (`src/...`) at the reported lines;
   - for `area:api` issues, the route is in the event's transaction/URL — open its
     `route.ts` and the `handleApiError` context (`programId`, `workoutId`, ...);
   - state the probable cause, the `file:line`, a proposed fix (described, not applied),
     and confidence: high (cause visible in code), medium (plausible, needs repro),
     low (insufficient data — say what data is missing).
4. **Noise**: list issues that should be filtered in `src/lib/sentry-filters.ts`
   (client) or are expected and could be resolved/ignored in Sentry.
5. **Quota**: if the MCP exposes org stats, report errors used this month vs 5,000.
   If not, say "quota non disponibile via MCP".

## Output format (in chat, Italian)

```
## Sentry triage — <window> (<date>)

| Issue | Titolo | Eventi | Utenti | Ruolo | Stato | Release |
|---|---|---|---|---|---|---|

### 1. <ISSUE-ID> — <title>
- **Causa probabile:** ...
- **Dove:** `src/...:<line>`
- **Fix proposto:** ...
- **Confidenza:** alta | media | bassa

### Rumore da filtrare
- ...

### Quota
- ...
```

End by asking which issue, if any, the user wants fixed.
````

- [ ] **Step 2: Verify the skill is discoverable**

Start a new Claude Code session in the main tree and check `/sentry-triage` appears in the skill list. (No automated test — prompt-only skill.)

- [ ] **Step 3: Real run (after the user has authenticated the MCP server)**

Run `/sentry-triage 30d`. Expected: report in the format above built from real Sentry data, or a clear "authenticate via /mcp" message if not logged in. Nothing to commit.

---

### Task 8: End-to-end verification

**Files:** none committed.

- [ ] **Step 1: Full checks**

Run: `npm run type-check && npm run lint && npm run test:unit`
Expected: all PASS.

- [ ] **Step 2: Forced 500 locally (temporary change, never committed)**

Requires `.env.local` with `NEXT_PUBLIC_SENTRY_DSN` and DB access (corporate network blocks Postgres from WSL — if so, do this step on the Vercel preview of the branch instead, with the same temporary change on a throwaway commit that is reverted afterwards, or skip and rely on the first real 500 in production).

1. In `src/app/api/admin/reports/global/route.ts`, as the first line inside `try` after the `requireRole` call, add `throw new Error('sentry-observability smoke test')`.
2. `npm run dev`, log in as admin, open the admin dashboard (calls `/api/admin/reports/global`).
3. Expected: response 500 with `key: 'internal.globalReportFailed'`; in Sentry a new issue "sentry-observability smoke test" with tag `area:api`, tag `role:admin`, user id set, stacktrace pointing to `route.ts`.
4. Call any route with a missing resource (404) and confirm no Sentry event.
5. Revert: `git checkout -- src/app/api/admin/reports/global/route.ts`.

- [ ] **Step 3: Release check (after the branch is deployed on Vercel)**

Open the smoke-test (or first real) issue in Sentry and check the "Release" field equals the deployed commit SHA. If it is empty, add to the `withSentryConfig` options in `next.config.mjs`:

```js
    release: { name: process.env.VERCEL_GIT_COMMIT_SHA },
```

then commit (`fix(observability): set Sentry release from Vercel commit SHA`) and add a line to the CHANGELOG entry from Task 6.

---

## Open question for the user (not part of any task)

`src/instrumentation-client.ts` currently has `sendDefaultPii: true`, `tracesSampleRate: 1` and a hard-coded DSN, while server/edge use `sendDefaultPii: false` and `tracesSampleRate` from env (default 0.1). The spec only adds a `beforeSend` there. Aligning the client (PII off, sample rate from env) is a one-line change each — decide whether to include it in Task 6.
