# Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the 5 identified performance bottlenecks causing ~7s perceived latency on the `copy-week` flow (and across all API calls).

**Architecture:** Five targeted fixes in priority order — middleware auth bypass, rate-limit scoping, DB query consolidation, backend over-fetch reduction, and client optimistic state update. Tasks 1–3 are independent. Task 5 depends on Task 4 (new API response shape).

**Tech Stack:** Next.js 15 App Router, Supabase SSR, Prisma, TanStack Query (not yet used; Task 5 introduces local-state update pattern), Vitest, React `useRef`/`useState`.

---

## File Map

| File | Task(s) | Change |
|------|---------|--------|
| `src/middleware.ts` | 1, 2 | Skip `getUser()` for `/api/*`; scope Redis rate limit to GET only |
| `src/app/api/programs/[id]/copy-week/route.ts` | 4 | Targeted week queries + return `updatedWeek` |
| `src/app/api/programs/[id]/copy-first-week/route.ts` | 4 | Targeted week queries (no full program load) |
| `src/app/api/personal-records/route.ts` | 3 | Single `findFirst` replaces `findMany` + `findUnique` |
| `src/app/trainer/programs/[id]/edit/_content.tsx` | 5 | Extract transform helpers, add `trainerIdRef`, local state update on copy-week |
| `src/app/trainer/programs/[id]/edit/transform-utils.ts` | 5 | **Create**: pure `transformApiExercise` / `transformApiWeek` helpers |
| `tests/integration/rate-limit-read.test.ts` | 1, 2 | Remove Supabase mock, update comments, add POST rate-limit test |
| `tests/integration/programs.test.ts` | 4 | Add `week`/`workoutExercise` mocks, add copy-week and copy-first-week tests |
| `tests/integration/personal-records.test.ts` | 3 | Replace `findUnique`/`findMany` ownership mock with `findFirst`, add consolidated-query test |
| `tests/unit/transform-utils.test.ts` | 5 | **Create**: unit tests for pure transform helpers |

---

## Task 1: Skip `getUser()` for `/api/*` in middleware

**Impact:** Removes 1× Supabase network call (~200–400 ms) per API request. Highest-priority fix.

**Root cause:** `middleware.ts` calls `supabase.auth.getUser()` for every request including `/api/*` routes, which already have their own `requireAuth()` / `requireRole()` guard. Middleware 401 for API routes is redundant.

**Files:**
- Modify: `src/middleware.ts`
- Modify: `tests/integration/rate-limit-read.test.ts`

---

- [ ] **Step 1.1: Write a failing test**

Add a test that verifies API routes pass through middleware without the Supabase auth check, and that the existing rate-limit behavior is preserved. Open `tests/integration/rate-limit-read.test.ts`.

The test currently uses a `@supabase/ssr` mock so `getUser()` returns `null`, causing non-rate-limited requests to respond 401. After the fix, those same requests should respond 200 (NextResponse.next() — route handler takes over).

Add this test inside the `describe('Rate limiting — read endpoints (I3)')` block:

```typescript
it('passes API requests through to route handlers without calling getUser', async () => {
    const ip = '10.0.1.99'
    const path = '/api/programs'
    // Should return 200 (NextResponse.next()), NOT 401
    const res = await middleware(buildRequest(ip, path))
    expect(res.status).toBe(200)
})
```

- [ ] **Step 1.2: Run the new test to confirm it currently fails**

```bash
npx vitest run tests/integration/rate-limit-read.test.ts --reporter=verbose
```

Expected: FAIL — currently returns 401 (auth check runs), test expects 200.

- [ ] **Step 1.3: Apply the fix to `src/middleware.ts`**

Replace the block from "Create Supabase client" to the end of the function (lines ~151–224) with the version below. The change: add an early return for `/api/` routes before creating the Supabase client.

```typescript
    // API routes: route handlers enforce their own auth — skip session validation here
    if (pathname.startsWith('/api')) {
        return NextResponse.next({
            request: { headers: request.headers },
        })
    }

    // Page routes: validate session, refresh cookies, enforce redirects
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({ name, value, ...options })
                    response = NextResponse.next({
                        request: { headers: request.headers },
                    })
                    response.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({ name, value: '', ...options })
                    response = NextResponse.next({
                        request: { headers: request.headers },
                    })
                    response.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    if (!pathname.startsWith('/force-change-password')) {
        const mustChangePassword = user.user_metadata?.mustChangePassword
        if (mustChangePassword) {
            const url = request.nextUrl.clone()
            url.pathname = '/force-change-password'
            return NextResponse.redirect(url)
        }
    }

    return response
}
```

This replaces lines 151–224. Delete the old comment `// Create Supabase client` and everything below it through the closing `}` of the `middleware` function.

- [ ] **Step 1.4: Update the rate-limit test file**

The `@supabase/ssr` mock is no longer needed (getUser is not called for `/api/` routes). Also remove the `// they will return 401 — correct` comments. Updated file:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Prevents @upstash/redis/cloudflare from attempting CF-specific initialisation
vi.mock('@upstash/redis/cloudflare', () => ({
    Redis: vi.fn(),
}))

import { middleware } from '@/middleware'

function buildRequest(ip: string, pathname: string): NextRequest {
    return new NextRequest(`http://localhost${pathname}`, {
        headers: { 'x-forwarded-for': ip },
    })
}

async function exhaustLimit(ip: string, pathname: string, limit: number): Promise<void> {
    for (let i = 0; i < limit; i++) {
        await middleware(buildRequest(ip, pathname))
    }
}

describe('Rate limiting — read endpoints (I3)', () => {
    it('returns 429 with Retry-After after 100 requests to GET /api/exercises', async () => {
        const ip = '10.0.1.1'
        const path = '/api/exercises'

        await exhaustLimit(ip, path, 100)

        const res = await middleware(buildRequest(ip, path))

        expect(res.status).toBe(429)

        const body = (await res.json()) as { error: { code: string; message: string } }
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
        expect(body.error.message).toBeTruthy()
        expect(res.headers.get('Retry-After')).toBe('60')
    })

    it('returns 429 with Retry-After after 100 requests to GET /api/programs', async () => {
        const ip = '10.0.1.2'
        const path = '/api/programs'

        await exhaustLimit(ip, path, 100)

        const res = await middleware(buildRequest(ip, path))

        expect(res.status).toBe(429)

        const body = (await res.json()) as { error: { code: string } }
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
        expect(res.headers.get('Retry-After')).toBe('60')
    })

    it('returns 429 with Retry-After after 100 requests to GET /api/personal-records', async () => {
        const ip = '10.0.1.3'
        const path = '/api/personal-records'

        await exhaustLimit(ip, path, 100)

        const res = await middleware(buildRequest(ip, path))

        expect(res.status).toBe(429)

        const body = (await res.json()) as { error: { code: string } }
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
        expect(res.headers.get('Retry-After')).toBe('60')
    })

    it('does not rate limit requests below the threshold', async () => {
        const ip = '10.0.1.4'
        const path = '/api/exercises'

        await exhaustLimit(ip, path, 99)

        const res = await middleware(buildRequest(ip, path))
        expect(res.status).not.toBe(429)
    })

    it('does not rate limit repeated requests to the public login page', async () => {
        const ip = '10.0.1.5'
        const path = '/login'

        for (let i = 0; i < 10; i++) {
            const res = await middleware(buildRequest(ip, path))
            expect(res.status).not.toBe(429)
        }
    })

    it('passes API requests through to route handlers without calling getUser', async () => {
        const ip = '10.0.1.99'
        const path = '/api/programs'
        const res = await middleware(buildRequest(ip, path))
        expect(res.status).toBe(200)
    })
})
```

- [ ] **Step 1.5: Run all rate-limit tests to verify they pass**

```bash
npx vitest run tests/integration/rate-limit-read.test.ts --reporter=verbose
```

Expected: all 6 tests PASS.

- [ ] **Step 1.6: Run full test suite to check for regressions**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 1.7: Commit**

```bash
git add src/middleware.ts tests/integration/rate-limit-read.test.ts
git commit -m "perf: skip getUser() in middleware for /api/* routes

Route handlers already enforce auth via requireAuth()/requireRole().
Removes one redundant Supabase network call (~200-400ms) per API request."
```

---

## Task 2: Scope Redis rate limiting to GET requests only

**Impact:** Removes ~20–50 ms Redis round-trip from every POST/PATCH/DELETE on `/api/programs/*`, `/api/exercises/*`, `/api/personal-records/*`.

**Root cause:** `getRateLimitConfig` returns `useRedis: true` for all HTTP methods on resource endpoints. Redis is only valuable for read operations (cross-instance consistency for GETs). Mutations are low-frequency user actions not at risk of cross-instance abuse.

**Files:**
- Modify: `src/middleware.ts`
- Modify: `tests/integration/rate-limit-read.test.ts`

---

- [ ] **Step 2.1: Write a failing test**

Add to `tests/integration/rate-limit-read.test.ts`, inside the describe block:

```typescript
it('rate limits POST mutations via in-memory store (not Redis), returns 429 after 100', async () => {
    const ip = '10.0.2.1'
    const path = '/api/programs/prog-test-id/copy-week'

    function buildPostRequest(ipAddr: string, pathname: string): NextRequest {
        return new NextRequest(`http://localhost${pathname}`, {
            method: 'POST',
            headers: { 'x-forwarded-for': ipAddr },
        })
    }

    for (let i = 0; i < 100; i++) {
        await middleware(buildPostRequest(ip, path))
    }

    const res = await middleware(buildPostRequest(ip, path))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
})
```

- [ ] **Step 2.2: Run the new test to confirm it passes already (rate limiting still applies, just in-memory)**

```bash
npx vitest run tests/integration/rate-limit-read.test.ts -t "rate limits POST"
```

Expected: PASS already (the current code rate-limits POSTs too, just via Redis config; but since Redis is mocked/null in tests, falls back to in-memory anyway). The test passing confirms the behavior is correct.

If it FAILS: the test is written correctly and exposes a real issue. Debug before proceeding.

- [ ] **Step 2.3: Update `getRateLimitConfig` in `src/middleware.ts`**

Change the function signature to accept `method` and use it to decide `useRedis`:

```typescript
function getRateLimitConfig(
    pathname: string,
    method: string
): { limit: number; windowMs: number; useRedis: boolean } {
    // Auth endpoints - strict limits with Redis
    if (pathname.includes('/login') || pathname.includes('/signup')) {
        return { limit: 5, windowMs: 15 * 60 * 1000, useRedis: true }
    }

    if (pathname.includes('/forgot-password') || pathname.includes('/reset-password')) {
        return { limit: 3, windowMs: 60 * 60 * 1000, useRedis: true }
    }

    // Feedback endpoints - higher limit
    if (pathname.includes('/api/feedback')) {
        return { limit: 30, windowMs: 60 * 1000, useRedis: false }
    }

    // User creation - moderate limit
    if (pathname === '/api/users' || pathname.includes('/api/admin/users')) {
        return { limit: 20, windowMs: 60 * 60 * 1000, useRedis: false }
    }

    // Read endpoints — Redis-backed only for GET; mutations use in-memory
    if (
        pathname === '/api/exercises' ||
        pathname.startsWith('/api/exercises/') ||
        pathname === '/api/programs' ||
        pathname.startsWith('/api/programs/') ||
        pathname === '/api/personal-records' ||
        pathname.startsWith('/api/personal-records/')
    ) {
        return { limit: 100, windowMs: 60 * 1000, useRedis: method === 'GET' }
    }

    // Default API limits
    return { limit: 100, windowMs: 60 * 1000, useRedis: false }
}
```

Update the call site (inside `middleware` function):

```typescript
const rateLimitConfig = getRateLimitConfig(pathname, request.method)
```

- [ ] **Step 2.4: Run all rate-limit tests**

```bash
npx vitest run tests/integration/rate-limit-read.test.ts --reporter=verbose
```

Expected: all 7 tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/middleware.ts tests/integration/rate-limit-read.test.ts
git commit -m "perf: restrict Redis rate limiting to GET requests on resource endpoints

POST/PATCH/DELETE mutations now use in-memory rate limiting.
Removes 20-50ms Redis round-trip from write operations."
```

---

## Task 3: Consolidate redundant queries in personal-records

**Impact:** Removes 1 extra DB query when a trainer fetches records for a specific trainee. GET and POST both affected.

**Root cause (GET):** Trainer + `traineeId` case runs `findMany` (all trainer's trainees) then `findUnique` (ownership check). The `findMany` result is immediately overridden. Replace both with single `findFirst({ where: { trainerId, traineeId } })`.

**Root cause (POST):** Same pattern — `findUnique({ where: { traineeId } })` + manual `trainerId` check. Replace with `findFirst({ where: { trainerId, traineeId } })`.

**Files:**
- Modify: `src/app/api/personal-records/route.ts`
- Modify: `tests/integration/personal-records.test.ts`

---

- [ ] **Step 3.1: Write failing tests**

Open `tests/integration/personal-records.test.ts`. Find the describe block for `GET /api/personal-records` and add two test cases:

```typescript
it('trainer with traineeId: uses single findFirst ownership check (not findMany + findUnique)', async () => {
    vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)

    const relation = { trainerId: mockTrainerSession.user.id, traineeId: 'trainee-uuid-1' }
    vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue(relation as any)
    vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/personal-records?traineeId=trainee-uuid-1')
    const res = await GET(req)

    expect(res.status).toBe(200)
    // findFirst called with combined trainerId + traineeId filter
    expect(prisma.trainerTrainee.findFirst).toHaveBeenCalledWith({
        where: {
            trainerId: mockTrainerSession.user.id,
            traineeId: 'trainee-uuid-1',
        },
    })
    // findMany NOT called for ownership check when traineeId is provided
    expect(prisma.trainerTrainee.findMany).not.toHaveBeenCalled()
})

it('trainer with traineeId: returns 403 when trainee not managed', async () => {
    vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
    vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/personal-records?traineeId=trainee-uuid-999')
    const res = await GET(req)

    expect(res.status).toBe(403)
})
```

Also add a test for the POST handler trainer ownership check:

```typescript
it('POST: trainer ownership check uses findFirst with trainerId + traineeId', async () => {
    vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
    vi.mocked(prisma.trainerTrainee.findFirst).mockResolvedValue({
        trainerId: mockTrainerSession.user.id,
        traineeId: 'trainee-uuid-1',
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'trainee-uuid-1', role: 'trainee' } as any)
    vi.mocked(prisma.exercise.findUnique).mockResolvedValue({ id: 'ex-1' } as any)
    vi.mocked(prisma.personalRecord.create).mockResolvedValue({ id: 'pr-1' } as any)

    const req = new NextRequest('http://localhost/api/personal-records', {
        method: 'POST',
        body: JSON.stringify({
            traineeId: 'trainee-uuid-1',
            exerciseId: 'ex-1',
            reps: 5,
            weight: 100,
            recordDate: '2026-04-24',
        }),
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(prisma.trainerTrainee.findFirst).toHaveBeenCalledWith({
        where: {
            trainerId: mockTrainerSession.user.id,
            traineeId: 'trainee-uuid-1',
        },
    })
    // findUnique (old pattern) should NOT be called
    expect(prisma.trainerTrainee.findUnique).not.toHaveBeenCalled()
})
```

- [ ] **Step 3.2: Run the new tests to confirm they fail**

```bash
npx vitest run tests/integration/personal-records.test.ts --reporter=verbose
```

Expected: the new tests FAIL because the current code still calls `findMany` + `findUnique`.

- [ ] **Step 3.3: Refactor the GET handler in `src/app/api/personal-records/route.ts`**

Replace the RBAC `where` block (lines ~26–57) with:

```typescript
        // Build where clause based on RBAC
        const where: any = {}

        if (session.user.role === 'trainee') {
            where.traineeId = session.user.id
        } else if (session.user.role === 'trainer') {
            if (traineeId) {
                const relation = await prisma.trainerTrainee.findFirst({
                    where: { trainerId: session.user.id, traineeId },
                })
                if (!relation) {
                    return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
                }
                where.traineeId = traineeId
            } else {
                const traineeRelations = await prisma.trainerTrainee.findMany({
                    where: { trainerId: session.user.id },
                    select: { traineeId: true },
                })
                where.traineeId = { in: traineeRelations.map((t) => t.traineeId) }
            }
        }

        if (session.user.role === 'admin' && traineeId) {
            where.traineeId = traineeId
        }

        if (exerciseId) {
            where.exerciseId = exerciseId
        }
```

Remove the old separate `if (traineeId)` block that follows (lines ~44–57 in the original), as it is now fully handled inside the role check.

- [ ] **Step 3.4: Refactor the POST handler trainer ownership check**

Replace (lines ~128–134 in original):

```typescript
        if (session.user.role === 'trainer') {
            const isManaged = await prisma.trainerTrainee.findUnique({
                where: { traineeId: traineeId },
            })
            if (!isManaged || isManaged.trainerId !== session.user.id) {
                return apiError('FORBIDDEN', 'You can only create records for your own trainees', 403, undefined, 'personalRecord.createDenied')
            }
        }
```

With:

```typescript
        if (session.user.role === 'trainer') {
            const relation = await prisma.trainerTrainee.findFirst({
                where: { trainerId: session.user.id, traineeId },
            })
            if (!relation) {
                return apiError('FORBIDDEN', 'You can only create records for your own trainees', 403, undefined, 'personalRecord.createDenied')
            }
        }
```

- [ ] **Step 3.5: Run the personal-records tests**

```bash
npx vitest run tests/integration/personal-records.test.ts --reporter=verbose
```

Expected: all tests PASS including the new ones.

- [ ] **Step 3.6: Run full test suite**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 3.7: Commit**

```bash
git add src/app/api/personal-records/route.ts tests/integration/personal-records.test.ts
git commit -m "perf: consolidate trainer ownership check in personal-records to single findFirst

Replaces findMany + findUnique (2 queries) with findFirst({ trainerId, traineeId })
for both GET (trainer+traineeId filter) and POST (ownership verification)."
```

---

## Task 4: Eliminate over-fetching in copy-week and copy-first-week

**Impact:** Reduces DB load from ~384 records to ~64 records for `copy-week`. Eliminates full program load for both routes.

**Root cause:** Both routes load `trainingProgram.findUnique({ include: { weeks: { include: { workouts: { include: { workoutExercises } } } } } })` — the entire program tree. Only the source and target weeks are needed.

**Files:**
- Modify: `src/app/api/programs/[id]/copy-week/route.ts`
- Modify: `src/app/api/programs/[id]/copy-first-week/route.ts`
- Modify: `tests/integration/programs.test.ts`

---

- [ ] **Step 4.1: Add missing Prisma mocks to `tests/integration/programs.test.ts`**

Open `tests/integration/programs.test.ts`. In the `vi.mock('@/lib/prisma', ...)` block, add `week`, `workoutExercise`, and `$transaction` to the prisma mock object:

```typescript
vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            count: vi.fn(),
        },
        exerciseFeedback: {
            findMany: vi.fn(),
        },
        trainingWeek: {
            createMany: vi.fn(),
        },
        workout: {
            createMany: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        trainerTrainee: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        week: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
        },
        workoutExercise: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
        },
        $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
            const tx = {
                workoutExercise: {
                    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
                    createMany: vi.fn().mockResolvedValue({ count: 1 }),
                },
            }
            return fn(tx)
        }),
    },
}))
```

Also add the import for the new routes at the top of the import section:

```typescript
import { POST as copyWeekPOST } from '@/app/api/programs/[id]/copy-week/route'
import { POST as copyFirstWeekPOST } from '@/app/api/programs/[id]/copy-first-week/route'
```

- [ ] **Step 4.2: Write failing tests for copy-week**

Add a new describe block in `tests/integration/programs.test.ts`:

```typescript
// ── Fixtures for copy-week / copy-first-week ─────────────────────────────────

const mockProgramMeta = {
    id: 'prog-1',
    trainerId: 'trainer-uuid-1',
    status: 'draft',
}

const mockSourceWeek = {
    id: 'week-1',
    programId: 'prog-1',
    weekNumber: 1,
    weekType: 'normal',
    workouts: [
        {
            id: 'workout-src-1',
            dayIndex: 1,
            workoutExercises: [
                {
                    id: 'we-src-1',
                    exerciseId: 'ex-1',
                    variant: null,
                    sets: 5,
                    reps: '5',
                    targetRpe: 8,
                    weightType: 'absolute',
                    weight: 100,
                    effectiveWeight: 100,
                    restTime: 'm3',
                    isWarmup: false,
                    notes: null,
                    order: 0,
                },
            ],
        },
    ],
}

const mockTargetWeek = {
    id: 'week-2',
    programId: 'prog-1',
    weekNumber: 2,
    weekType: 'normal',
    workouts: [{ id: 'workout-tgt-1', dayIndex: 1 }],
}

const mockUpdatedWeek = {
    id: 'week-2',
    programId: 'prog-1',
    weekNumber: 2,
    weekType: 'normal',
    workouts: [
        {
            id: 'workout-tgt-1',
            dayIndex: 1,
            workoutExercises: [
                {
                    id: 'we-new-1',
                    exerciseId: 'ex-1',
                    variant: null,
                    sets: 5,
                    reps: '5',
                    targetRpe: 8,
                    weightType: 'absolute',
                    weight: 100,
                    effectiveWeight: 100,
                    restTime: 'm3',
                    isWarmup: false,
                    notes: null,
                    order: 0,
                    exercise: {
                        id: 'ex-1',
                        name: 'Squat',
                        type: 'fundamental',
                        notes: [],
                        movementPattern: null,
                        exerciseMuscleGroups: [],
                    },
                },
            ],
        },
    ],
}

function makeCopyWeekRequest(programId: string, sourceWeekId: string): NextRequest {
    return new NextRequest(`http://localhost/api/programs/${programId}/copy-week`, {
        method: 'POST',
        body: JSON.stringify({ sourceWeekId }),
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('POST /api/programs/[id]/copy-week', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 400 when sourceWeekId is missing', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        const req = new NextRequest('http://localhost/api/programs/prog-1/copy-week', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' },
        })
        const res = await copyWeekPOST(req, { params: Promise.resolve({ id: 'prog-1' }) })
        expect(res.status).toBe(400)
    })

    it('returns 404 when program not found', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null)
        vi.mocked(prisma.week.findUnique).mockResolvedValue(mockSourceWeek as any)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-missing', 'week-1'),
            { params: Promise.resolve({ id: 'prog-missing' }) }
        )
        expect(res.status).toBe(404)
    })

    it('returns 404 when source week not found', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findUnique).mockResolvedValue(null)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-missing'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(404)
    })

    it('returns 403 when trainer does not own the program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...mockProgramMeta,
            trainerId: 'other-trainer',
        } as any)
        vi.mocked(prisma.week.findUnique).mockResolvedValue(mockSourceWeek as any)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(403)
    })

    it('returns 403 when program is not draft', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...mockProgramMeta,
            status: 'active',
        } as any)
        vi.mocked(prisma.week.findUnique).mockResolvedValue(mockSourceWeek as any)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(403)
    })

    it('returns 400 when source week has no exercises', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findUnique).mockResolvedValue({
            ...mockSourceWeek,
            workouts: [{ id: 'w1', dayIndex: 1, workoutExercises: [] }],
        } as any)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(400)
    })

    it('returns 400 when no following week exists', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findUnique).mockResolvedValue(mockSourceWeek as any)
        vi.mocked(prisma.week.findFirst).mockResolvedValue(null)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(400)
    })

    it('returns 200 with updatedWeek on success', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findUnique)
            .mockResolvedValueOnce(mockSourceWeek as any)      // source week
            .mockResolvedValueOnce(mockUpdatedWeek as any)     // updatedWeek after transaction
        vi.mocked(prisma.week.findFirst).mockResolvedValue(mockTargetWeek as any)

        const res = await copyWeekPOST(
            makeCopyWeekRequest('prog-1', 'week-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )

        expect(res.status).toBe(200)
        const body = (await res.json()) as any
        expect(body.data.updatedWeek).toBeDefined()
        expect(body.data.updatedWeek.id).toBe('week-2')
    })
})
```

- [ ] **Step 4.3: Run the new tests to confirm they fail**

```bash
npx vitest run tests/integration/programs.test.ts -t "copy-week" --reporter=verbose
```

Expected: FAIL — the current route uses `trainingProgram.findUnique` with full includes, but mock expects `week.findUnique` and `week.findFirst` separately.

- [ ] **Step 4.4: Rewrite `src/app/api/programs/[id]/copy-week/route.ts`**

Replace the entire file contents:

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * POST /api/programs/[id]/copy-week
 * Copy workout definitions from one week to the next week only.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()
        const sourceWeekId = body?.sourceWeekId

        if (!sourceWeekId || typeof sourceWeekId !== 'string') {
            return apiError('VALIDATION_ERROR', 'Source week is required', 400, undefined, 'validation.sourceWeekRequired')
        }

        const [program, sourceWeek] = await Promise.all([
            prisma.trainingProgram.findUnique({
                where: { id: programId },
                select: { id: true, trainerId: true, status: true },
            }),
            prisma.week.findUnique({
                where: { id: sourceWeekId },
                include: {
                    workouts: {
                        include: { workoutExercises: { orderBy: { order: 'asc' } } },
                        orderBy: { dayIndex: 'asc' },
                    },
                },
            }),
        ])

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (!sourceWeek || sourceWeek.programId !== programId) {
            return apiError('NOT_FOUND', 'Source week not found', 404, undefined, 'week.sourceNotFound')
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify your own programs', 403, undefined, 'program.modifyDenied')
        }

        if (session.user.role !== 'admin' && program.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Cannot modify program: only draft programs can be edited',
                403,
                undefined,
                'program.cannotModifyNonDraft'
            )
        }

        const hasSourceExercises = sourceWeek.workouts.some(w => w.workoutExercises.length > 0)
        if (!hasSourceExercises) {
            return apiError('VALIDATION_ERROR', 'Source week has no configured exercises to copy', 400)
        }

        const targetWeek = await prisma.week.findFirst({
            where: { programId, weekNumber: { gt: sourceWeek.weekNumber } },
            orderBy: { weekNumber: 'asc' },
            include: { workouts: { orderBy: { dayIndex: 'asc' } } },
        })

        if (!targetWeek) {
            return apiError('VALIDATION_ERROR', 'Source week has no following week to copy into', 400, undefined, 'program.noFollowingWeek')
        }

        const sourceWorkoutMap = new Map(sourceWeek.workouts.map(w => [w.dayIndex, w]))

        await prisma.$transaction(async (tx) => {
            for (const targetWorkout of targetWeek.workouts) {
                const sourceWorkout = sourceWorkoutMap.get(targetWorkout.dayIndex)
                if (!sourceWorkout) continue

                await tx.workoutExercise.deleteMany({ where: { workoutId: targetWorkout.id } })

                if (sourceWorkout.workoutExercises.length === 0) continue

                await tx.workoutExercise.createMany({
                    data: sourceWorkout.workoutExercises.map(exercise => ({
                        workoutId: targetWorkout.id,
                        exerciseId: exercise.exerciseId,
                        variant: exercise.variant,
                        sets: exercise.sets,
                        reps: exercise.reps,
                        targetRpe: exercise.targetRpe,
                        weightType: exercise.weightType,
                        weight: exercise.weight,
                        effectiveWeight: exercise.effectiveWeight,
                        restTime: exercise.restTime,
                        isWarmup: exercise.isWarmup,
                        notes: exercise.notes,
                        order: exercise.order,
                    })),
                })
            }
        })

        // Fetch updated target week with exercise data for client local state update
        const updatedWeek = await prisma.week.findUnique({
            where: { id: targetWeek.id },
            include: {
                workouts: {
                    include: {
                        workoutExercises: {
                            orderBy: { order: 'asc' },
                            include: {
                                exercise: {
                                    select: {
                                        id: true,
                                        name: true,
                                        type: true,
                                        notes: true,
                                        movementPattern: {
                                            select: {
                                                id: true,
                                                name: true,
                                                movementPatternColors: {
                                                    select: { trainerId: true, color: true },
                                                },
                                            },
                                        },
                                        exerciseMuscleGroups: {
                                            select: {
                                                coefficient: true,
                                                muscleGroup: { select: { id: true, name: true } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { dayIndex: 'asc' },
                },
            },
        })

        logger.info(
            { programId, sourceWeekId, targetWeekId: targetWeek.id, userId: session.user.id },
            'Copied workouts from a week to the next week'
        )

        return apiSuccess({
            sourceWeek: sourceWeek.weekNumber,
            targetWeek: targetWeek.weekNumber,
            updatedWorkouts: targetWeek.workouts.length,
            updatedWeek,
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error copying workouts to next week')
        return apiError('INTERNAL_ERROR', 'Failed to copy workouts to next week', 500, undefined, 'internal.default')
    }
}
```

- [ ] **Step 4.5: Rewrite `src/app/api/programs/[id]/copy-first-week/route.ts`**

Replace the entire file contents:

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * POST /api/programs/[id]/copy-first-week
 * Copy workout definitions from week 1 to all subsequent weeks.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        const [program, sourceWeek] = await Promise.all([
            prisma.trainingProgram.findUnique({
                where: { id: programId },
                select: { id: true, trainerId: true, status: true },
            }),
            prisma.week.findFirst({
                where: { programId },
                orderBy: { weekNumber: 'asc' },
                include: {
                    workouts: {
                        include: { workoutExercises: { orderBy: { order: 'asc' } } },
                        orderBy: { dayIndex: 'asc' },
                    },
                },
            }),
        ])

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (!sourceWeek) {
            return apiSuccess({ updatedWeeks: 0, updatedWorkouts: 0 })
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify your own programs', 403, undefined, 'program.modifyDenied')
        }

        if (session.user.role !== 'admin' && program.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Cannot modify program: only draft programs can be edited',
                403,
                undefined,
                'program.cannotModifyNonDraft'
            )
        }

        const hasSourceExercises = sourceWeek.workouts.some(w => w.workoutExercises.length > 0)
        if (!hasSourceExercises) {
            return apiError(
                'VALIDATION_ERROR',
                'First week has no configured exercises to copy',
                400,
                undefined,
                'program.copyFirstWeekEmpty'
            )
        }

        // Load target weeks without exercise data — we delete and replace all exercises
        const targetWeeks = await prisma.week.findMany({
            where: { programId, weekNumber: { gt: sourceWeek.weekNumber } },
            include: {
                workouts: {
                    select: { id: true, dayIndex: true },
                    orderBy: { dayIndex: 'asc' },
                },
            },
            orderBy: { weekNumber: 'asc' },
        })

        if (targetWeeks.length === 0) {
            return apiSuccess({ updatedWeeks: 0, updatedWorkouts: 0 })
        }

        const sourceWorkoutMap = new Map(sourceWeek.workouts.map(w => [w.dayIndex, w]))

        await prisma.$transaction(async (tx) => {
            for (const targetWeek of targetWeeks) {
                for (const targetWorkout of targetWeek.workouts) {
                    const sourceWorkout = sourceWorkoutMap.get(targetWorkout.dayIndex)
                    if (!sourceWorkout) continue

                    await tx.workoutExercise.deleteMany({ where: { workoutId: targetWorkout.id } })

                    if (sourceWorkout.workoutExercises.length === 0) continue

                    await tx.workoutExercise.createMany({
                        data: sourceWorkout.workoutExercises.map(exercise => ({
                            workoutId: targetWorkout.id,
                            exerciseId: exercise.exerciseId,
                            variant: exercise.variant,
                            sets: exercise.sets,
                            reps: exercise.reps,
                            targetRpe: exercise.targetRpe,
                            weightType: exercise.weightType,
                            weight: exercise.weight,
                            effectiveWeight: exercise.effectiveWeight,
                            restTime: exercise.restTime,
                            isWarmup: exercise.isWarmup,
                            notes: exercise.notes,
                            order: exercise.order,
                        })),
                    })
                }
            }
        })

        logger.info(
            { programId, sourceWeekId: sourceWeek.id, copiedWeeks: targetWeeks.length, userId: session.user.id },
            'Copied first week workouts to remaining weeks'
        )

        return apiSuccess({
            updatedWeeks: targetWeeks.length,
            updatedWorkouts: targetWeeks.reduce((total, week) => total + week.workouts.length, 0),
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error copying first week workouts')
        return apiError('INTERNAL_ERROR', 'Failed to copy first week workouts', 500, undefined, 'internal.default')
    }
}
```

- [ ] **Step 4.6: Add copy-first-week tests**

Add another describe block in `tests/integration/programs.test.ts`:

```typescript
function makeCopyFirstWeekRequest(programId: string): NextRequest {
    return new NextRequest(`http://localhost/api/programs/${programId}/copy-first-week`, {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
    })
}

describe('POST /api/programs/[id]/copy-first-week', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 404 when program not found', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null)
        vi.mocked(prisma.week.findFirst).mockResolvedValue(null)

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-missing'),
            { params: Promise.resolve({ id: 'prog-missing' }) }
        )
        expect(res.status).toBe(404)
    })

    it('returns 200 with 0 when program has only one week', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findFirst).mockResolvedValue(mockSourceWeek as any)
        vi.mocked(prisma.week.findMany).mockResolvedValue([])

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(200)
        const body = (await res.json()) as any
        expect(body.data.updatedWeeks).toBe(0)
    })

    it('returns 403 when trainer does not own the program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...mockProgramMeta,
            trainerId: 'other-trainer',
        } as any)
        vi.mocked(prisma.week.findFirst).mockResolvedValue(mockSourceWeek as any)

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(403)
    })

    it('returns 200 with updatedWeeks count on success', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(mockProgramMeta as any)
        vi.mocked(prisma.week.findFirst).mockResolvedValue(mockSourceWeek as any)
        vi.mocked(prisma.week.findMany).mockResolvedValue([
            { ...mockTargetWeek, weekNumber: 2, workouts: [{ id: 'w2', dayIndex: 1 }] },
            { id: 'week-3', programId: 'prog-1', weekNumber: 3, weekType: 'normal', workouts: [{ id: 'w3', dayIndex: 1 }] },
        ] as any)

        const res = await copyFirstWeekPOST(
            makeCopyFirstWeekRequest('prog-1'),
            { params: Promise.resolve({ id: 'prog-1' }) }
        )
        expect(res.status).toBe(200)
        const body = (await res.json()) as any
        expect(body.data.updatedWeeks).toBe(2)
    })
})
```

- [ ] **Step 4.7: Run all programs tests**

```bash
npx vitest run tests/integration/programs.test.ts --reporter=verbose
```

Expected: all tests PASS including the new copy-week and copy-first-week suites.

- [ ] **Step 4.8: Run full test suite**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 4.9: Commit**

```bash
git add src/app/api/programs/[id]/copy-week/route.ts src/app/api/programs/[id]/copy-first-week/route.ts tests/integration/programs.test.ts
git commit -m "perf: replace full program load with targeted week queries in copy-week routes

copy-week: load program metadata + source/target weeks only (was entire program tree).
copy-first-week: load program metadata + week 1 + week IDs only for targets.
copy-week response now includes updatedWeek for client local state update."
```

---

## Task 5: Client local state update after copy-week (no full re-fetch)

**Impact:** Eliminates the `GET /api/programs/{id}` call (~2.89s) triggered after every copy-week mutation.

**Root cause:** `handleCopyWeekToNext` calls `fetchProgram({ showLoading: false })` after success, which reloads the entire program tree. The copy-week API now returns `updatedWeek` (added in Task 4), so the client can update local state directly.

**Approach:**
1. Extract the exercise/week transform logic from `fetchProgram` into pure module-level helpers in a new `transform-utils.ts`.
2. Store `trainerId` in a `useRef` during initial program load.
3. In `handleCopyWeekToNext`, transform `data.data.updatedWeek` and replace the week in `program.weeks` state.
4. The existing `useEffect` (line 686) that syncs `rowStateById` from `program` fires automatically — no extra work needed.

**Files:**
- Create: `src/app/trainer/programs/[id]/edit/transform-utils.ts`
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx` (lines 409–411, 576–637, 1135–1165)
- Create: `tests/unit/transform-utils.test.ts`

---

- [ ] **Step 5.1: Write failing unit tests for transform helpers**

Create `tests/unit/transform-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { transformApiExercise, transformApiWeek } from '@/app/trainer/programs/[id]/edit/transform-utils'

const TRAINER_ID = 'trainer-1'
const BRAND_COLOR = 'rgb(var(--brand-primary))'

const apiExercise = {
    id: 'we-1',
    order: 0,
    variant: 'pause',
    sets: 5,
    reps: 5,
    targetRpe: 8,
    weightType: 'absolute',
    weight: 100,
    effectiveWeight: 100,
    restTime: 'm3',
    isWarmup: false,
    notes: null,
    exercise: {
        id: 'ex-1',
        name: 'Squat',
        type: 'fundamental',
        notes: ['keep chest up'],
        movementPattern: {
            id: 'mp-1',
            name: 'Squat',
            movementPatternColors: [
                { trainerId: TRAINER_ID, color: '#FF0000' },
                { trainerId: 'other', color: '#0000FF' },
            ],
        },
        exerciseMuscleGroups: [
            { coefficient: 1, muscleGroup: { id: 'mg-1', name: 'Quadriceps' } },
        ],
    },
}

describe('transformApiExercise', () => {
    it('maps workout exercise fields correctly', () => {
        const result = transformApiExercise(apiExercise, TRAINER_ID)
        expect(result.id).toBe('we-1')
        expect(result.reps).toBe('5')
        expect(result.exercise.name).toBe('Squat')
    })

    it('picks movementPattern color for the correct trainer', () => {
        const result = transformApiExercise(apiExercise, TRAINER_ID)
        expect(result.exercise.movementPattern?.color).toBe('#FF0000')
    })

    it('falls back to brand primary when no trainer color', () => {
        const noColor = {
            ...apiExercise,
            exercise: {
                ...apiExercise.exercise,
                movementPattern: {
                    id: 'mp-1',
                    name: 'Squat',
                    movementPatternColors: [],
                },
            },
        }
        const result = transformApiExercise(noColor, TRAINER_ID)
        expect(result.exercise.movementPattern?.color).toBe(BRAND_COLOR)
    })

    it('returns null movementPattern when exercise has none', () => {
        const noPattern = {
            ...apiExercise,
            exercise: { ...apiExercise.exercise, movementPattern: null },
        }
        const result = transformApiExercise(noPattern, TRAINER_ID)
        expect(result.exercise.movementPattern).toBeNull()
    })

    it('filters non-string notes from exercise', () => {
        const mixedNotes = {
            ...apiExercise,
            exercise: { ...apiExercise.exercise, notes: ['valid', 42, null, 'also valid'] },
        }
        const result = transformApiExercise(mixedNotes as any, TRAINER_ID)
        expect(result.exercise.notes).toEqual(['valid', 'also valid'])
    })
})

describe('transformApiWeek', () => {
    it('maps week fields and sorts workouts by dayIndex', () => {
        const apiWeek = {
            id: 'w-1',
            weekNumber: 1,
            weekType: 'normal',
            workouts: [
                { id: 'wo-2', dayIndex: 3, workoutExercises: [] },
                { id: 'wo-1', dayIndex: 1, workoutExercises: [] },
            ],
        }
        const result = transformApiWeek(apiWeek, TRAINER_ID)
        expect(result.id).toBe('w-1')
        expect(result.workouts[0].dayIndex).toBe(1)
        expect(result.workouts[1].dayIndex).toBe(3)
    })

    it('transforms workout exercises using transformApiExercise', () => {
        const apiWeek = {
            id: 'w-1',
            weekNumber: 1,
            weekType: 'normal',
            workouts: [
                {
                    id: 'wo-1',
                    dayIndex: 1,
                    workoutExercises: [apiExercise],
                },
            ],
        }
        const result = transformApiWeek(apiWeek, TRAINER_ID)
        expect(result.workouts[0].workoutExercises[0].exercise.movementPattern?.color).toBe('#FF0000')
    })
})
```

- [ ] **Step 5.2: Run the tests to confirm they fail**

```bash
npx vitest run tests/unit/transform-utils.test.ts --reporter=verbose
```

Expected: FAIL — `transform-utils.ts` does not exist yet.

- [ ] **Step 5.3: Create `src/app/trainer/programs/[id]/edit/transform-utils.ts`**

```typescript
const PRIMARY_COLOR = 'rgb(var(--brand-primary))'

export interface TransformMovementPattern {
    id: string
    name: string
    color: string
}

export interface TransformExerciseReference {
    id: string
    name: string
    type: 'fundamental' | 'accessory'
    notes: string[]
    movementPattern: TransformMovementPattern | null
    exerciseMuscleGroups: Array<{
        coefficient: number
        muscleGroup: { id: string; name: string }
    }>
}

export interface TransformWorkoutExercise {
    id: string
    order: number
    variant: string | null
    sets: number
    reps: string
    targetRpe: number | null
    weightType: string
    weight: number | null
    effectiveWeight: number | null
    restTime: string
    isWarmup: boolean
    notes: string | null
    exercise: TransformExerciseReference
}

export interface TransformWorkout {
    id: string
    dayIndex: number
    workoutExercises: TransformWorkoutExercise[]
}

export interface TransformWeek {
    id: string
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    workouts: TransformWorkout[]
}

export function transformApiExercise(we: any, trainerId: string): TransformWorkoutExercise {
    const movementPattern = we.exercise?.movementPattern
        ? {
            id: we.exercise.movementPattern.id,
            name: we.exercise.movementPattern.name,
            color:
                we.exercise.movementPattern.movementPatternColors?.find(
                    (c: any) => c.trainerId === trainerId
                )?.color || PRIMARY_COLOR,
        }
        : null

    return {
        id: we.id,
        order: we.order,
        variant: we.variant,
        sets: we.sets,
        reps: String(we.reps),
        targetRpe: we.targetRpe,
        weightType: we.weightType,
        weight: we.weight,
        effectiveWeight: we.effectiveWeight,
        restTime: we.restTime,
        isWarmup: we.isWarmup,
        notes: we.notes,
        exercise: {
            id: we.exercise.id,
            name: we.exercise.name,
            type: we.exercise.type,
            notes: Array.isArray(we.exercise.notes)
                ? we.exercise.notes.filter((n: unknown) => typeof n === 'string')
                : [],
            movementPattern,
            exerciseMuscleGroups: we.exercise.exerciseMuscleGroups || [],
        },
    }
}

export function transformApiWeek(week: any, trainerId: string): TransformWeek {
    return {
        id: week.id,
        weekNumber: week.weekNumber,
        weekType: week.weekType,
        workouts: (week.workouts || [])
            .map((workout: any) => ({
                id: workout.id,
                dayIndex:
                    typeof workout.dayIndex === 'number'
                        ? workout.dayIndex
                        : Number(workout.dayOfWeek ?? 0),
                workoutExercises: (workout.workoutExercises || []).map(
                    (we: any) => transformApiExercise(we, trainerId)
                ),
            }))
            .sort((a: TransformWorkout, b: TransformWorkout) => a.dayIndex - b.dayIndex),
    }
}
```

- [ ] **Step 5.4: Run transform-utils tests to verify they pass**

```bash
npx vitest run tests/unit/transform-utils.test.ts --reporter=verbose
```

Expected: all 7 tests PASS.

- [ ] **Step 5.5: Update `src/app/trainer/programs/[id]/edit/_content.tsx`**

**Change A — Add import** (top of file, after existing local imports):

Add to the imports from `./structure-utils` line:
```typescript
import { transformApiWeek } from './transform-utils'
```

**Change B — Add `trainerIdRef`** (line ~411, after the other useRef declarations):

```typescript
    const loadingRef = useRef(false)
    const requestIdRef = useRef(0)
    const lastVisibilityRefreshRef = useRef(0)
    const trainerIdRef = useRef('')
```

**Change C — Set `trainerIdRef` and use `transformApiWeek` in `fetchProgram`** (lines ~575–637):

Replace:
```typescript
            const traineeId = data.data.program.trainee.id
            const trainerId = data.data.program.trainerId

            const transformedProgram: Program = {
                id: data.data.program.id,
                title: data.data.program.title,
                status: data.data.program.status,
                isSbdProgram: data.data.program.isSbdProgram,
                trainee: data.data.program.trainee,
                durationWeeks: data.data.program.durationWeeks,
                workoutsPerWeek: data.data.program.workoutsPerWeek,
                weeks: (data.data.program.weeks || []).map((week: any) => ({
                    id: week.id,
                    weekNumber: week.weekNumber,
                    weekType: week.weekType,
                    workouts: (week.workouts || [])
                        .map((workout: any) => ({
                            id: workout.id,
                            dayIndex:
                                typeof workout.dayIndex === 'number'
                                    ? workout.dayIndex
                                    : Number(workout.dayOfWeek ?? 0),
                            workoutExercises: (workout.workoutExercises || []).map((we: any) => {
                                const movementPattern = we.exercise?.movementPattern
                                    ? {
                                        id: we.exercise.movementPattern.id,
                                        name: we.exercise.movementPattern.name,
                                        color:
                                            we.exercise.movementPattern.movementPatternColors?.find(
                                                (color: any) => color.trainerId === trainerId
                                            )?.color || PRIMARY_COLOR,
                                    }
                                    : null

                                return {
                                    id: we.id,
                                    order: we.order,
                                    variant: we.variant,
                                    sets: we.sets,
                                    reps: String(we.reps),
                                    targetRpe: we.targetRpe,
                                    weightType: we.weightType,
                                    weight: we.weight,
                                    effectiveWeight: we.effectiveWeight,
                                    restTime: we.restTime,
                                    isWarmup: we.isWarmup,
                                    notes: we.notes,
                                    exercise: {
                                        id: we.exercise.id,
                                        name: we.exercise.name,
                                        type: we.exercise.type,
                                        notes: Array.isArray(we.exercise.notes)
                                            ? we.exercise.notes.filter((note: unknown) => typeof note === 'string')
                                            : [],
                                        movementPattern,
                                        exerciseMuscleGroups: we.exercise.exerciseMuscleGroups || [],
                                    },
                                }
                            }),
                        }))
                        .sort((left: Workout, right: Workout) => left.dayIndex - right.dayIndex),
                })),
            }
```

With:
```typescript
            const traineeId = data.data.program.trainee.id
            const trainerId = data.data.program.trainerId
            trainerIdRef.current = trainerId

            const transformedProgram: Program = {
                id: data.data.program.id,
                title: data.data.program.title,
                status: data.data.program.status,
                isSbdProgram: data.data.program.isSbdProgram,
                trainee: data.data.program.trainee,
                durationWeeks: data.data.program.durationWeeks,
                workoutsPerWeek: data.data.program.workoutsPerWeek,
                weeks: (data.data.program.weeks || []).map((week: any) =>
                    transformApiWeek(week, trainerId)
                ),
            }
```

**Change D — Update `handleCopyWeekToNext`** (lines ~1135–1165):

Replace:
```typescript
    const handleCopyWeekToNext = async () => {
        if (!confirmCopyNextWeek) return

        try {
            setCopyingWeekId(confirmCopyNextWeek.id)

            const res = await fetch(`/api/programs/${programId}/copy-week`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceWeekId: confirmCopyNextWeek.id }),
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.copyWeekError'), t))
            }

            await fetchProgram({ showLoading: false })
            showToast(
                t('editProgram.copyWeekSuccess', {
                    sourceWeek: confirmCopyNextWeek.weekNumber,
                    targetWeek: confirmCopyNextWeek.weekNumber + 1,
                }),
                'success'
            )
            setConfirmCopyNextWeek(null)
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('editProgram.copyWeekError'), 'error')
        } finally {
            setCopyingWeekId(null)
        }
    }
```

With:
```typescript
    const handleCopyWeekToNext = async () => {
        if (!confirmCopyNextWeek) return

        try {
            setCopyingWeekId(confirmCopyNextWeek.id)

            const res = await fetch(`/api/programs/${programId}/copy-week`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceWeekId: confirmCopyNextWeek.id }),
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.copyWeekError'), t))
            }

            if (data.data.updatedWeek && trainerIdRef.current) {
                const transformedWeek = transformApiWeek(data.data.updatedWeek, trainerIdRef.current)
                setProgram((prev) => {
                    if (!prev) return prev
                    return {
                        ...prev,
                        weeks: prev.weeks.map((week) =>
                            week.id === transformedWeek.id ? transformedWeek : week
                        ),
                    }
                })
            } else {
                await fetchProgram({ showLoading: false })
            }

            showToast(
                t('editProgram.copyWeekSuccess', {
                    sourceWeek: confirmCopyNextWeek.weekNumber,
                    targetWeek: confirmCopyNextWeek.weekNumber + 1,
                }),
                'success'
            )
            setConfirmCopyNextWeek(null)
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('editProgram.copyWeekError'), 'error')
        } finally {
            setCopyingWeekId(null)
        }
    }
```

- [ ] **Step 5.6: Run type-check**

```bash
npm run type-check
```

Expected: no type errors. If `TransformWeek` doesn't satisfy the `Week` interface in `_content.tsx`, adjust the types to match (add missing fields or cast).

Note: `_content.tsx` defines `Week` with `weekType: 'normal' | 'test' | 'deload'` which matches `TransformWeek`. The `WorkoutExercise` interface in `_content.tsx` uses `WeightType` from Prisma for `weightType` and `RestTime` for `restTime`. The `transformApiWeek` returns `string` for those. If TypeScript complains, cast the return type of `transformApiWeek` as `Week` at the call site:

```typescript
weeks: (data.data.program.weeks || []).map((week: any) =>
    transformApiWeek(week, trainerId) as Week
),
```

And in `handleCopyWeekToNext`:
```typescript
const transformedWeek = transformApiWeek(data.data.updatedWeek, trainerIdRef.current) as Week
```

- [ ] **Step 5.7: Run full test suite**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 5.8: Verify with lint**

```bash
npm run lint
```

Expected: no lint errors.

- [ ] **Step 5.9: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/transform-utils.ts src/app/trainer/programs/[id]/edit/_content.tsx tests/unit/transform-utils.test.ts
git commit -m "perf: update program state locally after copy-week instead of full re-fetch

Extracts API response transform logic into transform-utils.ts.
handleCopyWeekToNext now applies returned updatedWeek to local React state,
eliminating the 2.89s GET /api/programs/{id} call after each copy-week mutation."
```

---

## Self-Review

### Spec Coverage

| Issue | Task | Covered |
|---|---|---|
| 3.1 Double getUser() | Task 1 | ✅ Middleware skips getUser for /api/* |
| 3.2 Over-fetch copy-week backend | Task 4 | ✅ Targeted week queries |
| 3.3 Full-reload after mutation | Task 5 | ✅ Local state update via updatedWeek |
| 3.4 Redis on mutations | Task 2 | ✅ useRedis: method === 'GET' |
| 3.5 Redundant personal-records queries | Task 3 | ✅ Single findFirst |

### Dependency Order

Tasks 1–3 are independent. Task 5 requires Task 4 (relies on `updatedWeek` in copy-week response). Execute in order: 1 → 2 → 3 → 4 → 5.

### Type Safety Note

`transform-utils.ts` uses `string` for `weightType` and `restTime` (matching API JSON). `_content.tsx` uses Prisma enum types. Cast to `Week` at call sites in `_content.tsx` to satisfy the type checker without changing runtime behavior.

### copy-first-week Client Behavior

`copy-first-week` (covers all weeks) keeps the `fetchProgram` full-reload — it's a bulk operation done once per program setup, not a frequent user action. The backend query optimization (Task 4) is the main win here.
