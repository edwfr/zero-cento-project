# Bulk Save Workout Exercises Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-exercise sequential HTTP calls in the trainer workout edit page with a single bulk save call that creates and updates all rows in one atomic transaction.

**Architecture:**
- Add a new endpoint `PUT /api/programs/[id]/workouts/[workoutId]/exercises/bulk` that accepts an array of rows (each may carry an `id` to mark it as an update; absence of `id` means create), runs all operations in a single Prisma `$transaction`, and returns the canonical workout exercises list.
- Update the existing Zod `bulkWorkoutExercisesSchema` so each row may include an optional `id` (UUID) for updates.
- Replace the `for`-loop of `fetch` calls in `saveWorkoutRows` (`src/app/trainer/programs/[id]/edit/_content.tsx`) with one `fetch` to the new endpoint.

**Tech Stack:** Next.js 15 App Router, Prisma, Zod, TypeScript, Vitest (jsdom), react-i18next.

---

## File Structure

- `src/schemas/workout-exercise.ts` — extend `bulkWorkoutExercisesSchema` to allow optional `id` per row.
- `src/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route.ts` — new bulk PUT handler (create + update in one transaction).
- `src/app/trainer/programs/[id]/edit/_content.tsx` — refactor `saveWorkoutRows` to call the bulk endpoint once instead of looping.
- `tests/integration/workout-exercises-bulk.test.ts` — new integration test file for the bulk handler.
- `public/locales/en/trainer.json` + `public/locales/it/trainer.json` — no new keys (reuse existing `rowSaveError`, `rowUpdateError`, `workoutRowsSavedSuccess`, `rowSaveGenericError`).
- `implementation-docs/CHANGELOG.md` — add entry.

---

## Task 1: Extend bulk schema to allow optional `id` for updates

**Files:**
- Modify: `src/schemas/workout-exercise.ts`
- Test: `tests/unit/schemas.test.ts`

- [ ] **Step 1: Write the failing schema test**

Append to `tests/unit/schemas.test.ts`:

```ts
import { bulkSaveWorkoutExercisesSchema } from '@/schemas/workout-exercise'

describe('bulkSaveWorkoutExercisesSchema', () => {
    const validRow = {
        exerciseId: '33333333-3333-3333-3333-333333333331',
        sets: 3,
        reps: '8',
        weightType: 'absolute' as const,
        weight: 100,
        restTime: 'm2' as const,
        isWarmup: false,
        order: 1,
    }

    it('accepts rows without id (create) and with id (update) mixed', () => {
        const parsed = bulkSaveWorkoutExercisesSchema.parse({
            exercises: [
                validRow,
                { ...validRow, id: '44444444-4444-4444-4444-444444444444', order: 2 },
            ],
        })
        expect(parsed.exercises).toHaveLength(2)
        expect(parsed.exercises[0].id).toBeUndefined()
        expect(parsed.exercises[1].id).toBe('44444444-4444-4444-4444-444444444444')
    })

    it('rejects when id is not a uuid', () => {
        const result = bulkSaveWorkoutExercisesSchema.safeParse({
            exercises: [{ ...validRow, id: 'not-a-uuid' }],
        })
        expect(result.success).toBe(false)
    })

    it('rejects empty exercises array', () => {
        const result = bulkSaveWorkoutExercisesSchema.safeParse({ exercises: [] })
        expect(result.success).toBe(false)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/schemas.test.ts -t "bulkSaveWorkoutExercisesSchema"`
Expected: FAIL with `bulkSaveWorkoutExercisesSchema` not exported.

- [ ] **Step 3: Add the schema**

In `src/schemas/workout-exercise.ts`, **delete** the existing (unused) `bulkWorkoutExercisesSchema` and `BulkWorkoutExercisesInput` (verified unreferenced via `grep -rn "bulkWorkoutExercisesSchema\|BulkWorkoutExercisesInput" src tests` — no hits) and add in their place:

```ts
export const bulkSaveWorkoutExercisesSchema = z.object({
    exercises: z
        .array(
            workoutExerciseBaseSchema
                .extend({ id: z.string().uuid().optional() })
                .superRefine((data, ctx) => {
                    if (data.weightType.startsWith('percentage') && data.weight === undefined) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: 'validation.weightRequiredForPercentage',
                            path: ['weight'],
                        })
                    }
                    if (
                        data.weight !== undefined &&
                        data.weightType !== 'percentage_previous' &&
                        data.weight < 0
                    ) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.too_small,
                            minimum: 0,
                            type: 'number',
                            inclusive: true,
                            message: 'validation.weightMinZero',
                            path: ['weight'],
                        })
                    }
                    if (
                        data.effectiveWeight !== undefined &&
                        data.effectiveWeight !== null &&
                        data.effectiveWeight < 0
                    ) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.too_small,
                            minimum: 0,
                            type: 'number',
                            inclusive: true,
                            message: 'validation.effectiveWeightMinZero',
                            path: ['effectiveWeight'],
                        })
                    }
                })
        )
        .min(1, 'validation.atLeastOneExercise'),
})

export type BulkSaveWorkoutExercisesInput = z.infer<typeof bulkSaveWorkoutExercisesSchema>
```

This re-applies the same `superRefine` cross-field rules used by the single-row `workoutExerciseSchema`, while extending the base shape with the optional `id` (UUID) used to flag updates.

- [ ] **Step 4: Run schema test to verify it passes**

Run: `npx vitest run tests/unit/schemas.test.ts -t "bulkSaveWorkoutExercisesSchema"`
Expected: PASS (3 cases).

- [ ] **Step 5: Run full schemas test to ensure no regression**

Run: `npx vitest run tests/unit/schemas.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/schemas/workout-exercise.ts tests/unit/schemas.test.ts
git commit -m "feat(schemas): add bulkSaveWorkoutExercisesSchema with optional row id"
```

---

## Task 2: Bulk PUT route handler — happy path (create-only)

**Files:**
- Create: `src/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route.ts`
- Test: `tests/integration/workout-exercises-bulk.test.ts`

- [ ] **Step 1: Scaffold the failing test file**

Create `tests/integration/workout-exercises-bulk.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession, mockAdminSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: { findUnique: vi.fn() },
        workoutExercise: {
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        exercise: { findMany: vi.fn() },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { PUT as bulkPut } from '@/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const PROG = '11111111-1111-1111-1111-111111111111'
const WK = '22222222-2222-2222-2222-222222222222'
const EX = '33333333-3333-3333-3333-333333333331'
const WE_EXISTING = '44444444-4444-4444-4444-444444444444'

const baseRow = {
    exerciseId: EX,
    sets: 3,
    reps: '8',
    weightType: 'absolute' as const,
    weight: 100,
    restTime: 'm2' as const,
    isWarmup: false,
    order: 1,
}

function makePutRequest(body: unknown) {
    return new NextRequest(
        `http://localhost:3000/api/programs/${PROG}/workouts/${WK}/exercises/bulk`,
        { method: 'PUT', body: JSON.stringify(body) } as any
    )
}

const params = (id: string, workoutId: string) => ({
    params: Promise.resolve({ id, workoutId }),
})

const draftProgramOwned = {
    id: PROG,
    trainerId: mockTrainerSession.user.id,
    status: 'draft',
    weeks: [{ workouts: [{ id: WK }] }],
}

describe('PUT /api/programs/[id]/workouts/[workoutId]/exercises/bulk', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(draftProgramOwned as any)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([{ id: EX }] as any)
        vi.mocked(prisma.workoutExercise.findMany).mockResolvedValue([
            { id: 'new-1', order: 1 },
            { id: 'new-2', order: 2 },
        ] as any)
        vi.mocked(prisma.$transaction).mockResolvedValue([])
    })

    it('creates all rows and returns the updated list', async () => {
        const res = await bulkPut(
            makePutRequest({ exercises: [baseRow, { ...baseRow, order: 2 }] }),
            params(PROG, WK)
        )
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.data.workoutExercises).toHaveLength(2)
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/integration/workout-exercises-bulk.test.ts -t "creates all rows"`
Expected: FAIL with module not found at `@/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route`.

- [ ] **Step 3: Write the minimal handler**

Create `src/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { bulkSaveWorkoutExercisesSchema } from '@/schemas/workout-exercise'
import { logger } from '@/lib/logger'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; workoutId: string }> }
) {
    const { id: programId, workoutId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = bulkSaveWorkoutExercisesSchema.safeParse(body)
        if (!validation.success) {
            return apiError(
                'VALIDATION_ERROR',
                'Invalid input',
                400,
                validation.error.errors,
                'validation.invalidInput'
            )
        }

        const { exercises } = validation.data

        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            include: {
                weeks: {
                    include: {
                        workouts: { where: { id: workoutId }, select: { id: true } },
                    },
                },
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError(
                'FORBIDDEN',
                'You can only modify your own programs',
                403,
                undefined,
                'program.modifyDenied'
            )
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

        const workoutExists = program.weeks
            .flatMap((w: any) => w.workouts)
            .some((w: any) => w.id === workoutId)
        if (!workoutExists) {
            return apiError(
                'NOT_FOUND',
                'Workout not found in this program',
                404,
                undefined,
                'workout.notFoundInProgram'
            )
        }

        const updateIds = exercises
            .map((row) => row.id)
            .filter((id): id is string => Boolean(id))

        if (updateIds.length > 0) {
            const existingForWorkout = await prisma.workoutExercise.findMany({
                where: { id: { in: updateIds }, workoutId },
                select: { id: true },
            })
            if (existingForWorkout.length !== updateIds.length) {
                return apiError(
                    'NOT_FOUND',
                    'One or more workout exercises not found',
                    404,
                    undefined,
                    'workoutExercise.notFound'
                )
            }
        }

        const referencedExerciseIds = Array.from(new Set(exercises.map((row) => row.exerciseId)))
        const referencedExercises = await prisma.exercise.findMany({
            where: { id: { in: referencedExerciseIds } },
            select: { id: true },
        })
        if (referencedExercises.length !== referencedExerciseIds.length) {
            return apiError(
                'NOT_FOUND',
                'One or more exercises not found',
                404,
                undefined,
                'exercise.notFound'
            )
        }

        const operations = exercises.map((row) => {
            const data = {
                workoutId,
                exerciseId: row.exerciseId,
                variant: row.variant ?? null,
                order: row.order,
                sets: row.sets,
                reps: typeof row.reps === 'number' ? row.reps.toString() : row.reps,
                notes: row.notes ?? null,
                targetRpe: row.targetRpe ?? null,
                weightType: row.weightType,
                weight: row.weight ?? null,
                effectiveWeight: row.effectiveWeight ?? null,
                restTime: row.restTime,
                isWarmup: row.isWarmup,
            }
            if (row.id) {
                return prisma.workoutExercise.update({ where: { id: row.id }, data })
            }
            return prisma.workoutExercise.create({ data })
        })

        await prisma.$transaction(operations)

        const workoutExercises = await prisma.workoutExercise.findMany({
            where: { workoutId },
            include: {
                exercise: {
                    include: {
                        movementPattern: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { order: 'asc' },
        })

        logger.info(
            {
                programId,
                workoutId,
                count: exercises.length,
                userId: session.user.id,
            },
            'Workout exercises bulk saved'
        )

        return apiSuccess({ workoutExercises })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error(
            { error, programId, workoutId },
            'Error bulk saving workout exercises'
        )
        return apiError(
            'INTERNAL_ERROR',
            'Failed to save workout exercises',
            500,
            undefined,
            'internal.default'
        )
    }
}
```

- [ ] **Step 4: Run the happy-path test to verify it passes**

Run: `npx vitest run tests/integration/workout-exercises-bulk.test.ts -t "creates all rows"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route.ts tests/integration/workout-exercises-bulk.test.ts
git commit -m "feat(api): bulk PUT endpoint for workout exercises (create + update in one transaction)"
```

---

## Task 3: Bulk handler — update path and mixed batch

**Files:**
- Modify: `tests/integration/workout-exercises-bulk.test.ts` (add cases)

- [ ] **Step 1: Add the failing test cases**

Append inside the existing `describe('PUT /api/programs/[id]/workouts/[workoutId]/exercises/bulk', ...)`:

```ts
    it('updates an existing row when id is supplied', async () => {
        vi.mocked(prisma.workoutExercise.findMany)
            .mockResolvedValueOnce([{ id: WE_EXISTING }] as any) // ownership check
            .mockResolvedValueOnce([{ id: WE_EXISTING, order: 1 }] as any) // final fetch

        const res = await bulkPut(
            makePutRequest({
                exercises: [{ ...baseRow, id: WE_EXISTING, sets: 5 }],
            }),
            params(PROG, WK)
        )

        expect(res.status).toBe(200)
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('handles mixed creates and updates in one call', async () => {
        vi.mocked(prisma.workoutExercise.findMany)
            .mockResolvedValueOnce([{ id: WE_EXISTING }] as any)
            .mockResolvedValueOnce([
                { id: WE_EXISTING, order: 1 },
                { id: 'new-1', order: 2 },
            ] as any)

        const res = await bulkPut(
            makePutRequest({
                exercises: [
                    { ...baseRow, id: WE_EXISTING, order: 1 },
                    { ...baseRow, order: 2 },
                ],
            }),
            params(PROG, WK)
        )

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.data.workoutExercises).toHaveLength(2)
    })
```

- [ ] **Step 2: Run the new tests to confirm they pass against the existing implementation**

Run: `npx vitest run tests/integration/workout-exercises-bulk.test.ts`
Expected: ALL PASS (the handler from Task 2 already supports both branches).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/workout-exercises-bulk.test.ts
git commit -m "test(api): cover bulk workout-exercises updates and mixed batches"
```

---

## Task 4: Bulk handler — guard tests (auth, ownership, status, missing IDs)

**Files:**
- Modify: `tests/integration/workout-exercises-bulk.test.ts`

- [ ] **Step 1: Add failing guard cases**

Append:

```ts
    it('rejects empty array with 400', async () => {
        const res = await bulkPut(makePutRequest({ exercises: [] }), params(PROG, WK))
        expect(res.status).toBe(400)
    })

    it('returns 404 when program does not exist', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue(null as any)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(404)
    })

    it('returns 403 when trainer does not own the program', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...draftProgramOwned,
            trainerId: 'other-trainer',
        } as any)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(403)
    })

    it('returns 403 when program is not draft (non-admin)', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...draftProgramOwned,
            status: 'active',
        } as any)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(403)
    })

    it('allows admin to save against a non-draft program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession as any)
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...draftProgramOwned,
            status: 'active',
        } as any)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(200)
    })

    it('returns 404 when workout does not belong to program', async () => {
        vi.mocked(prisma.trainingProgram.findUnique).mockResolvedValue({
            ...draftProgramOwned,
            weeks: [{ workouts: [] }],
        } as any)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(404)
    })

    it('returns 404 when an update id is not in the workout', async () => {
        vi.mocked(prisma.workoutExercise.findMany).mockResolvedValueOnce([] as any)
        const res = await bulkPut(
            makePutRequest({ exercises: [{ ...baseRow, id: WE_EXISTING }] }),
            params(PROG, WK)
        )
        expect(res.status).toBe(404)
    })

    it('returns 404 when a referenced exerciseId does not exist', async () => {
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([] as any)
        const res = await bulkPut(makePutRequest({ exercises: [baseRow] }), params(PROG, WK))
        expect(res.status).toBe(404)
    })
```

- [ ] **Step 2: Run the test file**

Run: `npx vitest run tests/integration/workout-exercises-bulk.test.ts`
Expected: ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/workout-exercises-bulk.test.ts
git commit -m "test(api): add guard tests for bulk workout-exercises endpoint"
```

---

## Task 5: Refactor `saveWorkoutRows` to call the bulk endpoint

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:1606-1652`

- [ ] **Step 1: Replace the per-row loop with a single bulk call**

Replace the body of the `try` block in `saveWorkoutRows` (currently lines ~1606–1652) with:

```ts
        try {
            setSavingWorkoutId(workout.id)

            const bulkPayload = {
                exercises: workoutRows.map((row) => {
                    const payload = payloadByRowId[row.id]
                    return row.isDraft ? payload : { ...payload, id: row.id }
                }),
            }

            const res = await fetch(
                `/api/programs/${programId}/workouts/${workout.id}/exercises/bulk`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bulkPayload),
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    getApiErrorMessage(data, t('editProgram.rowSaveError'), t)
                )
            }

            workoutRows.forEach((row) => {
                if (row.isDraft) {
                    removeDraftRow(row.id, workout.id)
                }
            })

            await fetchProgram({ showLoading: false })
            showToast(t('editProgram.workoutRowsSavedSuccess'), 'success')
        } catch (err: unknown) {
            showToast(
                err instanceof Error ? err.message : t('editProgram.rowSaveGenericError'),
                'error'
            )
        } finally {
            setSavingRowId(null)
            setSavingWorkoutId(null)
        }
```

Notes:
- `setSavingRowId` is no longer set per-row inside the loop because the call is single-shot. Keep the `setSavingRowId(null)` in `finally` so any prior single-row save state is cleared.
- The existing pre-loop validation block (`getBaseValidationError`, `resolveWeightInputForRow`, `payloadByRowId`, `effectiveWeightByRowId`) stays unchanged — only the request loop is replaced.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new warnings/errors in modified files.

- [ ] **Step 4: Run unit + integration suites**

Run: `npm run test:unit`
Expected: all PASS, including the new `tests/integration/workout-exercises-bulk.test.ts`.

- [ ] **Step 5: Manual smoke test**

1. `npm run dev`
2. Visit `http://localhost:3000/trainer/programs/<id>/edit` as a trainer that owns a draft program with at least one workout populated with both existing and newly-added exercises.
3. Add at least one new draft row, modify at least one persisted row, click "Salva workout".
4. Open DevTools → Network. Confirm exactly **one** request is fired to `/api/programs/.../workouts/.../exercises/bulk` (instead of N requests to `.../exercises` and `.../exercises/{id}`).
5. Confirm the workout reloads with both new and updated rows persisted.
6. Trigger a validation error (e.g. invalid weight type combination) and confirm the toast still surfaces the server message.

- [ ] **Step 6: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "perf(trainer): batch workout exercises save into one HTTP call"
```

---

## Task 6: Update changelog

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Add a new entry at the top**

Append a new entry under the latest date heading (or create one for `2026-04-26`) following the file's existing style. Example body:

```
- Added bulk PUT `/api/programs/[id]/workouts/[workoutId]/exercises/bulk` that creates and updates workout exercises in a single Prisma transaction, and refactored the trainer workout edit screen to call it once per "Salva workout" instead of one request per row.
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog entry for bulk workout-exercise save"
```

---

## Self-Review Notes (for the implementer)

- The bulk endpoint deliberately mirrors the validation order of the existing single POST/PUT routes: program lookup → ownership → draft status → workout-in-program → update-id ownership → referenced exercise existence. Keep this ordering when refactoring; it produces the same `apiError` shapes and `key` translations the FE already handles.
- Frontend keeps the existing pre-call validation (`getBaseValidationError`, `resolveWeightInputForRow`) so the user still gets row-level toast feedback before the network round-trip.
- No new translation keys are required; both success (`workoutRowsSavedSuccess`) and error (`rowSaveError`, `rowSaveGenericError`) keys already exist in `public/locales/{en,it}/trainer.json`.
- `WorkoutExercise` has no unique constraint on `(workoutId, order)` (verified in `prisma/schema.prisma`), so order collisions during the transaction are not a concern.
