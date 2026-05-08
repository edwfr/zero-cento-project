# RPE Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a trainee selects their perceived RPE for an exercise, save only that value via a dedicated lightweight API endpoint — no sets, no notes, no cascade logic.

**Architecture:** New `PATCH /api/trainee/workout-exercises/[id]/feedback/rpe` route that upserts only `actualRpe` on `ExerciseFeedback`. Client calls this endpoint directly when `RPESelector` fires `onChange`, updating local state optimistically and rolling back on error.

**Tech Stack:** Next.js 15 App Router, Prisma, Zod, Vitest (integration tests), React/Tailwind

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/schemas/feedback.ts` | Modify | Add `workoutExerciseRpeSchema` + `WorkoutExerciseRpeInput` type |
| `src/app/api/trainee/workout-exercises/[id]/feedback/rpe/route.ts` | Create | PATCH handler — ownership check, upsert `actualRpe` only |
| `tests/integration/workout-exercise-rpe.test.ts` | Create | Integration tests for the new route |
| `src/app/trainee/workouts/[id]/_content.tsx` | Modify | Replace `updateExerciseRPE` with async version that calls new endpoint |

---

## Task 1: Add Zod schema for RPE-only payload

**Files:**
- Modify: `src/schemas/feedback.ts`

- [ ] **Step 1: Write the failing test**

In `tests/unit/skeleton-schema.test.ts` there is a model for schema unit tests. Create a NEW file:

```ts
// tests/unit/rpe-schema.test.ts
import { describe, it, expect } from 'vitest'
import { workoutExerciseRpeSchema } from '@/schemas/feedback'

describe('workoutExerciseRpeSchema', () => {
    it('accepts a valid RPE value', () => {
        const result = workoutExerciseRpeSchema.safeParse({ actualRpe: 7.5 })
        expect(result.success).toBe(true)
    })

    it('accepts null RPE (clear value)', () => {
        const result = workoutExerciseRpeSchema.safeParse({ actualRpe: null })
        expect(result.success).toBe(true)
    })

    it('rejects RPE below 5.0', () => {
        const result = workoutExerciseRpeSchema.safeParse({ actualRpe: 4.5 })
        expect(result.success).toBe(false)
    })

    it('rejects RPE above 10.0', () => {
        const result = workoutExerciseRpeSchema.safeParse({ actualRpe: 10.5 })
        expect(result.success).toBe(false)
    })

    it('rejects RPE not in 0.5 steps', () => {
        const result = workoutExerciseRpeSchema.safeParse({ actualRpe: 7.3 })
        expect(result.success).toBe(false)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:unit -- tests/unit/rpe-schema.test.ts
```

Expected: FAIL — `workoutExerciseRpeSchema` not exported.

- [ ] **Step 3: Add schema to `src/schemas/feedback.ts`**

After the existing `workoutExerciseAutosaveSchema` block, add:

```ts
export const workoutExerciseRpeSchema = z.object({
    actualRpe: z
        .number()
        .min(5.0, 'validation.rpeMin')
        .max(10.0, 'validation.rpeMax')
        .multipleOf(0.5, 'validation.rpeStep')
        .nullable(),
})

export type WorkoutExerciseRpeInput = z.infer<typeof workoutExerciseRpeSchema>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:unit -- tests/unit/rpe-schema.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/schemas/feedback.ts tests/unit/rpe-schema.test.ts
git commit -m "feat(schema): add workoutExerciseRpeSchema for RPE-only autosave"
```

---

## Task 2: Create the RPE autosave route

**Files:**
- Create: `src/app/api/trainee/workout-exercises/[id]/feedback/rpe/route.ts`
- Create: `tests/integration/workout-exercise-rpe.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
// tests/integration/workout-exercise-rpe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession } from './fixtures'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        workoutExercise: {
            findFirst: vi.fn(),
        },
        exerciseFeedback: {
            upsert: vi.fn(),
        },
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { PATCH } from '@/app/api/trainee/workout-exercises/[id]/feedback/rpe/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const UUIDS = {
    workoutExercise: '11111111-1111-1111-1111-111111111111',
    feedback: '22222222-2222-2222-2222-222222222222',
}

const makeRequest = (body: Record<string, unknown>) =>
    new NextRequest(
        `http://localhost/api/trainee/workout-exercises/${UUIDS.workoutExercise}/feedback/rpe`,
        {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    )

describe('PATCH /api/trainee/workout-exercises/[id]/feedback/rpe', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue({ id: UUIDS.workoutExercise } as any)
        vi.mocked(prisma.exerciseFeedback.upsert).mockResolvedValue({
            id: UUIDS.feedback,
            workoutExerciseId: UUIDS.workoutExercise,
            actualRpe: 7.5,
            date: new Date('2026-05-08T00:00:00.000Z'),
            updatedAt: new Date('2026-05-08T12:00:00.000Z'),
        } as any)
    })

    it('upserts only actualRpe without touching sets or cascade', async () => {
        const res = await PATCH(makeRequest({ actualRpe: 7.5 }), withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(prisma.workoutExercise.findFirst).toHaveBeenCalledTimes(1)
        expect(prisma.exerciseFeedback.upsert).toHaveBeenCalledTimes(1)
        expect(prisma.exerciseFeedback.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ actualRpe: 7.5 }),
                update: { actualRpe: 7.5 },
            })
        )
        expect(json.data.feedback.id).toBe(UUIDS.feedback)
        expect(json.data.feedback.actualRpe).toBe(7.5)
    })

    it('accepts null to clear RPE', async () => {
        vi.mocked(prisma.exerciseFeedback.upsert).mockResolvedValue({
            id: UUIDS.feedback,
            workoutExerciseId: UUIDS.workoutExercise,
            actualRpe: null,
            date: new Date('2026-05-08T00:00:00.000Z'),
            updatedAt: new Date('2026-05-08T12:00:00.000Z'),
        } as any)

        const res = await PATCH(makeRequest({ actualRpe: null }), withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(200)
        expect(prisma.exerciseFeedback.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: { actualRpe: null },
            })
        )
    })

    it('returns 400 when actualRpe is out of range', async () => {
        const res = await PATCH(makeRequest({ actualRpe: 11 }), withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.code).toBe('VALIDATION_ERROR')
        expect(prisma.exerciseFeedback.upsert).not.toHaveBeenCalled()
    })

    it('returns 400 when actualRpe is not in 0.5 steps', async () => {
        const res = await PATCH(makeRequest({ actualRpe: 7.3 }), withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 404 when trainee does not own the workout exercise', async () => {
        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(null as any)

        const res = await PATCH(makeRequest({ actualRpe: 7.5 }), withIdParam(UUIDS.workoutExercise))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.code).toBe('NOT_FOUND')
        expect(prisma.exerciseFeedback.upsert).not.toHaveBeenCalled()
    })

    it('returns 401 when unauthenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })
        )

        const res = await PATCH(makeRequest({ actualRpe: 7.5 }), withIdParam(UUIDS.workoutExercise))

        expect(res.status).toBe(401)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:unit -- tests/integration/workout-exercise-rpe.test.ts
```

Expected: FAIL — module `@/app/api/trainee/workout-exercises/[id]/feedback/rpe/route` not found.

- [ ] **Step 3: Create the route handler**

```ts
// src/app/api/trainee/workout-exercises/[id]/feedback/rpe/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getTodayDateKey } from '@/lib/date-format'
import { workoutExerciseRpeSchema } from '@/schemas/feedback'

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    try {
        const session = await requireRole(['trainee'])
        const body = await request.json()
        const parsed = workoutExerciseRpeSchema.safeParse(body)

        if (!parsed.success) {
            return apiError(
                'VALIDATION_ERROR',
                'Invalid input',
                400,
                parsed.error.flatten(),
                'validation.invalid'
            )
        }

        const owns = await prisma.workoutExercise.findFirst({
            where: {
                id,
                workout: {
                    week: {
                        program: {
                            traineeId: session.user.id,
                        },
                    },
                },
            },
            select: { id: true },
        })

        if (!owns) {
            return apiError(
                'NOT_FOUND',
                'Workout exercise not found',
                404,
                undefined,
                'workoutExercise.notFound'
            )
        }

        const today = getTodayDateKey()
        const { actualRpe } = parsed.data

        const feedback = await prisma.exerciseFeedback.upsert({
            where: {
                workoutExerciseId_traineeId_date: {
                    workoutExerciseId: id,
                    traineeId: session.user.id,
                    date: today,
                },
            },
            create: {
                workoutExerciseId: id,
                traineeId: session.user.id,
                date: today,
                actualRpe,
            },
            update: {
                actualRpe,
            },
            select: {
                id: true,
                workoutExerciseId: true,
                actualRpe: true,
                date: true,
                updatedAt: true,
            },
        })

        logger.info(
            { workoutExerciseId: id, traineeId: session.user.id, actualRpe },
            'RPE autosaved'
        )

        return apiSuccess({ feedback })
    } catch (error: any) {
        if (error instanceof Response) return error

        logger.error({ error, workoutExerciseId: id }, 'Error autosaving RPE')
        return apiError(
            'INTERNAL_ERROR',
            'Failed to autosave RPE',
            500,
            undefined,
            'internal.default'
        )
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:unit -- tests/integration/workout-exercise-rpe.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Run type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/trainee/workout-exercises/[id]/feedback/rpe/route.ts \
        tests/integration/workout-exercise-rpe.test.ts
git commit -m "feat(api): add PATCH /feedback/rpe endpoint for RPE-only autosave"
```

---

## Task 3: Wire client to call the new endpoint on RPE change

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx`

Context: `updateExerciseRPE` (line ~471) currently only updates local state. It's passed as `onUpdateRpe` to `ExerciseFocusCard`, which passes it to `RPESelector.onChange`. The `RPESelector` fires once on discrete selection — no debounce needed.

- [ ] **Step 1: Replace `updateExerciseRPE` with async version**

Find and replace the current `updateExerciseRPE` function:

```ts
// BEFORE
const updateExerciseRPE = (workoutExerciseId: string, rpe: number | null) => {
    setExerciseRPE((prev) => ({
        ...prev,
        [workoutExerciseId]: rpe,
    }))
}
```

Replace with:

```ts
const updateExerciseRPE = useCallback(async (workoutExerciseId: string, rpe: number | null) => {
    setExerciseRPE((prev) => ({ ...prev, [workoutExerciseId]: rpe }))
    try {
        const res = await fetch(`/api/trainee/workout-exercises/${workoutExerciseId}/feedback/rpe`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actualRpe: rpe }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(getApiErrorMessage(data, t('workouts.errorFeedback'), t))
    } catch (err: unknown) {
        setExerciseRPE((prev) => ({ ...prev, [workoutExerciseId]: exerciseRPE[workoutExerciseId] ?? null }))
        showToast(err instanceof Error ? err.message : t('workouts.errorFeedback'), 'error')
    }
}, [exerciseRPE, showToast, t])
```

Note: on error, RPE is rolled back to its previous value (`exerciseRPE[workoutExerciseId]`).

Add `useCallback` to the imports at line 3 if not already present — `useCallback` is already imported.

- [ ] **Step 2: Verify type-check passes**

```bash
npm run type-check
```

Expected: no errors. The `onUpdateRpe: (rpe: number | null) => void` prop type in `ExerciseFocusCardProps` accepts an async function assigned to `void` — TypeScript allows this.

- [ ] **Step 3: Run existing tests to confirm no regressions**

```bash
npm run test:unit -- tests/integration/workout-exercise-feedback.test.ts tests/integration/workout-exercise-rpe.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx
git commit -m "feat(trainee): autosave RPE via dedicated endpoint on selector change"
```

---

## Self-Review

**Spec coverage:**
- ✅ New dedicated endpoint for RPE-only save
- ✅ No sets, notes, or cascade logic in RPE endpoint
- ✅ Client calls endpoint on RPE change
- ✅ Optimistic update with rollback on error
- ✅ Ownership check preserved (same `findFirst` pattern as feedback route)
- ✅ Tests cover: happy path, null RPE, validation failures, 404, 401

**Placeholder scan:** None found.

**Type consistency:**
- `workoutExerciseRpeSchema` defined in Task 1, imported in Task 2 route and referenced in Task 1 test
- `WorkoutExerciseRpeInput` exported but not used in route (route uses `parsed.data` directly — correct)
- `updateExerciseRPE` signature unchanged (`workoutExerciseId: string, rpe: number | null`) — call sites at lines ~683 unaffected
