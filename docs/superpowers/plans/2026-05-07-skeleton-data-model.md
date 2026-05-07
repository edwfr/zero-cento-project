# Skeleton Data Model Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move wizard "skeleton" out of `WorkoutExercise.isSkeletonExercise` flag into a dedicated `WorkoutSkeleton` table; persist step-2 work; hydrate step-3 draft rows in memory; write to `WorkoutExercise` only on save-workout / copy-week.

**Architecture:** New `WorkoutSkeleton` table indexed by (programId, dayIndex, order). New `PUT /api/programs/[id]/skeleton` endpoint (draft-only). GET program payload includes skeleton. Step 2 reads/writes skeleton via the new endpoint. Step 3 hydrates in-memory draft rows from `skeleton[dayIndex]` for workouts with no saved `WorkoutExercise` rows; saved workouts use their existing rows. The boolean `isSkeletonExercise` is removed from schema, server code, frontend code, and tests.

**Tech Stack:** Next.js 15 App Router, Prisma + PostgreSQL, Zod, React + TanStack Query, Vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-05-07-skeleton-data-model-design.md`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `WorkoutSkeleton` model + relation; drop `isSkeletonExercise` from `WorkoutExercise` |
| Create | `prisma/migrations/20260507000000_skeleton_table/migration.sql` | Create table; drop column |
| Create | `src/schemas/skeleton.ts` | Zod schema for PUT skeleton payload |
| Create | `src/app/api/programs/[id]/skeleton/route.ts` | PUT bulk replace skeleton |
| Modify | `src/app/api/programs/[id]/route.ts` | Include skeleton in GET payload |
| Modify | `src/schemas/workout-exercise.ts` | Remove `isSkeletonExercise` field |
| Modify | `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts` | Drop `isSkeletonExercise` |
| Modify | `src/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route.ts` | Drop `isSkeletonExercise` |
| Modify | `src/app/api/programs/[id]/copy-week/route.ts` | Drop `isSkeletonExercise` from response |
| Modify | `src/lib/trainee-program-data.ts` | Drop `isSkeletonExercise` from select + return shape |
| Modify | `src/app/trainer/programs/[id]/edit/structure-utils.ts` | Source from skeleton; drop flag from input shape |
| Modify | `src/app/trainer/programs/[id]/edit/transform-utils.ts` | Drop `isSkeletonExercise` from transformed shape |
| Modify | `src/app/trainer/programs/[id]/edit/_content.tsx` | Skeleton load/save; drop flag; hydrate step 3 |
| Modify | `src/app/trainee/programs/_components/ProgramDetailContent.tsx` | Drop flag from interface |
| Modify | `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx` | Drop flag from interface |
| Create | `tests/integration/skeleton.test.ts` | PUT/GET, status guard, cascade |
| Create | `tests/unit/skeleton-hydration.test.ts` | Hydration merge logic |
| Modify | `tests/unit/structure-utils.test.ts` | Update for new source shape |
| Modify | `tests/unit/calculations.test.ts` | Drop flag from helper |
| Modify | `tests/integration/program-detail.test.ts` | Drop flag from fixture |
| Modify | `implementation-docs/CHANGELOG.md` | Entry |

---

## Phase 1 — Database & Schema

### Task 1: Add `WorkoutSkeleton` to Prisma schema; drop `isSkeletonExercise`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1.1: Add `WorkoutSkeleton` model**

In `prisma/schema.prisma`, after the `WorkoutExercise` model (currently ends near line 290 with `@@map("workout_exercises")`), add:

```prisma
model WorkoutSkeleton {
  id         String   @id @default(uuid())
  programId  String
  dayIndex   Int      // 0..workoutsPerWeek-1 — workout column in step 2
  order      Int      // row order within the day
  exerciseId String
  createdAt  DateTime @default(now())

  program  TrainingProgram @relation("ProgramSkeletons", fields: [programId], references: [id], onDelete: Cascade)
  exercise Exercise        @relation("ExerciseSkeletons", fields: [exerciseId], references: [id])

  @@unique([programId, dayIndex, order])
  @@index([programId, dayIndex])
  @@map("workout_skeletons")
}
```

- [ ] **Step 1.2: Add inverse relation on `TrainingProgram`**

In the `TrainingProgram` model, after the `weeks Week[] @relation("ProgramWeeks")` line, add:

```prisma
  workoutSkeletons WorkoutSkeleton[] @relation("ProgramSkeletons")
```

- [ ] **Step 1.3: Add inverse relation on `Exercise`**

In the `Exercise` model, after the `personalRecords PersonalRecord[] @relation("ExerciseRecords")` line, add:

```prisma
  workoutSkeletons WorkoutSkeleton[] @relation("ExerciseSkeletons")
```

- [ ] **Step 1.4: Remove `isSkeletonExercise` from `WorkoutExercise` model**

In the `WorkoutExercise` model, delete the line:

```prisma
  isSkeletonExercise Boolean @default(false) // True se esercizio è uno schema vuoto/template non completamente configurato
```

- [ ] **Step 1.5: Validate schema**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 1.6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add WorkoutSkeleton model; drop WorkoutExercise.isSkeletonExercise"
```

---

### Task 2: Create migration SQL

**Files:**
- Create: `prisma/migrations/20260507000000_skeleton_table/migration.sql`

- [ ] **Step 2.1: Create migration directory**

```bash
mkdir -p prisma/migrations/20260507000000_skeleton_table
```

- [ ] **Step 2.2: Write migration SQL**

Create `prisma/migrations/20260507000000_skeleton_table/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "workout_skeletons" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_skeletons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workout_skeletons_programId_dayIndex_order_key" ON "workout_skeletons"("programId", "dayIndex", "order");

-- CreateIndex
CREATE INDEX "workout_skeletons_programId_dayIndex_idx" ON "workout_skeletons"("programId", "dayIndex");

-- AddForeignKey
ALTER TABLE "workout_skeletons" ADD CONSTRAINT "workout_skeletons_programId_fkey" FOREIGN KEY ("programId") REFERENCES "training_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_skeletons" ADD CONSTRAINT "workout_skeletons_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: drop legacy skeleton flag
ALTER TABLE "workout_exercises" DROP COLUMN "isSkeletonExercise";
```

- [ ] **Step 2.3: Apply migration**

```bash
npm run prisma:migrate
```

When prompted for migration name, accept default (already named via folder). Expected output: migration applied; Prisma Client regenerated.

- [ ] **Step 2.4: Regenerate Prisma client (defensive)**

```bash
npm run prisma:generate
```

- [ ] **Step 2.5: Commit**

```bash
git add prisma/migrations/20260507000000_skeleton_table/migration.sql
git commit -m "feat(migration): create workout_skeletons; drop workout_exercises.isSkeletonExercise"
```

---

## Phase 2 — Skeleton API

### Task 3: Zod schema for skeleton payload

**Files:**
- Create: `src/schemas/skeleton.ts`
- Create: `tests/unit/skeleton-schema.test.ts`

- [ ] **Step 3.1: Write failing test**

Create `tests/unit/skeleton-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { putSkeletonSchema } from '@/schemas/skeleton'

describe('putSkeletonSchema', () => {
    it('accepts valid skeleton payload', () => {
        const result = putSkeletonSchema.safeParse({
            rows: [
                { dayIndex: 0, order: 1, exerciseId: '550e8400-e29b-41d4-a716-446655440000' },
                { dayIndex: 0, order: 2, exerciseId: '550e8400-e29b-41d4-a716-446655440001' },
                { dayIndex: 1, order: 1, exerciseId: '550e8400-e29b-41d4-a716-446655440002' },
            ],
        })
        expect(result.success).toBe(true)
    })

    it('accepts empty rows array', () => {
        const result = putSkeletonSchema.safeParse({ rows: [] })
        expect(result.success).toBe(true)
    })

    it('rejects non-uuid exerciseId', () => {
        const result = putSkeletonSchema.safeParse({
            rows: [{ dayIndex: 0, order: 1, exerciseId: 'not-a-uuid' }],
        })
        expect(result.success).toBe(false)
    })

    it('rejects negative dayIndex', () => {
        const result = putSkeletonSchema.safeParse({
            rows: [{ dayIndex: -1, order: 1, exerciseId: '550e8400-e29b-41d4-a716-446655440000' }],
        })
        expect(result.success).toBe(false)
    })

    it('rejects order < 1', () => {
        const result = putSkeletonSchema.safeParse({
            rows: [{ dayIndex: 0, order: 0, exerciseId: '550e8400-e29b-41d4-a716-446655440000' }],
        })
        expect(result.success).toBe(false)
    })
})
```

- [ ] **Step 3.2: Run test to verify failure**

```bash
npx vitest run tests/unit/skeleton-schema.test.ts
```

Expected: FAIL — `Cannot find module '@/schemas/skeleton'`.

- [ ] **Step 3.3: Implement schema**

Create `src/schemas/skeleton.ts`:

```typescript
import { z } from 'zod'

export const skeletonRowSchema = z.object({
    dayIndex: z.number().int().min(0),
    order: z.number().int().min(1),
    exerciseId: z.string().uuid(),
})

export const putSkeletonSchema = z.object({
    rows: z.array(skeletonRowSchema),
})

export type SkeletonRowInput = z.infer<typeof skeletonRowSchema>
export type PutSkeletonInput = z.infer<typeof putSkeletonSchema>
```

- [ ] **Step 3.4: Run tests to verify pass**

```bash
npx vitest run tests/unit/skeleton-schema.test.ts
```

Expected: PASS — 5 tests passing.

- [ ] **Step 3.5: Commit**

```bash
git add src/schemas/skeleton.ts tests/unit/skeleton-schema.test.ts
git commit -m "feat(schemas): add skeleton zod schema with tests"
```

---

### Task 4: Skeleton API endpoint (PUT bulk replace)

**Files:**
- Create: `src/app/api/programs/[id]/skeleton/route.ts`
- Create: `tests/integration/skeleton.test.ts`

- [ ] **Step 4.1: Write failing integration test**

Create `tests/integration/skeleton.test.ts`. Reference structure from `tests/integration/programs.test.ts` for fixtures:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { PUT } from '@/app/api/programs/[id]/skeleton/route'
import { GET as getProgram } from '@/app/api/programs/[id]/route'
import { setupTestUser, cleanupTestData, type TestUser } from './fixtures'

describe('PUT /api/programs/[id]/skeleton', () => {
    let trainer: TestUser
    let trainee: TestUser
    let exerciseId: string
    let programId: string

    beforeAll(async () => {
        trainer = await setupTestUser('trainer')
        trainee = await setupTestUser('trainee')
        await prisma.trainerTrainee.create({
            data: { trainerId: trainer.id, traineeId: trainee.id },
        })

        const exercise = await prisma.exercise.findFirst()
        if (!exercise) throw new Error('Seed exercises before running tests')
        exerciseId = exercise.id
    })

    beforeEach(async () => {
        await prisma.workoutSkeleton.deleteMany({})
        await prisma.trainingProgram.deleteMany({ where: { trainerId: trainer.id } })
        const program = await prisma.trainingProgram.create({
            data: {
                title: 'Skeleton test program',
                trainerId: trainer.id,
                traineeId: trainee.id,
                durationWeeks: 2,
                workoutsPerWeek: 2,
                status: 'draft',
            },
        })
        programId = program.id
    })

    afterAll(async () => {
        await cleanupTestData()
    })

    it('replaces skeleton rows atomically', async () => {
        await prisma.workoutSkeleton.create({
            data: { programId, dayIndex: 0, order: 1, exerciseId },
        })

        const req = new Request(`http://test/api/programs/${programId}/skeleton`, {
            method: 'PUT',
            headers: { authorization: trainer.authHeader, 'content-type': 'application/json' },
            body: JSON.stringify({
                rows: [
                    { dayIndex: 0, order: 1, exerciseId },
                    { dayIndex: 1, order: 1, exerciseId },
                ],
            }),
        }) as any

        const res = await PUT(req, { params: Promise.resolve({ id: programId }) })
        expect(res.status).toBe(200)

        const rows = await prisma.workoutSkeleton.findMany({
            where: { programId },
            orderBy: [{ dayIndex: 'asc' }, { order: 'asc' }],
        })
        expect(rows).toHaveLength(2)
        expect(rows[0].dayIndex).toBe(0)
        expect(rows[1].dayIndex).toBe(1)
    })

    it('returns 403 if program is not draft', async () => {
        await prisma.trainingProgram.update({
            where: { id: programId },
            data: { status: 'active', publishedAt: new Date(), startDate: new Date() },
        })

        const req = new Request(`http://test/api/programs/${programId}/skeleton`, {
            method: 'PUT',
            headers: { authorization: trainer.authHeader, 'content-type': 'application/json' },
            body: JSON.stringify({ rows: [{ dayIndex: 0, order: 1, exerciseId }] }),
        }) as any

        const res = await PUT(req, { params: Promise.resolve({ id: programId }) })
        expect(res.status).toBe(403)
    })

    it('returns 403 if trainer does not own program', async () => {
        const otherTrainer = await setupTestUser('trainer')
        const req = new Request(`http://test/api/programs/${programId}/skeleton`, {
            method: 'PUT',
            headers: { authorization: otherTrainer.authHeader, 'content-type': 'application/json' },
            body: JSON.stringify({ rows: [] }),
        }) as any

        const res = await PUT(req, { params: Promise.resolve({ id: programId }) })
        expect(res.status).toBe(403)
    })

    it('cascades delete when program is deleted', async () => {
        await prisma.workoutSkeleton.createMany({
            data: [
                { programId, dayIndex: 0, order: 1, exerciseId },
                { programId, dayIndex: 0, order: 2, exerciseId },
            ],
        })

        await prisma.trainingProgram.delete({ where: { id: programId } })
        const remaining = await prisma.workoutSkeleton.findMany({ where: { programId } })
        expect(remaining).toHaveLength(0)
    })

    it('GET program includes skeleton in payload', async () => {
        await prisma.workoutSkeleton.createMany({
            data: [
                { programId, dayIndex: 0, order: 1, exerciseId },
                { programId, dayIndex: 1, order: 1, exerciseId },
            ],
        })

        const req = new Request(`http://test/api/programs/${programId}`, {
            method: 'GET',
            headers: { authorization: trainer.authHeader },
        }) as any

        const res = await getProgram(req, { params: Promise.resolve({ id: programId }) })
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.data.program.skeleton).toBeDefined()
        expect(body.data.program.skeleton).toHaveLength(2)
        expect(body.data.program.skeleton[0]).toMatchObject({
            dayIndex: 0,
            order: 1,
            exerciseId,
        })
    })
})
```

- [ ] **Step 4.2: Run test to verify failure**

```bash
npx vitest run tests/integration/skeleton.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/programs/[id]/skeleton/route'`.

- [ ] **Step 4.3: Implement skeleton PUT route**

Create `src/app/api/programs/[id]/skeleton/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { putSkeletonSchema } from '@/schemas/skeleton'
import { logger } from '@/lib/logger'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = putSkeletonSchema.safeParse(body)
        if (!validation.success) {
            return apiError(
                'VALIDATION_ERROR',
                'Invalid input',
                400,
                validation.error.errors,
                'validation.invalidInput'
            )
        }

        const { rows } = validation.data

        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            select: { id: true, trainerId: true, status: true, workoutsPerWeek: true },
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
                'Cannot modify skeleton: only draft programs can be edited',
                403,
                undefined,
                'program.cannotModifyNonDraft'
            )
        }

        const outOfRange = rows.find(
            (row) => row.dayIndex < 0 || row.dayIndex >= program.workoutsPerWeek
        )
        if (outOfRange) {
            return apiError(
                'VALIDATION_ERROR',
                `dayIndex must be between 0 and ${program.workoutsPerWeek - 1}`,
                400,
                undefined,
                'skeleton.dayIndexOutOfRange'
            )
        }

        if (rows.length > 0) {
            const referencedExerciseIds = Array.from(new Set(rows.map((r) => r.exerciseId)))
            const found = await prisma.exercise.findMany({
                where: { id: { in: referencedExerciseIds } },
                select: { id: true },
            })
            if (found.length !== referencedExerciseIds.length) {
                return apiError(
                    'NOT_FOUND',
                    'One or more exercises not found',
                    404,
                    undefined,
                    'exercise.notFound'
                )
            }
        }

        await prisma.$transaction([
            prisma.workoutSkeleton.deleteMany({ where: { programId } }),
            ...(rows.length > 0
                ? [prisma.workoutSkeleton.createMany({
                      data: rows.map((row) => ({
                          programId,
                          dayIndex: row.dayIndex,
                          order: row.order,
                          exerciseId: row.exerciseId,
                      })),
                  })]
                : []),
        ])

        const skeleton = await prisma.workoutSkeleton.findMany({
            where: { programId },
            orderBy: [{ dayIndex: 'asc' }, { order: 'asc' }],
            select: { dayIndex: true, order: true, exerciseId: true },
        })

        logger.info(
            { programId, count: rows.length, userId: session.user.id },
            'Skeleton replaced'
        )

        return apiSuccess({ skeleton })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error replacing skeleton')
        return apiError('INTERNAL_ERROR', 'Failed to replace skeleton', 500, undefined, 'internal.default')
    }
}
```

- [ ] **Step 4.4: Add skeleton to GET program payload**

In `src/app/api/programs/[id]/route.ts`, in the `GET` handler, locate the `prisma.trainingProgram.findUnique` call (around line 44–81). In the `include` object, after `weeks: { ... }` add a sibling include:

```typescript
                workoutSkeletons: {
                    select: {
                        dayIndex: true,
                        order: true,
                        exerciseId: true,
                    },
                    orderBy: [{ dayIndex: 'asc' }, { order: 'asc' }],
                },
```

Then, after the access checks pass (right before `let resolvedProgram = program`), build a `skeleton` view and merge it into the response. Replace `let resolvedProgram = program` with:

```typescript
        const skeleton = (program as any).workoutSkeletons ?? []
        const { workoutSkeletons: _omit, ...rest } = program as any
        let resolvedProgram: any = { ...rest, skeleton }
```

Then update the trainee branch return to preserve `skeleton`. The trainee branch creates `resolvedProgram = { ...program, weeks: resolvedWeeks }` — change it to `resolvedProgram = { ...rest, skeleton, weeks: resolvedWeeks }`.

The full updated GET handler section (replacing lines 44–152) becomes:

```typescript
        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            include: {
                trainer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                trainee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                weeks: {
                    include: {
                        workouts: {
                            include: {
                                workoutExercises: {
                                    include: {
                                        exercise: exerciseSelector as any,
                                    },
                                    orderBy: {
                                        order: 'asc',
                                    },
                                },
                            },
                        },
                    },
                    orderBy: {
                        weekNumber: 'asc',
                    },
                },
                workoutSkeletons: {
                    select: {
                        dayIndex: true,
                        order: true,
                        exerciseId: true,
                    },
                    orderBy: [{ dayIndex: 'asc' }, { order: 'asc' }],
                },
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // RBAC: Check access
        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view your own programs', 403, undefined, 'program.viewDenied')
        }

        if (session.user.role === 'trainee' && program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view programs assigned to you', 403, undefined, 'program.viewAssignedDenied')
        }

        const skeleton = (program as any).workoutSkeletons ?? []
        const { workoutSkeletons: _omit, ...programWithoutSkeletons } = program as any
        let resolvedProgram: any = { ...programWithoutSkeletons, skeleton }

        if (session.user.role === 'trainee') {
            const needsPrMap = program.weeks.some((week) =>
                week.workouts.some((workout) =>
                    workout.workoutExercises.some((we) => we.weightType !== 'absolute')
                )
            )

            const prMap = needsPrMap ? await loadTraineePrMap(session.user.id) : new Map<string, number>()

            const resolvedWeeks = program.weeks.map((week) => ({
                ...week,
                workouts: week.workouts.map((workout) => {
                    const siblings = workout.workoutExercises
                    return {
                        ...workout,
                        workoutExercises: workout.workoutExercises.map((workoutExercise) => {
                            if (typeof workoutExercise.effectiveWeight === 'number') {
                                return workoutExercise
                            }

                            if (workoutExercise.weightType === 'absolute') {
                                return {
                                    ...workoutExercise,
                                    effectiveWeight: workoutExercise.weight,
                                }
                            }

                            try {
                                const effectiveWeight = resolveEffectiveWeight(
                                    workoutExercise,
                                    prMap,
                                    siblings
                                )
                                return { ...workoutExercise, effectiveWeight }
                            } catch (calculationError: unknown) {
                                logger.warn(
                                    {
                                        programId,
                                        workoutExerciseId: workoutExercise.id,
                                        error:
                                            calculationError instanceof Error
                                                ? calculationError.message
                                                : String(calculationError),
                                    },
                                    'Failed to resolve effective weight while fetching program details'
                                )
                                return { ...workoutExercise, effectiveWeight: null }
                            }
                        }),
                    }
                }),
            }))

            resolvedProgram = { ...programWithoutSkeletons, skeleton, weeks: resolvedWeeks }
        }

        return apiSuccess({ program: resolvedProgram })
```

- [ ] **Step 4.5: Run integration tests to verify pass**

```bash
npx vitest run tests/integration/skeleton.test.ts
```

Expected: PASS — 5 tests passing.

- [ ] **Step 4.6: Commit**

```bash
git add src/app/api/programs/\[id\]/skeleton/route.ts src/app/api/programs/\[id\]/route.ts tests/integration/skeleton.test.ts
git commit -m "feat(api): PUT /skeleton bulk replace; include skeleton in GET program"
```

---

## Phase 3 — Server-side flag removal

### Task 5: Remove `isSkeletonExercise` from Zod schema and routes

**Files:**
- Modify: `src/schemas/workout-exercise.ts`
- Modify: `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts`
- Modify: `src/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route.ts`
- Modify: `src/app/api/programs/[id]/copy-week/route.ts`
- Modify: `src/lib/trainee-program-data.ts`

- [ ] **Step 5.1: Remove field from Zod base schema**

In `src/schemas/workout-exercise.ts`, delete line 43:

```typescript
    isSkeletonExercise: z.boolean().default(false),
```

- [ ] **Step 5.2: Drop from `exercises` POST route**

In `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts`:
- Remove `isSkeletonExercise` from the destructured validation result (line 40 area).
- Remove `isSkeletonExercise: isSkeletonExercise || false,` from the create call (line 119).

Use grep to confirm:

```bash
grep -n "isSkeletonExercise" src/app/api/programs/\[id\]/workouts/\[workoutId\]/exercises/route.ts
```

Expected after edit: no matches.

- [ ] **Step 5.3: Drop from bulk route**

In `src/app/api/programs/[id]/workouts/[workoutId]/exercises/bulk/route.ts`, remove line 128:

```typescript
                isSkeletonExercise: row.isSkeletonExercise,
```

- [ ] **Step 5.4: Drop from copy-week route**

In `src/app/api/programs/[id]/copy-week/route.ts`, remove line 217 (`isSkeletonExercise: false,`) inside the `workoutExercises.map(...)` block.

- [ ] **Step 5.5: Drop from trainee-program-data**

In `src/lib/trainee-program-data.ts`:
- Line 37 area (interface field declaration): remove `isSkeletonExercise: boolean`.
- Line 213 area (transform): remove `isSkeletonExercise: we.isSkeletonExercise,`.

- [ ] **Step 5.6: Run type-check**

```bash
npm run type-check
```

Expected: no errors. (Frontend still references the flag — those are removed in Phase 4.)

If type-check surfaces errors in untouched server files, fix by deleting any remaining `isSkeletonExercise` references.

- [ ] **Step 5.7: Commit**

```bash
git add src/schemas/workout-exercise.ts src/app/api/programs src/lib/trainee-program-data.ts
git commit -m "refactor(api): remove isSkeletonExercise from server schema and routes"
```

---

## Phase 4 — Frontend refactor

### Task 6: Update `structure-utils.ts` to source from skeleton

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/structure-utils.ts`
- Modify: `tests/unit/structure-utils.test.ts`

- [ ] **Step 6.1: Update tests**

Replace contents of `tests/unit/structure-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildStructureRowsForWorkout } from '@/app/trainer/programs/[id]/edit/structure-utils'

describe('buildStructureRowsForWorkout', () => {
    it('returns 4 empty rows when skeletonRows is empty', () => {
        const rows = buildStructureRowsForWorkout(0, [])
        expect(rows).toHaveLength(4)
        rows.forEach((row) => {
            expect(row.exerciseId).toBe('')
            expect(row.id).toMatch(/^structure-0-default-\d$/)
        })
    })

    it('returns 4 empty rows for a different workoutIndex', () => {
        const rows = buildStructureRowsForWorkout(2, [])
        expect(rows).toHaveLength(4)
        rows.forEach((row) => {
            expect(row.id).toMatch(/^structure-2-default-\d$/)
        })
    })

    it('maps from skeletonRows when non-empty', () => {
        const skeletonRows = [
            { dayIndex: 1, order: 1, exerciseId: 'ex-1' },
            { dayIndex: 1, order: 2, exerciseId: 'ex-2' },
        ]
        const rows = buildStructureRowsForWorkout(1, skeletonRows)
        expect(rows).toHaveLength(2)
        expect(rows[0]).toEqual({ id: 'structure-1-skeleton-0', exerciseId: 'ex-1' })
        expect(rows[1]).toEqual({ id: 'structure-1-skeleton-1', exerciseId: 'ex-2' })
    })

    it('preserves skeleton row order', () => {
        const skeletonRows = [
            { dayIndex: 0, order: 2, exerciseId: 'ex-2' },
            { dayIndex: 0, order: 1, exerciseId: 'ex-1' },
        ]
        const rows = buildStructureRowsForWorkout(0, skeletonRows)
        expect(rows.map((r) => r.exerciseId)).toEqual(['ex-2', 'ex-1'])
    })

    it('returns unique ids across rows', () => {
        const rows = buildStructureRowsForWorkout(0, [])
        const ids = rows.map((r) => r.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
```

- [ ] **Step 6.2: Run tests to verify failure**

```bash
npx vitest run tests/unit/structure-utils.test.ts
```

Expected: FAIL — current implementation expects `{ exercise: { id }, isSkeletonExercise }` shape; new tests pass `{ dayIndex, order, exerciseId }`.

- [ ] **Step 6.3: Update implementation**

Replace contents of `src/app/trainer/programs/[id]/edit/structure-utils.ts`:

```typescript
export interface WorkoutStructureTemplateRow {
    id: string
    exerciseId: string
}

export interface SkeletonRow {
    dayIndex: number
    order: number
    exerciseId: string
}

const DEFAULT_EXERCISE_ROW_COUNT = 4

export function buildStructureRowsForWorkout(
    workoutIndex: number,
    skeletonRows: SkeletonRow[]
): WorkoutStructureTemplateRow[] {
    if (skeletonRows.length > 0) {
        return skeletonRows.map((row, rowIndex) => ({
            id: `structure-${workoutIndex}-skeleton-${rowIndex}`,
            exerciseId: row.exerciseId,
        }))
    }
    return Array.from({ length: DEFAULT_EXERCISE_ROW_COUNT }, (_, i) => ({
        id: `structure-${workoutIndex}-default-${i}`,
        exerciseId: '',
    }))
}
```

- [ ] **Step 6.4: Run tests to verify pass**

```bash
npx vitest run tests/unit/structure-utils.test.ts
```

Expected: PASS — 5 tests passing.

- [ ] **Step 6.5: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/structure-utils.ts tests/unit/structure-utils.test.ts
git commit -m "refactor(structure-utils): source rows from skeleton instead of WorkoutExercise"
```

---

### Task 7: Drop flag from `transform-utils.ts` and trainee/trainer interfaces

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/transform-utils.ts`
- Modify: `src/app/trainee/programs/_components/ProgramDetailContent.tsx`
- Modify: `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx`

- [ ] **Step 7.1: Drop from transform-utils**

In `src/app/trainer/programs/[id]/edit/transform-utils.ts`, line 36, remove:

```typescript
        isSkeletonExercise: we.isSkeletonExercise,
```

- [ ] **Step 7.2: Drop from `ProgramDetailContent.tsx` interface**

In `src/app/trainee/programs/_components/ProgramDetailContent.tsx`, line 47, remove:

```typescript
    isSkeletonExercise: boolean
```

- [ ] **Step 7.3: Drop from `[wId]/_content.tsx` interface**

In `src/app/trainer/programs/[id]/workouts/[wId]/_content.tsx`, line 54, remove:

```typescript
    isSkeletonExercise: boolean
```

- [ ] **Step 7.4: Verify no stragglers in those files**

```bash
grep -n "isSkeletonExercise" src/app/trainer/programs/\[id\]/edit/transform-utils.ts src/app/trainee/programs/_components/ProgramDetailContent.tsx src/app/trainer/programs/\[id\]/workouts/\[wId\]/_content.tsx
```

Expected: no output.

- [ ] **Step 7.5: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/transform-utils.ts src/app/trainee/programs/_components/ProgramDetailContent.tsx src/app/trainer/programs/\[id\]/workouts/\[wId\]/_content.tsx
git commit -m "refactor(frontend): drop isSkeletonExercise from transform + trainee/workout interfaces"
```

---

### Task 8: Drop flag from `_content.tsx` (edit program)

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

- [ ] **Step 8.1: Find all usages**

```bash
grep -n "isSkeletonExercise" src/app/trainer/programs/\[id\]/edit/_content.tsx
```

Expected matches at lines (approximately):
- 106: interface field
- 174: interface field
- 407: transform mapping
- 1743, 1791: `isSkeletonExercise: false` in row factories
- 1963: `isSkeletonExercise: row.isSkeletonExercise` in save payload
- 2368: `isSkeletonExercise: true` in apply-structure draft creation

- [ ] **Step 8.2: Remove all of them**

For each line above, delete the corresponding line. Specifically:

Line ~106 (interface `WorkoutExercise`): delete `isSkeletonExercise: boolean` line.

Line ~174 (interface `EditableWorkoutExerciseRow`): delete `isSkeletonExercise: boolean` line.

Line ~407 (`transformApiExerciseToRow` or similar mapping): delete the line `isSkeletonExercise: workoutExercise.isSkeletonExercise,`.

Lines ~1743 and ~1791 (draft row factories): delete `isSkeletonExercise: false,` line in each.

Line ~1963 (bulk save mapping): delete `isSkeletonExercise: row.isSkeletonExercise,` line.

Line ~2368 (`applyStructureToAllWeeks` draft creation, inside the `EditableWorkoutExerciseRow` literal): delete `isSkeletonExercise: true,` line.

- [ ] **Step 8.3: Verify removed**

```bash
grep -n "isSkeletonExercise" src/app/trainer/programs/\[id\]/edit/_content.tsx
```

Expected: no output.

- [ ] **Step 8.4: Run type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 8.5: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx
git commit -m "refactor(edit-program): drop all isSkeletonExercise references from edit content"
```

---

### Task 9: Wire skeleton load + save in step 2 (`_content.tsx`)

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

This task makes step 2 read the skeleton from `program.skeleton` (instead of week 1's `workoutExercises`) and call `PUT /api/programs/[id]/skeleton` when transitioning to step 3.

- [ ] **Step 9.1: Add `skeleton` field to `Program` interface**

Find the `interface Program` declaration in `_content.tsx` (search for `interface Program`). After the `weeks: Week[]` field, add:

```typescript
    skeleton: { dayIndex: number; order: number; exerciseId: string }[]
```

- [ ] **Step 9.2: Update structure-rows initializer to source from skeleton**

Locate the `setStructureRowsByWorkoutIndex` initializer block (around lines 915–946 — search for `setStructureRowsByWorkoutIndex((currentStructureRowsByWorkoutIndex)`). Replace its body with skeleton-driven logic:

```typescript
        setStructureRowsByWorkoutIndex((currentStructureRowsByWorkoutIndex) => {
            const skeleton = program.skeleton ?? []
            const skeletonByDayIndex = skeleton.reduce<Record<number, typeof skeleton>>(
                (acc, row) => {
                    const list = acc[row.dayIndex] ?? []
                    list.push(row)
                    acc[row.dayIndex] = list
                    return acc
                },
                {}
            )

            const nextStructureRowsByWorkoutIndex: Record<number, WorkoutStructureTemplateRow[]> = {}
            let hasChanges = false

            for (let workoutIndex = 0; workoutIndex < program.workoutsPerWeek; workoutIndex += 1) {
                const existingRows = currentStructureRowsByWorkoutIndex[workoutIndex]

                if (existingRows) {
                    nextStructureRowsByWorkoutIndex[workoutIndex] = existingRows
                    continue
                }

                hasChanges = true
                nextStructureRowsByWorkoutIndex[workoutIndex] = buildStructureRowsForWorkout(
                    workoutIndex,
                    skeletonByDayIndex[workoutIndex] ?? []
                )
            }

            const currentKeys = Object.keys(currentStructureRowsByWorkoutIndex)
            const nextKeys = Object.keys(nextStructureRowsByWorkoutIndex)

            if (!hasChanges && currentKeys.length === nextKeys.length) {
                return currentStructureRowsByWorkoutIndex
            }

            return nextStructureRowsByWorkoutIndex
        })
```

- [ ] **Step 9.3: Add `saveSkeleton` helper**

In the same component, near the other useCallback helpers (e.g., before `applyStructureToAllWeeks`), add:

```typescript
    const saveSkeleton = useCallback(async (): Promise<boolean> => {
        if (!program || readOnly) {
            return false
        }

        const cleanedRowsByWorkoutIndex: Record<number, WorkoutStructureTemplateRow[]> =
            Object.entries(structureRowsByWorkoutIndex).reduce((acc, [workoutIndex, rows]) => {
                acc[Number(workoutIndex)] = rows
                    .map((row) => ({ ...row, exerciseId: row.exerciseId.trim() }))
                    .filter((row) => row.exerciseId.length > 0)
                return acc
            }, {} as Record<number, WorkoutStructureTemplateRow[]>)

        const payloadRows: { dayIndex: number; order: number; exerciseId: string }[] = []
        Object.entries(cleanedRowsByWorkoutIndex).forEach(([workoutIndex, rows]) => {
            rows.forEach((row, idx) => {
                payloadRows.push({
                    dayIndex: Number(workoutIndex),
                    order: idx + 1,
                    exerciseId: row.exerciseId,
                })
            })
        })

        try {
            const res = await fetch(`/api/programs/${program.id}/skeleton`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: payloadRows }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                showToast(
                    data?.error?.message ?? t('editProgram.skeletonSaveError'),
                    'error'
                )
                return false
            }

            return true
        } catch (err) {
            showToast(t('editProgram.skeletonSaveError'), 'error')
            return false
        }
    }, [program, readOnly, structureRowsByWorkoutIndex, showToast, t])
```

- [ ] **Step 9.4: Call `saveSkeleton` in `applyStructureToAllWeeks`**

In `applyStructureToAllWeeks` (around line 2295), at the very start of the `try` block (before any state mutation), insert:

```typescript
        const saved = await saveSkeleton()
        if (!saved) {
            setApplyingStructure(false)
            return
        }
```

Mark the function `async` (change `useCallback(() => {` to `useCallback(async () => {`). Add `saveSkeleton` to the dependency array.

- [ ] **Step 9.5: Add i18n key for skeleton save error**

In `public/locales/en/trainer.json`, find the `"editProgram"` object and add:

```json
    "skeletonSaveError": "Failed to save program structure. Please try again.",
```

In `public/locales/it/trainer.json`, the `"editProgram"` object, add:

```json
    "skeletonSaveError": "Impossibile salvare la struttura del programma. Riprova.",
```

- [ ] **Step 9.6: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 9.7: Run unit tests**

```bash
npm run test:unit
```

Expected: all pass.

- [ ] **Step 9.8: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx public/locales/en/trainer.json public/locales/it/trainer.json
git commit -m "feat(edit-program): persist skeleton on apply-structure; load step 2 rows from program.skeleton"
```

---

### Task 10: Hydrate step 3 from skeleton when workout has no `WorkoutExercise` rows

**Files:**
- Create: `src/app/trainer/programs/[id]/edit/skeleton-hydration.ts`
- Create: `tests/unit/skeleton-hydration.test.ts`
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

The current `applyStructureToAllWeeks` walks every week's workout and creates draft rows in memory for every empty workout. After this refactor it still does the same, but the source for those draft rows should match the persisted skeleton (so the trainer sees consistent rows even after page refresh into step 3).

- [ ] **Step 10.1: Write failing test for `hydrateDraftRowsForWorkout`**

Create `tests/unit/skeleton-hydration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { hydrateDraftRowsForWorkout } from '@/app/trainer/programs/[id]/edit/skeleton-hydration'

describe('hydrateDraftRowsForWorkout', () => {
    const skeletonForDay = [
        { dayIndex: 0, order: 1, exerciseId: 'ex-1' },
        { dayIndex: 0, order: 2, exerciseId: 'ex-2' },
    ]

    it('returns no rows when workout already has saved exercises', () => {
        const rows = hydrateDraftRowsForWorkout({
            workoutId: 'w-1',
            existingExerciseCount: 3,
            skeletonForDay,
            startingOrder: 1,
        })
        expect(rows).toEqual([])
    })

    it('returns one draft row per skeleton entry when workout is empty', () => {
        const rows = hydrateDraftRowsForWorkout({
            workoutId: 'w-1',
            existingExerciseCount: 0,
            skeletonForDay,
            startingOrder: 1,
        })
        expect(rows).toHaveLength(2)
        expect(rows[0].exerciseId).toBe('ex-1')
        expect(rows[0].order).toBe(1)
        expect(rows[0].isDraft).toBe(true)
        expect(rows[1].exerciseId).toBe('ex-2')
        expect(rows[1].order).toBe(2)
    })

    it('returns empty array when skeletonForDay is empty', () => {
        const rows = hydrateDraftRowsForWorkout({
            workoutId: 'w-1',
            existingExerciseCount: 0,
            skeletonForDay: [],
            startingOrder: 1,
        })
        expect(rows).toEqual([])
    })

    it('respects startingOrder when assigning order to drafts', () => {
        const rows = hydrateDraftRowsForWorkout({
            workoutId: 'w-1',
            existingExerciseCount: 0,
            skeletonForDay,
            startingOrder: 5,
        })
        expect(rows.map((r) => r.order)).toEqual([5, 6])
    })

    it('produces stable unique row ids', () => {
        const rows = hydrateDraftRowsForWorkout({
            workoutId: 'w-1',
            existingExerciseCount: 0,
            skeletonForDay,
            startingOrder: 1,
        })
        const ids = new Set(rows.map((r) => r.id))
        expect(ids.size).toBe(rows.length)
        rows.forEach((r) => expect(r.id).toMatch(/^skeleton-draft-w-1-/))
    })
})
```

- [ ] **Step 10.2: Run to verify failure**

```bash
npx vitest run tests/unit/skeleton-hydration.test.ts
```

Expected: FAIL — `Cannot find module`.

- [ ] **Step 10.3: Implement helper**

Create `src/app/trainer/programs/[id]/edit/skeleton-hydration.ts`:

```typescript
export interface SkeletonRow {
    dayIndex: number
    order: number
    exerciseId: string
}

export interface HydratedDraftRow {
    id: string
    workoutId: string
    exerciseId: string
    order: number
    isDraft: true
    variant: ''
    sets: ''
    reps: ''
    targetRpe: ''
    weight: ''
    isWarmup: false
    restTime: 'm2'
    notes: null
}

export interface HydrateInput {
    workoutId: string
    existingExerciseCount: number
    skeletonForDay: SkeletonRow[]
    startingOrder: number
}

export function hydrateDraftRowsForWorkout({
    workoutId,
    existingExerciseCount,
    skeletonForDay,
    startingOrder,
}: HydrateInput): HydratedDraftRow[] {
    if (existingExerciseCount > 0 || skeletonForDay.length === 0) {
        return []
    }

    return skeletonForDay.map((row, idx) => ({
        id: `skeleton-draft-${workoutId}-${row.order}-${row.exerciseId}`,
        workoutId,
        exerciseId: row.exerciseId,
        order: startingOrder + idx,
        isDraft: true,
        variant: '',
        sets: '',
        reps: '',
        targetRpe: '',
        weight: '',
        isWarmup: false,
        restTime: 'm2',
        notes: null,
    }))
}
```

- [ ] **Step 10.4: Run tests to verify pass**

```bash
npx vitest run tests/unit/skeleton-hydration.test.ts
```

Expected: PASS — 5 tests passing.

- [ ] **Step 10.5: Refactor `applyStructureToAllWeeks` to use the helper**

In `_content.tsx`, find `applyStructureToAllWeeks` (around line 2295). Replace the inner `program.weeks.forEach(...)` block with hydration via the helper. The whole function body becomes:

```typescript
    const applyStructureToAllWeeks = useCallback(async () => {
        if (!program || readOnly) {
            return
        }

        const cleanedStructureByWorkoutIndex: Record<number, WorkoutStructureTemplateRow[]> =
            Object.entries(structureRowsByWorkoutIndex).reduce((acc, [workoutIndex, rows]) => {
                const normalizedRows = rows
                    .map((row) => ({
                        ...row,
                        exerciseId: row.exerciseId.trim(),
                    }))
                    .filter((row) => row.exerciseId.length > 0)

                acc[Number(workoutIndex)] = normalizedRows
                return acc
            }, {} as Record<number, WorkoutStructureTemplateRow[]>)

        const configuredRows = Object.values(cleanedStructureByWorkoutIndex).reduce(
            (total, rows) => total + rows.length,
            0
        )

        if (configuredRows === 0) {
            showToast(t('editProgram.structureNoExercisesWarning'), 'warning')
            return
        }

        setApplyingStructure(true)

        try {
            const saved = await saveSkeleton()
            if (!saved) {
                return
            }

            const skeletonForHydration: SkeletonRow[] = []
            Object.entries(cleanedStructureByWorkoutIndex).forEach(([workoutIndex, rows]) => {
                rows.forEach((row, idx) => {
                    skeletonForHydration.push({
                        dayIndex: Number(workoutIndex),
                        order: idx + 1,
                        exerciseId: row.exerciseId,
                    })
                })
            })

            const skeletonByDayIndex = skeletonForHydration.reduce<Record<number, SkeletonRow[]>>(
                (acc, row) => {
                    const list = acc[row.dayIndex] ?? []
                    list.push(row)
                    acc[row.dayIndex] = list
                    return acc
                },
                {}
            )

            const nextRowsById = { ...rowStateById }
            const nextDraftRowsByWorkout = { ...draftRowIdsByWorkout }

            program.weeks.forEach((week) => {
                week.workouts.forEach((workout, workoutIndex) => {
                    const existingRows = getWorkoutRows(workout)
                    const drafts = hydrateDraftRowsForWorkout({
                        workoutId: workout.id,
                        existingExerciseCount: existingRows.length,
                        skeletonForDay: skeletonByDayIndex[workoutIndex] ?? [],
                        startingOrder: existingRows.length + 1,
                    })

                    drafts.forEach((draft) => {
                        nextRowsById[draft.id] = draft as unknown as EditableWorkoutExerciseRow
                        nextDraftRowsByWorkout[workout.id] = [
                            ...(nextDraftRowsByWorkout[workout.id] || []),
                            draft.id,
                        ]
                    })
                })
            })

            setRowStateById(nextRowsById)
            setDraftRowIdsByWorkout(nextDraftRowsByWorkout)
            setExpandedWeekIds(
                Object.fromEntries(program.weeks.map((week) => [week.id, true] as const))
            )
            setExpandedWorkoutIds(
                Object.fromEntries(
                    program.weeks.flatMap((week) =>
                        week.workouts.map((workout) => [workout.id, true] as const)
                    )
                )
            )
            setWizardStep('details')
            showToast(t('editProgram.structureAppliedSuccess'), 'success')
        } finally {
            setApplyingStructure(false)
        }
    }, [
        draftRowIdsByWorkout,
        getWorkoutRows,
        program,
        readOnly,
        rowStateById,
        saveSkeleton,
        showToast,
        structureRowsByWorkoutIndex,
        t,
    ])
```

Add the import at the top of `_content.tsx`:

```typescript
import { hydrateDraftRowsForWorkout, type SkeletonRow } from './skeleton-hydration'
```

- [ ] **Step 10.6: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 10.7: Run all unit tests**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 10.8: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/skeleton-hydration.ts src/app/trainer/programs/\[id\]/edit/_content.tsx tests/unit/skeleton-hydration.test.ts
git commit -m "feat(edit-program): hydrate step 3 draft rows from skeleton via shared helper"
```

---

## Phase 5 — Test fixture sweep & closeout

### Task 11: Update tests that reference the dropped flag

**Files:**
- Modify: `tests/unit/calculations.test.ts`
- Modify: `tests/integration/program-detail.test.ts`

- [ ] **Step 11.1: Drop flag from calculations test helper**

In `tests/unit/calculations.test.ts`:

Line ~16 (`Omit` declaration): remove `'isSkeletonExercise' | ` token from the union.

Line ~23 (helper input optional field): remove `isSkeletonExercise?: boolean` line.

Line ~43 (helper return shape): remove `isSkeletonExercise: exercise.isSkeletonExercise ?? false,` line.

- [ ] **Step 11.2: Drop flag from program-detail integration fixture**

In `tests/integration/program-detail.test.ts`, line ~46 (test fixture object): remove `isSkeletonExercise: false,` line.

- [ ] **Step 11.3: Search for any remaining references**

```bash
grep -rn "isSkeletonExercise" src/ tests/ prisma/schema.prisma
```

Expected: no output.

- [ ] **Step 11.4: Run type-check + full test suite**

```bash
npm run type-check && npm run test:unit
```

Expected: type-check clean; all unit tests pass.

- [ ] **Step 11.5: Commit**

```bash
git add tests/unit/calculations.test.ts tests/integration/program-detail.test.ts
git commit -m "test: drop isSkeletonExercise from test fixtures and helpers"
```

---

### Task 12: Manual smoke test (UI)

**Files:**
- (no code changes)

- [ ] **Step 12.1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 12.2: Smoke flow — new program**

In a browser:
1. Log in as a trainer.
2. Navigate to `/trainer/programs/new` and create a new draft program (2 weeks, 2 workouts/week).
3. On the redirect to step 2 (structure), confirm 4 default empty rows per workout column.
4. Pick exercises in two rows of workout 1 and one row of workout 2.
5. Drag-and-drop one row to reorder.
6. Click "Apply structure" — verify navigation to step 3.
7. Verify each week's workouts show draft rows matching the picked exercises (skeleton hydration).
8. In the Network tab, confirm `PUT /api/programs/{id}/skeleton` was called with the right payload.

- [ ] **Step 12.3: Smoke flow — refresh persistence**

1. Refresh the page (return to step 3 because hydrated drafts unsaved? note: refresh shows the draft as gone unless saved). Then click "back to structure" (or navigate via wizard step indicator).
2. Verify step 2 shows the saved skeleton rows (not 4 default empty rows).

- [ ] **Step 12.4: Smoke flow — save week 1 then re-edit skeleton**

1. In step 3, fill week 1 workout 1 with all required fields, click save.
2. Navigate back to step 2, change one skeleton row's exercise.
3. Click "Apply structure" → step 3.
4. Confirm week 1 workout 1's saved row is unchanged. Confirm other workouts hydrate from new skeleton.

- [ ] **Step 12.5: Smoke flow — published program**

1. Publish the program.
2. Re-open the program edit page.
3. Confirm the wizard skips to step 3 (read-only) and step 2 is not editable.
4. Try `PUT /api/programs/{id}/skeleton` via DevTools — should return 403.

If any smoke test fails, fix the issue, add a regression test, then commit. Otherwise no commit needed for this task.

---

### Task 13: CHANGELOG entry

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 13.1: Prepend entry**

Open `implementation-docs/CHANGELOG.md` and prepend under the latest "Unreleased" header (create one if missing):

```markdown
## [Unreleased]

### Changed
- Refactored skeleton (wizard step 2) data model: introduced `WorkoutSkeleton` table; dropped `WorkoutExercise.isSkeletonExercise` flag. Step 2 work now persists across refresh; step 3 hydrates draft rows from the persisted skeleton when a workout has no saved exercises.

### Added
- `PUT /api/programs/[id]/skeleton` endpoint to bulk-replace a draft program's skeleton (403 on non-draft).
- `program.skeleton` array included in `GET /api/programs/[id]` responses.
```

- [ ] **Step 13.2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs(changelog): skeleton data model refactor (TRN-011)"
```

---

### Task 14: Close out TRN-011

**Files:**
- Modify: `implementation-docs/to-do-list-from-team.md`

- [ ] **Step 14.1: Mark TRN-011 done**

In `implementation-docs/to-do-list-from-team.md`, change:

```markdown
- [ ] [TRN-011] Rivedere data model per skeleton
```

to:

```markdown
- [x] [TRN-011] Rivedere data model per skeleton
```

- [ ] **Step 14.2: Commit**

```bash
git add implementation-docs/to-do-list-from-team.md
git commit -m "chore(todo): mark TRN-011 done"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|--------------|------|
| New `WorkoutSkeleton` model + relations | Task 1 |
| Drop `isSkeletonExercise` column | Tasks 1, 2 |
| Per program day-index scope | Tasks 1, 4 (validation) |
| `PUT /api/programs/[id]/skeleton` (draft-only) | Task 4 |
| GET program includes skeleton | Task 4 |
| Step 2: load + save skeleton | Task 9 |
| Step 3: hydrate from skeleton | Task 10 |
| Mid-draft skeleton edit affects only unsaved workouts | Task 10 (hydration skips workouts with `existingExerciseCount > 0`) |
| Read-only after publish (UI + API) | Task 4 (API guard); Task 12 (UI smoke) |
| No data migration | Task 2 (just drops column) |
| Unit + integration + E2E coverage | Tasks 3, 4, 6, 10, 12 |

**Placeholder scan:** none. All steps have exact file paths, code blocks, and commands.

**Type consistency:**
- `SkeletonRow` shape `{ dayIndex, order, exerciseId }` consistent across `skeleton-hydration.ts`, `structure-utils.ts` (separate but compatible), Zod schema, API payload, and GET response.
- `buildStructureRowsForWorkout` signature matches new test in Task 6 and call site in Task 9.
- `hydrateDraftRowsForWorkout` input shape consistent across Task 10 test and call site.
- `EditableWorkoutExerciseRow` cast in Task 10 noted as `as unknown as` — the hydrated draft fields are a strict subset of `EditableWorkoutExerciseRow`, so the cast is sound; the explicit `as unknown` documents the intentional narrowing.

**Edge cases:**
- Empty skeleton (new program) → 4 default empty rows preserved (Task 6).
- Existing draft with sparse `WorkoutExercise` rows → step 3 shows them as-is; step 2 starts empty until trainer applies (Task 12 smoke).
- Cascade delete → integration test (Task 4).
- Out-of-range `dayIndex` → server validation (Task 4).
- Non-existent `exerciseId` → 404 (Task 4).
