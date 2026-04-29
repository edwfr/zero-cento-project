# Atomic Workout Submit + Drop ExerciseFeedback.completed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace N-per-exercise POSTs to `/api/feedback` (plus auto-sync) with one atomic `POST /api/trainee/workouts/[id]/submit`, and drop the redundant `ExerciseFeedback.completed` column.

**Architecture:**
- Trainee submits the whole workout in a single transactional request (notes + per-exercise actualRpe + sets[]). Backend does a single ownership check, then runs N upserts inside `prisma.$transaction` keyed on `@@unique([workoutExerciseId, traineeId, date])`.
- Auto-sync (continuous server-side draft persistence) is removed; localStorage already provides client-side draft recovery for the same device.
- After Option A, every persisted feedback represents a final submission, so `ExerciseFeedback.completed` is always true and can be dropped. Consumers either drop the filter or use `WorkoutExercise.isCompleted`.

**Tech Stack:** Next.js 15 App Router, Prisma, Supabase Auth, Zod, Vitest (jsdom), TanStack Query (existing).

---

## File Structure

**Create:**
- `src/app/api/trainee/workouts/[id]/submit/route.ts` — new atomic submit endpoint
- `tests/integration/trainee-workout-submit.test.ts` — integration tests for new endpoint
- `prisma/migrations/20260429000000_drop_feedback_completed/migration.sql` — drop column

**Modify:**
- `src/schemas/feedback.ts` — add `workoutSubmitSchema`; drop `completed` from `feedbackSchema` (no longer used)
- `src/app/trainee/workouts/[id]/_content.tsx` — single submit POST, remove `syncDraftFeedback` and its effects
- `prisma/schema.prisma` — drop `completed` from `ExerciseFeedback`
- `src/app/api/programs/[id]/reports/route.ts` — drop `.filter(fb => fb.completed)` (now: feedback presence == completion)
- `src/app/api/feedback/route.ts` — remove `POST` handler; keep `GET`
- `src/app/api/feedback/[id]/route.ts` — remove `PUT` handler; keep `GET`
- `src/lib/program-status.ts` — drop `completed` field from `ProgramCompletionFeedback` type and the `.filter(fb.completed)` call
- `src/app/trainer/dashboard/page.tsx` — drop `completed` from `exerciseFeedbacks` select; replace `hasCompletedFeedback` to check `WorkoutExercise.isCompleted`
- `tests/integration/feedback.test.ts` — drop tests for removed `POST` and `PUT`; keep `GET` tests; drop `completed` from fixtures
- `implementation-docs/CHANGELOG.md` — log changes

---

### Task 1: Add Zod schema for atomic workout submit

**Files:**
- Modify: `src/schemas/feedback.ts`

- [ ] **Step 1: Add `workoutSubmitSchema` and type export**

Append to `src/schemas/feedback.ts` (keep existing exports intact, but remove `completed` line from `feedbackSchema` and `setPerformedSchema` later — see Task 2 note):

```typescript
export const workoutSubmitExerciseSchema = z.object({
    workoutExerciseId: z.string().uuid('validation.invalidWorkoutExerciseId'),
    actualRpe: z
        .number()
        .min(5.0, 'validation.rpeMin')
        .max(10.0, 'validation.rpeMax')
        .multipleOf(0.5, 'validation.rpeStep')
        .nullish(),
    sets: z
        .array(setPerformedSchema)
        .min(1, 'validation.minOneSeries')
        .max(50, 'validation.maxSeries'),
})

export const workoutSubmitSchema = z.object({
    notes: z.string().max(1000, 'validation.notesTooLong').nullish(),
    exercises: z
        .array(workoutSubmitExerciseSchema)
        .min(1, 'validation.minOneExercise')
        .max(50, 'validation.maxExercises'),
})

export type WorkoutSubmitExerciseInput = z.infer<typeof workoutSubmitExerciseSchema>
export type WorkoutSubmitInput = z.infer<typeof workoutSubmitSchema>
```

- [ ] **Step 2: Add i18n keys**

Modify `public/locales/en/trainer.json` and `public/locales/it/trainer.json` (or wherever `validation.*` keys live — search the repo for `validation.minOneSeries` and add neighbours):

```jsonc
"validation": {
    // ... existing keys
    "minOneExercise": "At least one exercise required",
    "maxExercises": "Too many exercises (max 50)"
}
```

Italian:

```jsonc
"validation": {
    // ... existing keys
    "minOneExercise": "Almeno un esercizio richiesto",
    "maxExercises": "Troppi esercizi (max 50)"
}
```

Run: `grep -rn "validation.minOneSeries" public/locales` to find exact files; add the two new keys in same object.

- [ ] **Step 3: Run type-check**

Run: `npm run type-check`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/schemas/feedback.ts public/locales/en/*.json public/locales/it/*.json
git commit -m "feat(schemas): add workoutSubmitSchema for atomic workout submit"
```

---

### Task 2: Create new atomic submit endpoint with failing test

**Files:**
- Create: `src/app/api/trainee/workouts/[id]/submit/route.ts`
- Create: `tests/integration/trainee-workout-submit.test.ts`

- [ ] **Step 1: Create test file with failing happy-path test**

Create `tests/integration/trainee-workout-submit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession } from './fixtures'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        workout: { findFirst: vi.fn() },
        exerciseFeedback: { upsert: vi.fn() },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { POST } from '@/app/api/trainee/workouts/[id]/submit/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const UUIDS = {
    workout: '11111111-1111-1111-1111-111111111111',
    wex1: '22222222-2222-2222-2222-222222222222',
    wex2: '33333333-3333-3333-3333-333333333333',
    feedback1: '44444444-4444-4444-4444-444444444444',
    feedback2: '55555555-5555-5555-5555-555555555555',
}

describe('POST /api/trainee/workouts/[id]/submit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(requireRole as any).mockResolvedValue(mockTraineeSession)
    })

    it('upserts feedback for all exercises in a single transaction', async () => {
        ;(prisma.workout.findFirst as any).mockResolvedValue({
            id: UUIDS.workout,
            workoutExercises: [{ id: UUIDS.wex1 }, { id: UUIDS.wex2 }],
        })
        ;(prisma.$transaction as any).mockResolvedValue([
            { id: UUIDS.feedback1, workoutExerciseId: UUIDS.wex1 },
            { id: UUIDS.feedback2, workoutExerciseId: UUIDS.wex2 },
        ])

        const body = {
            notes: 'great session',
            exercises: [
                {
                    workoutExerciseId: UUIDS.wex1,
                    actualRpe: 8,
                    sets: [{ setNumber: 1, completed: true, reps: 5, weight: 100 }],
                },
                {
                    workoutExerciseId: UUIDS.wex2,
                    actualRpe: 7.5,
                    sets: [{ setNumber: 1, completed: true, reps: 8, weight: 60 }],
                },
            ],
        }

        const request = new NextRequest('http://localhost/api/trainee/workouts/' + UUIDS.workout + '/submit', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        })

        const res = await POST(request, withIdParam(UUIDS.workout))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.feedbacks).toHaveLength(2)
        expect(prisma.workout.findFirst).toHaveBeenCalledTimes(1)
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('returns 404 when trainee does not own the workout', async () => {
        ;(prisma.workout.findFirst as any).mockResolvedValue(null)

        const body = {
            notes: null,
            exercises: [
                {
                    workoutExerciseId: UUIDS.wex1,
                    actualRpe: null,
                    sets: [{ setNumber: 1, completed: true, reps: 5, weight: 100 }],
                },
            ],
        }

        const request = new NextRequest('http://localhost/api/trainee/workouts/' + UUIDS.workout + '/submit', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        })

        const res = await POST(request, withIdParam(UUIDS.workout))
        expect(res.status).toBe(404)
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('returns 400 when an exercise in body is not in the workout', async () => {
        ;(prisma.workout.findFirst as any).mockResolvedValue({
            id: UUIDS.workout,
            workoutExercises: [{ id: UUIDS.wex1 }],
        })

        const body = {
            notes: null,
            exercises: [
                {
                    workoutExerciseId: UUIDS.wex2,
                    actualRpe: null,
                    sets: [{ setNumber: 1, completed: true, reps: 5, weight: 100 }],
                },
            ],
        }

        const request = new NextRequest('http://localhost/api/trainee/workouts/' + UUIDS.workout + '/submit', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        })

        const res = await POST(request, withIdParam(UUIDS.workout))
        expect(res.status).toBe(400)
        expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('returns 400 on schema validation error (empty exercises)', async () => {
        const body = { notes: null, exercises: [] }

        const request = new NextRequest('http://localhost/api/trainee/workouts/' + UUIDS.workout + '/submit', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        })

        const res = await POST(request, withIdParam(UUIDS.workout))
        expect(res.status).toBe(400)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/trainee-workout-submit.test.ts`
Expected: FAIL — module `@/app/api/trainee/workouts/[id]/submit/route` not found.

- [ ] **Step 3: Implement the endpoint**

Create `src/app/api/trainee/workouts/[id]/submit/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { workoutSubmitSchema } from '@/schemas/feedback'
import { logger } from '@/lib/logger'

/**
 * POST /api/trainee/workouts/[id]/submit
 * Atomic submit of the whole workout: notes + per-exercise (actualRpe + sets[]).
 * One transaction; one ownership check; upserts on (workoutExerciseId, traineeId, date).
 * RBAC: trainee must own the program containing this workout.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: workoutId } = await params
    try {
        const session = await requireRole(['trainee'])
        const body = await request.json()

        const parsed = workoutSubmitSchema.safeParse(body)
        if (!parsed.success) {
            return apiError(
                'VALIDATION_ERROR',
                'Invalid input',
                400,
                parsed.error.errors,
                'validation.invalidInput'
            )
        }

        const { notes, exercises } = parsed.data

        // 1. Single ownership check: workout belongs to a program owned by this trainee.
        //    Also returns the set of valid workoutExercise ids in one query.
        const workout = await prisma.workout.findFirst({
            where: {
                id: workoutId,
                week: { program: { traineeId: session.user.id } },
            },
            select: {
                id: true,
                workoutExercises: { select: { id: true } },
            },
        })

        if (!workout) {
            return apiError(
                'NOT_FOUND',
                'Workout not found',
                404,
                undefined,
                'workout.notFound'
            )
        }

        // 2. Validate every submitted exercise belongs to this workout.
        const validIds = new Set(workout.workoutExercises.map((we) => we.id))
        const invalid = exercises.find((ex) => !validIds.has(ex.workoutExerciseId))
        if (invalid) {
            return apiError(
                'VALIDATION_ERROR',
                'Exercise does not belong to this workout',
                400,
                { workoutExerciseId: invalid.workoutExerciseId },
                'workoutExercise.notInWorkout'
            )
        }

        // 3. Calendar-day key for upsert idempotency.
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // 4. Single transaction: one upsert per exercise with nested setsPerformed reset.
        const feedbacks = await prisma.$transaction(
            exercises.map((ex) =>
                prisma.exerciseFeedback.upsert({
                    where: {
                        workoutExerciseId_traineeId_date: {
                            workoutExerciseId: ex.workoutExerciseId,
                            traineeId: session.user.id,
                            date: today,
                        },
                    },
                    create: {
                        workoutExerciseId: ex.workoutExerciseId,
                        traineeId: session.user.id,
                        date: today,
                        notes: notes ?? null,
                        actualRpe: ex.actualRpe ?? null,
                        setsPerformed: {
                            create: ex.sets.map((s) => ({
                                setNumber: s.setNumber,
                                completed: s.completed,
                                reps: s.reps,
                                weight: s.weight,
                            })),
                        },
                    },
                    update: {
                        notes: notes ?? null,
                        actualRpe: ex.actualRpe ?? null,
                        setsPerformed: {
                            deleteMany: {},
                            create: ex.sets.map((s) => ({
                                setNumber: s.setNumber,
                                completed: s.completed,
                                reps: s.reps,
                                weight: s.weight,
                            })),
                        },
                    },
                    select: {
                        id: true,
                        workoutExerciseId: true,
                        actualRpe: true,
                        notes: true,
                        date: true,
                    },
                })
            )
        )

        logger.info(
            { workoutId, traineeId: session.user.id, count: feedbacks.length },
            'Workout submitted'
        )

        return apiSuccess({ feedbacks }, 200)
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
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/trainee-workout-submit.test.ts`
Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/trainee/workouts/[id]/submit/route.ts tests/integration/trainee-workout-submit.test.ts
git commit -m "feat(api): add atomic POST /api/trainee/workouts/[id]/submit endpoint"
```

---

### Task 3: Switch trainee workout client to single submit endpoint

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx:276-374,524-577`

- [ ] **Step 1: Replace `doSubmit` to call the new endpoint**

Open `src/app/trainee/workouts/[id]/_content.tsx`. Replace the body of `doSubmit` (around lines 524-577) with:

```typescript
const doSubmit = async () => {
    try {
        setSubmitting(true)

        const payload = {
            notes: globalNotes.trim() || null,
            exercises: workout!.exercises.map((we) => {
                const sets = feedbackData[we.id] || []
                return {
                    workoutExerciseId: we.id,
                    actualRpe: exerciseRPE[we.id] ?? null,
                    sets: sets.map((s) => ({
                        setNumber: s.setNumber,
                        completed: !!s.completed,
                        reps: s.reps,
                        weight: s.weight,
                    })),
                }
            }),
        }

        const res = await fetch(`/api/trainee/workouts/${workout!.id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        if (!res.ok) {
            const data = await res.json()
            throw new Error(getApiErrorMessage(data, t('workouts.errorFeedback'), t))
        }

        clearLocalData()
        showToast(t('workouts.feedbackSuccess'), 'success')

        const navigateTo = fromParam === 'current' ? '/trainee/programs/current' : '/trainee/dashboard'
        router.push(navigateTo)
    } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : t('workouts.errorFeedback'), 'error')
        setSubmitting(false)
    }
}
```

- [ ] **Step 2: Remove `syncDraftFeedback` and its scheduling effects**

Delete from the same file:
- The full `syncDraftFeedback` callback definition (around lines 276-337).
- The `useEffect` block that schedules `syncDraftFeedback` (around lines 350-374).
- The refs that only feed auto-sync: `draftSyncPausedRef`, `draftSyncPromiseRef`, `draftSyncTimeoutRef`, `draftSyncEnabledRef`, `touchedExerciseIdsRef`, `persistedExerciseIdsRef` (search for each ref to confirm no other usage; if any survive in `doSubmit`, remove those references too).

Run after edits: `grep -n "draftSync\|syncDraftFeedback\|touchedExerciseIds\|persistedExerciseIds" src/app/trainee/workouts/\[id\]/_content.tsx`
Expected: empty (no matches).

- [ ] **Step 3: Verify localStorage draft restore still works**

Read `loadLocalData` and the effect at line ~339 (`useEffect(() => { void fetchWorkout(); loadLocalData() }, ...)`). Both must remain unchanged.

- [ ] **Step 4: Run type-check + unit tests**

Run: `npm run type-check && npx vitest run tests/integration/trainee-workout-submit.test.ts`
Expected: PASS.

- [ ] **Step 5: Manual smoke test in browser**

Run `npm run dev`. Log in as trainee. Open a workout, fill in sets/RPE/notes, submit. Verify:
- Network tab shows ONE `POST /api/trainee/workouts/{id}/submit` (not N).
- No background `POST /api/feedback` requests during workout edits.
- Submit succeeds; redirect happens.
- Reload the same workout; sets/RPE/notes are restored from server data via `GET /api/trainee/workouts/[id]`.

- [ ] **Step 6: Commit**

```bash
git add src/app/trainee/workouts/\[id\]/_content.tsx
git commit -m "refactor(trainee): submit whole workout in single atomic POST, drop auto-sync"
```

---

### Task 4: Drop `feedback.completed` consumers (replace filters)

**Files:**
- Modify: `src/app/api/programs/[id]/reports/route.ts:99,157,212`
- Modify: `src/lib/program-status.ts:1-79`
- Modify: `src/app/trainer/dashboard/page.tsx:88-90,170-180,206-214`

- [ ] **Step 1: Reports — drop `.filter(fb.completed)`**

In `src/app/api/programs/[id]/reports/route.ts` change three occurrences:

Line ~99:
```typescript
.flatMap((we) => we.exerciseFeedbacks)
```
(was: `.flatMap((we) => we.exerciseFeedbacks.filter((fb: any) => fb.completed))`)

Line ~157:
```typescript
const feedbacks = we.exerciseFeedbacks
```
(was: `const feedbacks = we.exerciseFeedbacks.filter((fb: any) => fb.completed)`)

Line ~212:
```typescript
const completedFeedbacks = we.exerciseFeedbacks
```
(was: `const completedFeedbacks = we.exerciseFeedbacks.filter((fb: any) => fb.completed)`)

- [ ] **Step 2: program-status.ts — drop `completed` from type and filter**

Replace the top of `src/lib/program-status.ts` (lines 1-52) with:

```typescript
export type ProgramStatus = 'draft' | 'active' | 'completed'

interface ProgramCompletionFeedback {
    date: Date
}

interface ProgramCompletionExercise {
    exerciseFeedbacks: ProgramCompletionFeedback[]
}

interface ProgramCompletionWorkout {
    workoutExercises: ProgramCompletionExercise[]
}

interface ProgramCompletionWeek {
    workouts: ProgramCompletionWorkout[]
}

interface ProgramCompletionProgram {
    status: ProgramStatus
    weeks: ProgramCompletionWeek[]
}

export interface ProgramCompletionSnapshot {
    totalWorkouts: number
    completedWorkouts: number
    lastCompletedWorkoutAt: Date | null
}

export const getProgramCompletionSnapshot = (
    program: ProgramCompletionProgram
): ProgramCompletionSnapshot => {
    const allWorkouts = program.weeks.flatMap((week) => week.workouts)

    let lastCompletedWorkoutAt: Date | null = null

    const completedWorkouts = allWorkouts.filter((workout) => {
        if (workout.workoutExercises.length === 0) {
            return false
        }

        const exerciseDates = workout.workoutExercises.map((exercise) => {
            if (exercise.exerciseFeedbacks.length === 0) {
                return null
            }
            return exercise.exerciseFeedbacks.reduce((latestDate, feedback) => {
                return feedback.date > latestDate ? feedback.date : latestDate
            }, exercise.exerciseFeedbacks[0].date)
        })

        if (exerciseDates.some((date) => date === null)) {
            return false
        }

        const dates = exerciseDates.filter((d): d is Date => d !== null)
        const workoutCompletedAt = dates.reduce((latest, d) => (d > latest ? d : latest), dates[0])

        if (lastCompletedWorkoutAt === null || workoutCompletedAt > lastCompletedWorkoutAt) {
            lastCompletedWorkoutAt = workoutCompletedAt
        }

        return true
    })

    return {
        totalWorkouts: allWorkouts.length,
        completedWorkouts: completedWorkouts.length,
        lastCompletedWorkoutAt,
    }
}
```

(Lines 81+ — `getEffectiveProgramStatus` and below — stay unchanged.)

- [ ] **Step 3: Trainer dashboard — switch to `WorkoutExercise.isCompleted`**

In `src/app/trainer/dashboard/page.tsx`, change the `prisma.week.findMany` `select` block (~lines 170-180):

```typescript
workoutExercises: {
    select: {
        id: true,
        isCompleted: true,
    },
},
```

Replace `hasCompletedFeedback` helper (lines ~88-90) with:

```typescript
function isExerciseCompleted(exercise: { isCompleted: boolean }) {
    return exercise.isCompleted
}
```

In the test-week aggregation (~line 211-213), replace:

```typescript
return workout.workoutExercises.every((exercise) => isExerciseCompleted(exercise))
```

(was: `every((exercise) => hasCompletedFeedback(exercise.exerciseFeedbacks))`)

- [ ] **Step 4: Run type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Run unit tests**

Run: `npx vitest run`
Expected: PASS for everything except `feedback.test.ts` (covered in Task 6).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/programs/\[id\]/reports/route.ts src/lib/program-status.ts src/app/trainer/dashboard/page.tsx
git commit -m "refactor: drop ExerciseFeedback.completed reads, use WorkoutExercise.isCompleted"
```

---

### Task 5: Remove obsolete POST and PUT feedback handlers

**Files:**
- Modify: `src/app/api/feedback/route.ts:154-322`
- Modify: `src/app/api/feedback/[id]/route.ts:82-191`
- Modify: `src/schemas/feedback.ts` (drop `completed` from `feedbackSchema`)
- Modify: `tests/integration/feedback.test.ts` (drop POST/PUT tests, fixtures referencing `completed`)

- [ ] **Step 1: Delete the `POST` export from `/api/feedback/route.ts`**

Open `src/app/api/feedback/route.ts`. Delete the entire `export async function POST(...)` block (lines 154-322 inclusive; everything from the `/** POST /api/feedback */` JSDoc block to the closing brace of `POST`). Keep `GET`.

After edit, also drop the now-unused import of `feedbackSchema`:

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
```

- [ ] **Step 2: Delete the `PUT` export from `/api/feedback/[id]/route.ts`**

Open `src/app/api/feedback/[id]/route.ts`. Delete the entire `export async function PUT(...)` block (lines 82-191 inclusive). Keep `GET`.

After edit, drop the now-unused `feedbackSchema` import.

- [ ] **Step 3: Drop `completed` from `feedbackSchema`**

Edit `src/schemas/feedback.ts`. In `feedbackSchema`, remove the `completed: z.boolean().default(false),` line and remove the `completed` line from `setPerformedSchema` only if no other consumer uses it — verify with: `grep -rn "completed" src/schemas/feedback.ts`.

Wait — `setPerformedSchema.completed` is used by the new submit endpoint (per-set checkmark). Keep it. Only remove the top-level `feedbackSchema.completed`.

- [ ] **Step 4: Trim `tests/integration/feedback.test.ts`**

Open `tests/integration/feedback.test.ts`. Remove every `describe`/`it` block that exercises `POST` from `/api/feedback/route.ts` or `PUT` from `/api/feedback/[id]/route.ts`. Keep `GET` blocks. In remaining mock data, delete the `completed: true|false` field from feedback fixtures (since the column will be dropped).

Adjust the import line:

```typescript
import { GET } from '@/app/api/feedback/route'
import { GET as GET_ID } from '@/app/api/feedback/[id]/route'
```

(was: `import { GET, POST } ...` and `import { GET as GET_ID, PUT } ...`).

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/integration/feedback.test.ts tests/integration/trainee-workout-submit.test.ts`
Expected: PASS for both files.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/feedback/route.ts src/app/api/feedback/\[id\]/route.ts src/schemas/feedback.ts tests/integration/feedback.test.ts
git commit -m "refactor(api): remove obsolete POST /api/feedback and PUT /api/feedback/[id]"
```

---

### Task 6: Drop `completed` column from `ExerciseFeedback`

**Files:**
- Modify: `prisma/schema.prisma:286-308` (remove `completed` line)
- Create: `prisma/migrations/20260429000000_drop_feedback_completed/migration.sql`

- [ ] **Step 1: Edit Prisma schema**

In `prisma/schema.prisma`, locate `model ExerciseFeedback`. Delete this single line:

```prisma
  completed         Boolean   @default(false)
```

The model header should now look like:

```prisma
model ExerciseFeedback {
  id                String    @id @default(uuid())
  workoutExerciseId String
  traineeId         String
  date              DateTime  @default(now())
  actualRpe         Float?    // RPE percepito 5.0-10.0
  notes             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  // ... relations + indexes unchanged
}
```

- [ ] **Step 2: Create the migration SQL**

Create `prisma/migrations/20260429000000_drop_feedback_completed/migration.sql`:

```sql
-- Drop the redundant completed column from exercise_feedbacks.
-- After the atomic submit refactor, every feedback row represents a final submission,
-- making this flag always-true and redundant with workout_exercises.is_completed.

ALTER TABLE "exercise_feedbacks" DROP COLUMN "completed";
```

- [ ] **Step 3: Regenerate Prisma client**

Run: `npm run prisma:generate`
Expected: success, no errors.

- [ ] **Step 4: Apply migration in dev**

Run: `npm run prisma:migrate -- --name drop_feedback_completed`
(or, if the SQL is already authored, run `npx prisma migrate dev` — it will detect the new folder.)

Expected: migration applied; database column dropped.

- [ ] **Step 5: Run full test suite**

Run: `npm run test:unit`
Expected: PASS across the board.

- [ ] **Step 6: Manual smoke test**

Run `npm run dev`. As trainee: complete and submit a workout. As trainer: open the dashboard and program reports — verify:
- Trainer dashboard "completed test workouts" count still works.
- Program report "executed training sets" count still works.
- Program completion snapshot updates `lastCompletedWorkoutAt`.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260429000000_drop_feedback_completed
git commit -m "refactor(db): drop redundant exercise_feedbacks.completed column"
```

---

### Task 7: CHANGELOG + final verification

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Append CHANGELOG entry**

Append to top of `implementation-docs/CHANGELOG.md`:

```markdown
## 2026-04-29 — Atomic workout submit + drop ExerciseFeedback.completed

- **Added** `POST /api/trainee/workouts/[id]/submit` — single atomic endpoint that persists notes + per-exercise (actualRpe + sets[]) for an entire workout in one transaction. Replaces the N parallel `POST /api/feedback` calls (one per exercise) plus the continuous auto-sync loop.
- **Removed** `POST /api/feedback` and `PUT /api/feedback/[id]` (no longer used by the trainee client; admin/trainer keep `GET` access).
- **Removed** continuous draft auto-sync from the trainee workout page; localStorage still preserves drafts on the same device.
- **Schema** Dropped `ExerciseFeedback.completed` (always-true after the refactor; redundant with `WorkoutExercise.isCompleted`). Migration: `20260429000000_drop_feedback_completed`.
- **Why** Reduces submit flow from ~5–8s (8 POSTs × double-auth) to <1s (1 POST × 1 transaction); removes a redundant column and its filter sites.
```

- [ ] **Step 2: Run full verification chain**

Run sequentially:

```bash
npm run type-check
npm run lint
npm run test:unit
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs(changelog): atomic workout submit + drop feedback.completed"
```

---

## Self-review notes

- **Spec coverage:**
  - Option A (atomic submit endpoint) → Tasks 1, 2, 3, 5.
  - Option C (drop `ExerciseFeedback.completed`) → Tasks 4, 6.
  - Test coverage of new endpoint → Task 2.
  - Migration of every consumer of `feedback.completed` (`reports/route.ts`, `program-status.ts`, `trainer/dashboard/page.tsx`) → Task 4.
  - CHANGELOG → Task 7.
- **Type consistency:** `workoutSubmitSchema` field names (`exercises[].workoutExerciseId`, `exercises[].actualRpe`, `exercises[].sets`) are referenced consistently across Tasks 1, 2, 3.
- **No placeholders.** Every step shows the exact code or command.
