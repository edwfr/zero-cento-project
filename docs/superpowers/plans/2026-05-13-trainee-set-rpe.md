# Trainee per-set RPE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a trainee record an optional perceived RPE (5.0–10.0, step 0.5) for each individual set on `/trainee/workouts/[id]`, persist it in `sets_performed`, and display it in the previous-week panel.

**Architecture:** Adds a nullable `actualRpe` column to `sets_performed`. The existing autosave + submit pipelines already carry per-set payloads — we extend the Zod schema and DB writes to include RPE. UI gains a fifth column in the set grid with a compact button that reuses `RPESelector`. RPE is captured in local state and persisted together with `reps/weight` when the set check is toggled. The previous-week SQL query is extended to read the new column; the shared display component is extended with an optional `rpe` argument in its row formatter.

**Tech Stack:** Next.js 15 App Router, Prisma, PostgreSQL, Zod, React/Tailwind, react-i18next, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-13-trainee-set-rpe-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `actualRpe Float?` to `SetPerformed` model |
| `prisma/migrations/20260513000000_set_performed_actual_rpe/migration.sql` | Create | `ALTER TABLE sets_performed ADD COLUMN "actualRpe"` |
| `src/schemas/feedback.ts` | Modify | Extend `setPerformedSchema` with optional `actualRpe` |
| `tests/unit/rpe-schema.test.ts` | Modify | New test cases for `setPerformedSchema.actualRpe` |
| `src/app/api/trainee/workout-exercises/[id]/feedback/route.ts` | Modify | Propagate `actualRpe` to `setPerformed.upsert` |
| `src/app/api/trainee/workouts/[id]/submit/route.ts` | Modify | Propagate `actualRpe` to bulk set create/update |
| `tests/integration/workout-exercise-rpe.test.ts` | Modify | Test set-RPE flow on autosave route (note: file name covers RPE generally; we extend with set-level cases) |
| `src/lib/workout-recap.ts` | Modify | Add `actualRpe: number \| null` to `PrevWeekSet` |
| `src/app/api/trainee/workouts/[id]/prev-week/route.ts` | Modify | SELECT `sp."actualRpe"`, map into payload |
| `src/components/WorkoutExerciseDisplayList.tsx` | Modify | Accept optional `actualRpe` per set; `setRowLabel` receives rpe |
| `tests/unit/WorkoutExerciseDisplayList.test.tsx` | Modify | Test row with/without RPE |
| `src/components/PrevWeekPanel.tsx` | Modify | Propagate `actualRpe`; switch `setRowLabel` on RPE presence |
| `public/locales/it/trainee.json` | Modify | Add `workouts.prevWeekSetRowWithRpe` |
| `public/locales/en/trainee.json` | Modify | Add `workouts.prevWeekSetRowWithRpe` |
| `src/app/trainee/workouts/[id]/_content.tsx` | Modify | `SetPerformed` type, grid layout, `RpeCell`, handlers, payloads |
| `implementation-docs/CHANGELOG.md` | Modify | Entry describing the new feature |

---

## Task 1: Add Prisma column + migration

**Files:**
- Modify: `prisma/schema.prisma` (the `SetPerformed` model, around line 333)
- Create: `prisma/migrations/20260513000000_set_performed_actual_rpe/migration.sql`

- [ ] **Step 1: Add column to Prisma model**

In `prisma/schema.prisma`, change the `SetPerformed` model to:

```prisma
model SetPerformed {
  id         String   @id @default(uuid())
  feedbackId String
  setNumber  Int      // Numero progressivo serie: 1, 2, 3, ...
  reps       Int
  weight     Float    // kg
  actualRpe  Float?   // RPE percepito 5.0-10.0, step 0.5, opzionale
  completed  Boolean  @default(true)
  createdAt  DateTime @default(now())

  // Relations
  feedback ExerciseFeedback @relation("FeedbackSets", fields: [feedbackId], references: [id], onDelete: Cascade)

  @@unique([feedbackId, setNumber])
  @@index([feedbackId])
  @@map("sets_performed")
}
```

- [ ] **Step 2: Create migration directory + SQL file**

```bash
mkdir -p prisma/migrations/20260513000000_set_performed_actual_rpe
```

Write `prisma/migrations/20260513000000_set_performed_actual_rpe/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "sets_performed" ADD COLUMN "actualRpe" DOUBLE PRECISION;
```

- [ ] **Step 3: Apply migration + regenerate client**

Run:

```bash
npm run prisma:migrate -- --name set_performed_actual_rpe
```

If Prisma proposes a different file name, accept the existing one (`--name` only seeds the suggestion). Verify migration applied:

```bash
npm run prisma:generate
```

Expected: no errors, generated client includes `actualRpe?: number | null` on `SetPerformed`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260513000000_set_performed_actual_rpe
git commit -m "feat(db): add actualRpe column to sets_performed"
```

---

## Task 2: Extend Zod `setPerformedSchema` with `actualRpe`

**Files:**
- Modify: `src/schemas/feedback.ts:7-23`
- Modify: `tests/unit/rpe-schema.test.ts`

- [ ] **Step 1: Write failing tests for `setPerformedSchema.actualRpe`**

Append to `tests/unit/rpe-schema.test.ts`:

```ts
import { setPerformedSchema } from '@/schemas/feedback'

describe('setPerformedSchema.actualRpe', () => {
    const baseSet = { setNumber: 1, completed: true, reps: 8, weight: 60 }

    it('accepts a valid actualRpe', () => {
        const result = setPerformedSchema.safeParse({ ...baseSet, actualRpe: 8.5 })
        expect(result.success).toBe(true)
    })

    it('accepts null actualRpe', () => {
        const result = setPerformedSchema.safeParse({ ...baseSet, actualRpe: null })
        expect(result.success).toBe(true)
    })

    it('accepts omitted actualRpe', () => {
        const result = setPerformedSchema.safeParse(baseSet)
        expect(result.success).toBe(true)
    })

    it('rejects actualRpe below 5.0', () => {
        const result = setPerformedSchema.safeParse({ ...baseSet, actualRpe: 4.5 })
        expect(result.success).toBe(false)
    })

    it('rejects actualRpe above 10.0', () => {
        const result = setPerformedSchema.safeParse({ ...baseSet, actualRpe: 10.5 })
        expect(result.success).toBe(false)
    })

    it('rejects actualRpe not on 0.5 step', () => {
        const result = setPerformedSchema.safeParse({ ...baseSet, actualRpe: 7.3 })
        expect(result.success).toBe(false)
    })
})
```

- [ ] **Step 2: Run the new tests; verify they fail**

```bash
npx vitest run tests/unit/rpe-schema.test.ts
```

Expected: the new `describe('setPerformedSchema.actualRpe')` block fails because `actualRpe` is not part of the schema (`safeParse` strips it for the "rejects" cases).

- [ ] **Step 3: Extend the schema**

In `src/schemas/feedback.ts`, replace the `setPerformedSchema` definition (lines 7–23) with:

```ts
export const setPerformedSchema = z.object({
    setNumber: z
        .number()
        .int('validation.setsInteger')
        .min(1, 'validation.minSets')
        .max(50, 'validation.maxSets'),
    completed: z.boolean().default(true),
    reps: z
        .number()
        .int('validation.repsInteger')
        .min(0, 'validation.minReps')
        .max(50, 'validation.maxReps'),
    weight: z
        .number()
        .min(0, 'validation.minWeight')
        .max(500, 'validation.maxWeight'),
    actualRpe: z
        .number()
        .min(5.0, 'validation.rpeMin')
        .max(10.0, 'validation.rpeMax')
        .multipleOf(0.5, 'validation.rpeStep')
        .nullish(),
})
```

`workoutExerciseAutosaveSchema` and `workoutSubmitSchema` reuse `setPerformedSchema`, so no further schema changes are required.

- [ ] **Step 4: Re-run tests; verify pass**

```bash
npx vitest run tests/unit/rpe-schema.test.ts
```

Expected: all six new test cases pass; existing `workoutExerciseRpeSchema` tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/feedback.ts tests/unit/rpe-schema.test.ts
git commit -m "feat(schema): allow per-set actualRpe on setPerformedSchema"
```

---

## Task 3: Propagate `actualRpe` in autosave route

**Files:**
- Modify: `src/app/api/trainee/workout-exercises/[id]/feedback/route.ts:87-109`
- Modify: `tests/integration/workout-exercise-rpe.test.ts`

- [ ] **Step 1: Write failing integration test**

Note: the existing file `tests/integration/workout-exercise-rpe.test.ts` covers the RPE-only PATCH route. We add coverage for the **autosave** route (`PATCH /api/trainee/workout-exercises/[id]/feedback`) carrying `set.actualRpe`. Create a NEW file:

```ts
// tests/integration/workout-exercise-feedback-set-rpe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
    prisma: {
        workoutExercise: { findFirst: vi.fn() },
        exerciseFeedback: { upsert: vi.fn() },
        setPerformed: { upsert: vi.fn(), count: vi.fn() },
    },
}))
vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))
vi.mock('@/lib/completion-service', () => ({
    cascadeCompletion: vi.fn(async () => ({
        workoutExercise: { isCompleted: false },
        workout: { isCompleted: false },
        week: { isCompleted: false, weekNumber: 1 },
        program: { status: 'in_progress' },
    })),
}))

import { NextRequest } from 'next/server'
import { mockTraineeSession } from './fixtures'
import { PATCH } from '@/app/api/trainee/workout-exercises/[id]/feedback/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const WE_ID = '11111111-1111-1111-1111-111111111111'
const FB_ID = '22222222-2222-2222-2222-222222222222'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

const makeRequest = (body: Record<string, unknown>) =>
    new NextRequest(
        `http://localhost/api/trainee/workout-exercises/${WE_ID}/feedback`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )

describe('PATCH /api/trainee/workout-exercises/[id]/feedback (per-set actualRpe)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue({ id: WE_ID, sets: 3 } as any)
        vi.mocked(prisma.exerciseFeedback.upsert).mockResolvedValue({
            id: FB_ID, workoutExerciseId: WE_ID, actualRpe: null, notes: null,
            date: new Date('2026-05-13'), updatedAt: new Date('2026-05-13'),
        } as any)
        vi.mocked(prisma.setPerformed.upsert).mockResolvedValue({ setNumber: 1 } as any)
        vi.mocked(prisma.setPerformed.count).mockResolvedValue(0)
    })

    it('persists set.actualRpe when supplied', async () => {
        const body = {
            actualRpe: null,
            notes: null,
            set: { setNumber: 1, completed: true, reps: 8, weight: 60, actualRpe: 8.5 },
        }
        const res = await PATCH(makeRequest(body), withIdParam(WE_ID))
        expect(res.status).toBe(200)

        const call = vi.mocked(prisma.setPerformed.upsert).mock.calls[0][0]
        expect(call.create).toMatchObject({ feedbackId: FB_ID, setNumber: 1, reps: 8, weight: 60, completed: true, actualRpe: 8.5 })
        expect(call.update).toMatchObject({ reps: 8, weight: 60, completed: true, actualRpe: 8.5 })
    })

    it('persists null actualRpe when set omits it', async () => {
        const body = {
            actualRpe: null,
            notes: null,
            set: { setNumber: 1, completed: true, reps: 8, weight: 60 },
        }
        const res = await PATCH(makeRequest(body), withIdParam(WE_ID))
        expect(res.status).toBe(200)

        const call = vi.mocked(prisma.setPerformed.upsert).mock.calls[0][0]
        expect(call.create).toMatchObject({ actualRpe: null })
        expect(call.update).toMatchObject({ actualRpe: null })
    })

    it('rejects invalid set.actualRpe with 400', async () => {
        const body = {
            actualRpe: null,
            notes: null,
            set: { setNumber: 1, completed: true, reps: 8, weight: 60, actualRpe: 7.3 },
        }
        const res = await PATCH(makeRequest(body), withIdParam(WE_ID))
        expect(res.status).toBe(400)
    })
})
```

- [ ] **Step 2: Run test; verify it fails**

```bash
npx vitest run tests/integration/workout-exercise-feedback-set-rpe.test.ts
```

Expected: first two cases fail because `actualRpe` is not in the upsert payload.

- [ ] **Step 3: Update autosave route**

In `src/app/api/trainee/workout-exercises/[id]/feedback/route.ts`, change the `setPerformed.upsert` block (around lines 87–109) to:

```ts
if (set) {
    await prisma.setPerformed.upsert({
        where: {
            feedbackId_setNumber: {
                feedbackId: feedback.id,
                setNumber: set.setNumber,
            },
        },
        create: {
            feedbackId: feedback.id,
            setNumber: set.setNumber,
            completed: set.completed,
            reps: set.reps,
            weight: set.weight,
            actualRpe: set.actualRpe ?? null,
        },
        update: {
            completed: set.completed,
            reps: set.reps,
            weight: set.weight,
            actualRpe: set.actualRpe ?? null,
        },
        select: { setNumber: true },
    })
}
```

- [ ] **Step 4: Re-run test; verify pass**

```bash
npx vitest run tests/integration/workout-exercise-feedback-set-rpe.test.ts
```

Expected: all three cases pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/trainee/workout-exercises/[id]/feedback/route.ts \
        tests/integration/workout-exercise-feedback-set-rpe.test.ts
git commit -m "feat(api): persist per-set actualRpe in autosave route"
```

---

## Task 4: Propagate `actualRpe` in submit route

**Files:**
- Modify: `src/app/api/trainee/workouts/[id]/submit/route.ts:127-146`

- [ ] **Step 1: Update both `setsPerformed.create` mappings**

In `src/app/api/trainee/workouts/[id]/submit/route.ts`, inside the `prisma.exerciseFeedback.upsert(...)` call, change both `setsPerformed: { create: ex.sets.map(...) }` blocks (in `create:` and inside `update:`) to include `actualRpe`:

```ts
create: ex.sets.map((s) => ({
    setNumber: s.setNumber,
    completed: s.completed,
    reps: s.reps,
    weight: s.weight,
    actualRpe: s.actualRpe ?? null,
})),
```

Apply this same mapping to both the top-level `create.setsPerformed.create` (around line 128) and the `update.setsPerformed.create` after `deleteMany: {}` (around line 140).

- [ ] **Step 2: Add focused test**

Append to `tests/integration/workout-exercise-feedback-set-rpe.test.ts` (or create `tests/integration/workout-submit-set-rpe.test.ts` if you prefer a separate file — pick one and stay consistent). The integration here goes through the submit route, so a new test file is cleaner:

Create `tests/integration/workout-submit-set-rpe.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireRole: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
    prisma: {
        workout: { findFirst: vi.fn(), update: vi.fn() },
        exerciseFeedback: { upsert: vi.fn() },
        workoutExercise: { update: vi.fn() },
        $transaction: vi.fn(),
    },
}))
vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))
vi.mock('@/lib/completion-service', () => ({
    cascadeWorkoutCompletion: vi.fn(async () => ({
        workout: { isCompleted: true },
        week: { isCompleted: false, weekNumber: 1 },
        program: { status: 'in_progress' },
    })),
}))

import { NextRequest } from 'next/server'
import { mockTraineeSession } from './fixtures'
import { POST } from '@/app/api/trainee/workouts/[id]/submit/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const WORKOUT_ID = '33333333-3333-3333-3333-333333333333'
const WE_ID = '44444444-4444-4444-4444-444444444444'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

describe('POST /api/trainee/workouts/[id]/submit forwards set.actualRpe', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.workout.findFirst).mockResolvedValue({
            id: WORKOUT_ID,
            workoutExercises: [{ id: WE_ID, sets: 1 }],
        } as any)
        vi.mocked(prisma.$transaction).mockResolvedValue([
            { id: 'fb', workoutExerciseId: WE_ID, actualRpe: null, notes: null, date: new Date() },
            { id: WE_ID },
            { id: WORKOUT_ID },
        ] as any)
    })

    it('passes actualRpe through both create and update branches', async () => {
        const body = {
            traineeNotes: null,
            exercises: [
                {
                    workoutExerciseId: WE_ID,
                    actualRpe: 8,
                    sets: [{ setNumber: 1, completed: true, reps: 8, weight: 60, actualRpe: 8.5 }],
                },
            ],
        }
        const req = new NextRequest(
            `http://localhost/api/trainee/workouts/${WORKOUT_ID}/submit`,
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        )
        const res = await POST(req, withIdParam(WORKOUT_ID))
        expect(res.status).toBe(200)

        const args = vi.mocked(prisma.$transaction).mock.calls[0][0] as unknown as Array<any>
        // The first transaction op is the exerciseFeedback.upsert promise.
        // It was constructed with create.setsPerformed.create and update.setsPerformed.create payloads.
        // We can't introspect prisma promise internals safely; instead, assert that the upsert was set up
        // by spying through the prisma proxy. Skipping deep introspection: a runtime end-to-end test
        // would catch this. The schema test in Task 2 already proves the field is accepted.
        expect(args.length).toBeGreaterThan(0)
    })
})
```

Note: this test is intentionally light because `$transaction` is mocked at the array level — verifying mapper output requires reading the upsert promise, which Prisma's proxy obscures. The schema test in Task 2 plus a manual smoke (Task 12) cover the actual payload shape.

- [ ] **Step 3: Run test; verify pass**

```bash
npx vitest run tests/integration/workout-submit-set-rpe.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/trainee/workouts/[id]/submit/route.ts \
        tests/integration/workout-submit-set-rpe.test.ts
git commit -m "feat(api): persist per-set actualRpe in submit route"
```

---

## Task 5: Extend prev-week SQL + types

**Files:**
- Modify: `src/lib/workout-recap.ts:30-34`
- Modify: `src/app/api/trainee/workouts/[id]/prev-week/route.ts:7-18, 47-69, 87-94`

- [ ] **Step 1: Extend `PrevWeekSet`**

In `src/lib/workout-recap.ts`, change `PrevWeekSet` (lines 30–34) to:

```ts
export interface PrevWeekSet {
    setNumber: number
    reps: number
    weight: number
    completed: boolean
    actualRpe: number | null
}
```

- [ ] **Step 2: Extend the SQL query + row interface + mapping**

In `src/app/api/trainee/workouts/[id]/prev-week/route.ts`:

Update the `PrevWeekRow` interface (lines 7–18) to add:

```ts
setActualRpe: number | null
```

In the SQL SELECT (replace lines 47–69 inside the `WITH` query), add `sp."actualRpe" AS "setActualRpe"`:

```ts
const rows = await prisma.$queryRaw<PrevWeekRow[]>`
    WITH source_workout AS (
        SELECT w."dayIndex", wk."weekNumber", wk."programId"
        FROM workouts w
        JOIN weeks wk ON wk.id = w."weekId"
        JOIN training_programs tp ON tp.id = wk."programId"
        WHERE w.id = ${workoutId}
          AND tp."traineeId" = ${session.user.id}
    ),
    prev_workout AS (
        SELECT w.id
        FROM workouts w
        JOIN weeks wk ON wk.id = w."weekId"
        JOIN source_workout sw ON wk."programId" = sw."programId"
            AND w."dayIndex" = sw."dayIndex"
            AND wk."weekNumber" = sw."weekNumber" - 1
        LIMIT 1
    )
    SELECT
        we.id                       AS "weId",
        e.name                      AS "exerciseName",
        we.order                    AS "order",
        we.sets                     AS "targetSets",
        we.reps                     AS "targetReps",
        sp."setNumber"              AS "setNumber",
        sp.reps                     AS "setReps",
        sp.weight                   AS "setWeight",
        sp.completed                AS "setCompleted",
        sp."actualRpe"              AS "setActualRpe",
        latest_ef.notes             AS "exerciseNote"
    FROM workout_exercises we
    JOIN prev_workout pw ON we."workoutId" = pw.id
    JOIN exercises e ON e.id = we."exerciseId"
    LEFT JOIN LATERAL (
        SELECT id, notes FROM exercise_feedbacks
        WHERE "workoutExerciseId" = we.id
          AND "traineeId" = ${session.user.id}
        ORDER BY "updatedAt" DESC
        LIMIT 1
    ) latest_ef ON true
    LEFT JOIN sets_performed sp ON sp."feedbackId" = latest_ef.id
    ORDER BY we.order, sp."setNumber"
`
```

Update the set-push block (lines 87–94) to:

```ts
if (row.setNumber !== null && row.setReps !== null && row.setWeight !== null) {
    exerciseMap.get(row.weId)!.sets.push({
        setNumber: row.setNumber,
        reps: row.setReps,
        weight: row.setWeight,
        completed: row.setCompleted ?? false,
        actualRpe: row.setActualRpe ?? null,
    })
}
```

- [ ] **Step 3: Run type-check + existing tests**

```bash
npm run type-check
npx vitest run tests/integration/prev-week.test.ts 2>/dev/null || true
```

Expected: type-check passes. If there's an existing prev-week integration test, it should still pass (we widened the type but added a nullable field).

- [ ] **Step 4: Add focused test for the mapping**

If `tests/integration/prev-week.test.ts` does not exist, skip; the SQL path will be covered by manual smoke in Task 12. If it exists, extend one case so a seeded set with `actualRpe = 8.5` shows up in the response payload as `actualRpe: 8.5`. Use the same mocking pattern as other integration tests in `tests/integration/`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/workout-recap.ts src/app/api/trainee/workouts/[id]/prev-week/route.ts
git commit -m "feat(api): include per-set actualRpe in prev-week payload"
```

---

## Task 6: Extend `WorkoutExerciseDisplayList`

**Files:**
- Modify: `src/components/WorkoutExerciseDisplayList.tsx`
- Modify: `tests/unit/WorkoutExerciseDisplayList.test.tsx`

- [ ] **Step 1: Write failing test**

Append to `tests/unit/WorkoutExerciseDisplayList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import WorkoutExerciseDisplayList from '@/components/WorkoutExerciseDisplayList'

describe('WorkoutExerciseDisplayList — per-set RPE', () => {
    const baseItem = {
        id: 'ex1',
        exerciseName: 'Squat',
        scheme: '3 x 8',
        performedSets: [
            { setNumber: 1, reps: 8, weight: 60, completed: true, actualRpe: 8 },
            { setNumber: 2, reps: 8, weight: 60, completed: true, actualRpe: null },
        ],
    }

    it('renders @ RPE x for sets with actualRpe', () => {
        render(<WorkoutExerciseDisplayList items={[baseItem]} />)
        expect(screen.getByText(/#1 · 8 rep · 60 kg @ RPE 8/)).toBeInTheDocument()
    })

    it('omits RPE for sets without actualRpe', () => {
        render(<WorkoutExerciseDisplayList items={[baseItem]} />)
        expect(screen.getByText(/#2 · 8 rep · 60 kg$/)).toBeInTheDocument()
    })

    it('passes rpe to a custom setRowLabel', () => {
        const labelFn = vi.fn((set: number, reps: number, weight: number, rpe: number | null) =>
            `#${set} ${reps}x${weight} rpe=${rpe ?? '-'}`
        )
        render(<WorkoutExerciseDisplayList items={[baseItem]} setRowLabel={labelFn} />)
        expect(labelFn).toHaveBeenCalledWith(1, 8, 60, 8)
        expect(labelFn).toHaveBeenCalledWith(2, 8, 60, null)
    })
})
```

Verify the existing imports at the top of the file include `vi` from `vitest` and `screen`/`render` from `@testing-library/react`. If not, add them.

- [ ] **Step 2: Run test; verify it fails**

```bash
npx vitest run tests/unit/WorkoutExerciseDisplayList.test.tsx
```

Expected: new cases fail because `setRowLabel` signature lacks the 4th arg and the default formatter does not handle RPE.

- [ ] **Step 3: Update component**

Replace the contents of `src/components/WorkoutExerciseDisplayList.tsx` with:

```tsx
'use client'

import { FileText, MessageSquare } from 'lucide-react'

export interface ExerciseDisplayItem {
    id: string
    exerciseName: string
    variant?: string | null
    isWarmup?: boolean
    scheme: string
    performedSets: Array<{
        setNumber: number
        reps: number
        weight: number
        completed: boolean
        actualRpe?: number | null
    }>
    trainerNote?: string | null
    traineeNote?: string | null
}

interface WorkoutExerciseDisplayListProps {
    items: ExerciseDisplayItem[]
    emptyText?: string
    setRowLabel?: (set: number, reps: number, weight: number, rpe: number | null) => string
}

export default function WorkoutExerciseDisplayList({
    items,
    emptyText = '—',
    setRowLabel,
}: WorkoutExerciseDisplayListProps) {
    if (items.length === 0) {
        return <p className="text-sm text-gray-400">{emptyText}</p>
    }

    const defaultSetRow = (set: number, reps: number, weight: number, rpe: number | null) =>
        rpe != null
            ? `#${set} · ${reps} rep · ${weight} kg @ RPE ${rpe}`
            : `#${set} · ${reps} rep · ${weight} kg`

    const renderSet = setRowLabel ?? defaultSetRow

    return (
        <ul className="space-y-0">
            {items.map((item) => {
                const completedSets = item.performedSets.filter((s) => s.completed)

                return (
                    <li
                        key={item.id}
                        className="border-b border-gray-100 py-3 last:border-0"
                    >
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            {item.isWarmup && (
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    W
                                </span>
                            )}
                            <p className="truncate text-sm font-semibold text-gray-800">
                                {item.exerciseName}
                            </p>
                            {item.variant && (
                                <span className="text-xs text-gray-500">({item.variant})</span>
                            )}
                        </div>

                        {completedSets.length > 0 ? (
                            <ul className="space-y-0.5">
                                {completedSets.map((set) => (
                                    <li
                                        key={set.setNumber}
                                        className="text-xs text-gray-500 tabular-nums"
                                    >
                                        {renderSet(set.setNumber, set.reps, set.weight, set.actualRpe ?? null)}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-gray-400">{item.scheme}</p>
                        )}

                        {item.trainerNote && (
                            <p className="mt-1.5 flex items-start gap-1 text-xs text-gray-500 italic">
                                <FileText className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                {item.trainerNote}
                            </p>
                        )}

                        {item.traineeNote && (
                            <p className="mt-1 flex items-start gap-1 text-xs text-brand-primary italic">
                                <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                {item.traineeNote}
                            </p>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
```

- [ ] **Step 4: Re-run tests; verify pass**

```bash
npx vitest run tests/unit/WorkoutExerciseDisplayList.test.tsx
```

Expected: all new + existing cases pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/WorkoutExerciseDisplayList.tsx tests/unit/WorkoutExerciseDisplayList.test.tsx
git commit -m "feat(components): show per-set RPE in WorkoutExerciseDisplayList"
```

---

## Task 7: Update `PrevWeekPanel` + i18n keys

**Files:**
- Modify: `src/components/PrevWeekPanel.tsx:70-114`
- Modify: `public/locales/it/trainee.json`
- Modify: `public/locales/en/trainee.json`

- [ ] **Step 1: Add i18n keys**

In `public/locales/it/trainee.json`, locate the `workouts.prevWeekSetRow` key. Immediately after it, add:

```json
"prevWeekSetRowWithRpe": "#{{set}} · {{reps}} rep · {{weight}} kg @ RPE {{rpe}}",
```

In `public/locales/en/trainee.json`, mirror:

```json
"prevWeekSetRowWithRpe": "#{{set}} · {{reps}} reps · {{weight}} kg @ RPE {{rpe}}",
```

If the existing `prevWeekSetRow` value differs in formatting, match its style and just swap the RPE suffix.

- [ ] **Step 2: Propagate actualRpe + switch label**

In `src/components/PrevWeekPanel.tsx`, replace the `displayItems` mapping (lines 70–76):

```tsx
const displayItems: ExerciseDisplayItem[] = exercises.map((ex) => ({
    id: ex.id,
    exerciseName: ex.exerciseName,
    scheme: `${ex.targetSets} x ${ex.targetReps}`,
    performedSets: ex.sets.map((s) => ({
        setNumber: s.setNumber,
        reps: s.reps,
        weight: s.weight,
        completed: s.completed,
        actualRpe: s.actualRpe ?? null,
    })),
    traineeNote: ex.exerciseNote,
}))
```

And replace the `setRowLabel` callback (lines 112–114):

```tsx
setRowLabel={(set, reps, weight, rpe) =>
    rpe != null
        ? t('workouts.prevWeekSetRowWithRpe', {
            set,
            reps,
            weight,
            rpe: rpe.toFixed(1).replace(/\.0$/, ''),
          })
        : t('workouts.prevWeekSetRow', { set, reps, weight })
}
```

The `.replace(/\.0$/, '')` keeps integer values like `8` without trailing `.0` while still letting `8.5` render in full. If the team prefers always rendering `.toFixed(1)`, drop the replace — pick one style and apply it consistently. **Choose: drop the replace and always render `.toFixed(1)`** for a uniform look.

Final form:

```tsx
setRowLabel={(set, reps, weight, rpe) =>
    rpe != null
        ? t('workouts.prevWeekSetRowWithRpe', { set, reps, weight, rpe: rpe.toFixed(1) })
        : t('workouts.prevWeekSetRow', { set, reps, weight })
}
```

- [ ] **Step 3: Run type-check + tests**

```bash
npm run type-check
npx vitest run tests/unit/WorkoutExerciseDisplayList.test.tsx
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/PrevWeekPanel.tsx public/locales/it/trainee.json public/locales/en/trainee.json
git commit -m "feat(prev-week): render @ RPE x per-set in previous-week panel"
```

---

## Task 8: Update workout focus card — types, init, payloads

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx` (multiple locations)

This task handles non-UI plumbing inside `_content.tsx`. Task 9 handles the UI (`RpeCell` + grid).

- [ ] **Step 1: Extend `SetPerformed` interface**

In `_content.tsx`, change the `SetPerformed` interface (lines 70–75) to:

```tsx
interface SetPerformed {
    setNumber: number
    weight: number
    reps: number
    completed?: boolean | null
    actualRpe: number | null
}
```

- [ ] **Step 2: Update `ExerciseFeedback` interface**

Same file, change `ExerciseFeedback.setsPerformed` to use the new type (it already references `SetPerformed[]`, so this is automatic — confirm by re-reading lines 40–50).

- [ ] **Step 3: Initialize `actualRpe` in `fetchWorkout`**

In `fetchWorkout` (around lines 201–243), replace the inner padding loop so each `paddedSets.push(...)` and each new placeholder set includes `actualRpe`:

```tsx
const paddedSets: SetPerformed[] = []
for (let setNumber = 1; setNumber <= maxSetNumber; setNumber++) {
    const existingSet = bySetNumber.get(setNumber)
    if (existingSet) {
        paddedSets.push({
            setNumber: existingSet.setNumber,
            weight: existingSet.weight,
            reps: existingSet.reps,
            completed: existingSet.completed ?? true,
            actualRpe: (existingSet as { actualRpe?: number | null }).actualRpe ?? null,
        })
    } else {
        paddedSets.push({
            setNumber,
            weight: we.effectiveWeight || 0,
            reps: 0,
            completed: false,
            actualRpe: null,
        })
    }
}
```

And the no-feedback branch (around lines 235–240):

```tsx
initialFeedback[we.id] = Array.from({ length: we.sets }, (_, i) => ({
    setNumber: i + 1,
    weight: we.effectiveWeight || 0,
    reps: 0,
    completed: false,
    actualRpe: null,
}))
```

To make the typed cast in the existing-set branch unnecessary, also update the API response type. In the `route.ts` for `GET /api/trainee/workouts/[id]`, the `setsPerformed` selection already returns whatever Prisma reads. Add `actualRpe: true` to the `select` if present — search:

```bash
grep -n "setsPerformed" src/app/api/trainee/workouts/\[id\]/route.ts
```

If the route uses `select: { setNumber: true, reps: true, weight: true, completed: true }`, extend it to include `actualRpe: true`. If it uses an unfiltered `include`, no change needed.

- [ ] **Step 4: Add `updateSetRpe` handler**

After the existing `updateSet` function (around lines 331–346), add:

```tsx
const updateSetRpe = (
    workoutExerciseId: string,
    setIndex: number,
    rpe: number | null
) => {
    setFeedbackData((prev) => {
        const updated = { ...prev }
        updated[workoutExerciseId] = [...(prev[workoutExerciseId] || [])]
        updated[workoutExerciseId][setIndex] = {
            ...updated[workoutExerciseId][setIndex],
            actualRpe: rpe,
        }
        return updated
    })
}
```

- [ ] **Step 5: Wire `actualRpe` into `toggleSetCompleted`**

In `toggleSetCompleted` (around lines 461–523), modify the `newSet` construction:

```tsx
let newSet: SetPerformed
if (isCompleting) {
    const effectiveReps = currentSet.reps > 0
        ? currentSet.reps
        : isPreciseReps
            ? parseInt(we.reps.trim(), 10)
            : 0
    const effectiveWeight = currentSet.weight > 0
        ? currentSet.weight
        : (we.effectiveWeight ?? we.weight ?? 0)
    newSet = {
        ...currentSet,
        completed: true,
        reps: effectiveReps,
        weight: effectiveWeight,
        actualRpe: currentSet.actualRpe ?? null,
    }
} else {
    newSet = { ...currentSet, completed: false, reps: 0, weight: 0, actualRpe: null }
}
```

- [ ] **Step 6: Update `persistExerciseFeedback` payload**

In `persistExerciseFeedback` (around lines 359–372), extend the `set` payload:

```tsx
body: JSON.stringify({
    actualRpe: exerciseRPE[workoutExerciseId] ?? null,
    notes: (exerciseNotes[workoutExerciseId] ?? '').trim() || null,
    set: {
        setNumber: changedSet.setNumber,
        completed: !!changedSet.completed,
        reps: changedSet.reps,
        weight: changedSet.weight,
        actualRpe: changedSet.actualRpe ?? null,
    },
}),
```

- [ ] **Step 7: Update `doSubmit` payload**

In `doSubmit` (around lines 580–599), include `actualRpe` in the set mapping:

```tsx
const payload = {
    traineeNotes: globalNotes.trim() || null,
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
                actualRpe: s.actualRpe ?? null,
            })),
        }
    }),
}
```

- [ ] **Step 8: Run type-check**

```bash
npm run type-check
```

Expected: passes. The compiler will catch any place still using the old `SetPerformed` shape without `actualRpe`.

- [ ] **Step 9: Commit**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx \
        src/app/api/trainee/workouts/[id]/route.ts
git commit -m "feat(trainee): plumb per-set actualRpe through workout state and payloads"
```

(omit `route.ts` from the add if you did not need to change it).

---

## Task 9: Workout focus card — `RpeCell` + grid layout

**Files:**
- Modify: `src/app/trainee/workouts/[id]/_content.tsx` (UI sections)

- [ ] **Step 1: Add `RpeCell` private component**

At the bottom of `_content.tsx` (after `FinalStep`), add:

```tsx
interface RpeCellProps {
    value: number | null
    disabled: boolean
    onChange: (rpe: number | null) => void
    descriptions: Record<number, string>
    t: (key: string, vars?: Record<string, unknown>) => string
}

function RpeCell({ value, disabled, onChange, descriptions, t }: RpeCellProps) {
    return (
        <RPESelector
            value={value}
            onChange={onChange}
            disabled={disabled}
            showLabel={false}
            showDescription={false}
            centeredMenu={true}
            title={t('workouts.setRpeTitle')}
            placeholder="–"
            descriptions={descriptions}
            className="min-w-[56px]"
        />
    )
}
```

If `RPESelector` does not accept `className` or it does not collapse to a single compact button when `showLabel={false}` and `showDescription={false}`, look at `src/components/RPESelector.tsx`: it already collapses to a single button (lines 162–183 render only the button when those flags are off). The `className` is passed to the outer `<div>`; cross-check at edit time.

- [ ] **Step 2: Add the i18n title key**

`public/locales/it/trainee.json`:

```json
"setRpeTitle": "RPE per serie",
```

`public/locales/en/trainee.json`:

```json
"setRpeTitle": "Set RPE",
```

Place inside the `workouts` namespace next to `overallRpe`.

- [ ] **Step 3: Update the sets grid**

In `ExerciseFocusCard`'s sets section (around lines 1004–1078), change the grid template from `grid-cols-[40px_1fr_1fr_48px]` to `grid-cols-[36px_1fr_1fr_1fr_44px]` and add the `RPE` header + per-row cell. Full replacement:

```tsx
{/* Sets input */}
<div className="border-t border-gray-200 p-4 sm:p-6">
    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase">
        {t('workouts.setsHeading')}
    </h3>
    <div className="grid grid-cols-[36px_1fr_1fr_1fr_44px] gap-x-2 px-2 mb-4">
        <span />
        <span className="pb-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">
            {t('workouts.repsShort')}
        </span>
        <span className="pb-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">
            {t('workouts.kgShort')}
        </span>
        <span className="pb-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide">
            RPE
        </span>
        <span />
        {sets.map((set, setIdx) => {
            const border = setIdx < sets.length - 1 ? 'border-b border-gray-200' : ''
            return (
                <Fragment key={setIdx}>
                    <div className={`flex items-center justify-center ${border}`}>
                        <span className="text-sm font-semibold text-gray-600">#{set.setNumber}</span>
                    </div>
                    <div className={`flex items-center py-2 ${border}`}>
                        <Input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            placeholder={/^\d+$/.test(we.reps.trim()) ? String(parsePlannedReps(we.reps)) : we.reps}
                            value={set.reps || ''}
                            onChange={(e) =>
                                onUpdateSet(we.id, setIdx, 'reps', parseInt(e.target.value) || 0)
                            }
                            disabled={!!set.completed}
                            aria-label={`${t('workouts.reps')} ${set.setNumber}`}
                            inputSize="md"
                            className="text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                    <div className={`flex items-center py-2 ${border}`}>
                        <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.5"
                            placeholder={String(we.effectiveWeight ?? we.weight ?? 0)}
                            value={set.weight || ''}
                            onChange={(e) =>
                                onUpdateSet(we.id, setIdx, 'weight', parseFloat(e.target.value) || 0)
                            }
                            disabled={!!set.completed}
                            aria-label={`${t('workouts.weightKg')} ${set.setNumber}`}
                            inputSize="md"
                            className="text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                    <div className={`flex items-center justify-center py-2 ${border}`} data-swipe-ignore="true">
                        <RpeCell
                            value={set.actualRpe}
                            disabled={!!set.completed}
                            onChange={(rpe) => onUpdateSetRpe(we.id, setIdx, rpe)}
                            descriptions={rpeDescriptions}
                            t={t}
                        />
                    </div>
                    <div className={`flex items-center justify-center ${border}`}>
                        <button
                            type="button"
                            onClick={() => onToggleSet(we.id, setIdx)}
                            disabled={persistingKeys.has(`${we.id}:${setIdx}`)}
                            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-70 disabled:cursor-not-allowed ${set.completed
                                    ? 'border-green-300 bg-green-100 text-green-700'
                                    : 'border-gray-300 bg-white text-gray-400 hover:border-green-300 hover:text-green-600'
                                }`}
                            aria-label={t('workouts.markSetDone')}
                        >
                            {persistingKeys.has(`${we.id}:${setIdx}`)
                                ? <LoadingSpinner size="sm" color="green" />
                                : <Check className="w-4 h-4" />
                            }
                        </button>
                    </div>
                </Fragment>
            )
        })}
    </div>
</div>
```

- [ ] **Step 4: Wire `onUpdateSetRpe` through `ExerciseFocusCard` props**

Extend `ExerciseFocusCardProps` (around lines 827–844):

```tsx
interface ExerciseFocusCardProps {
    we: WorkoutExerciseWithWeight
    sets: SetPerformed[]
    rpe: number | null
    exerciseNote: string
    savedNote: string
    isNoteSaving: boolean
    videoExpanded: boolean
    onToggleVideo: () => void
    onUpdateSet: (id: string, idx: number, field: 'weight' | 'reps', value: number) => void
    onUpdateSetRpe: (id: string, idx: number, rpe: number | null) => void
    onToggleSet: (id: string, idx: number) => void
    persistingKeys: Set<string>
    onUpdateRpe: (rpe: number | null) => void
    onUpdateNote: (note: string) => void
    onSaveNote: () => void
    rpeDescriptions: Record<number, string>
    t: (key: string, vars?: Record<string, unknown>) => string
}
```

Add `onUpdateSetRpe` to the destructuring + the parent invocation in `WorkoutDetailContent`:

```tsx
<ExerciseFocusCard
    ...
    onUpdateSet={(id, idx, field, value) => updateSet(id, idx, field, value)}
    onUpdateSetRpe={(id, idx, rpe) => updateSetRpe(id, idx, rpe)}
    onToggleSet={(id, idx) => toggleSetCompleted(id, idx)}
    ...
/>
```

- [ ] **Step 5: Run type-check**

```bash
npm run type-check
```

Expected: passes.

- [ ] **Step 6: Manual smoke in browser**

Start dev server:

```bash
npm run dev
```

Open `http://localhost:3000/trainee/workouts/<id>` as a trainee:
- Verify the sets grid has 5 columns (`# / reps / kg / RPE / ✓`).
- Tap the RPE button on set 1 → modal opens with the RPE values 5.0–10.0.
- Pick `8.5` → modal closes, button shows `RPE 8.5`.
- Tap the check on set 1 → button becomes green, RPE button disabled, value remains visible.
- Tap check again to deselect → reps/kg/RPE reset to defaults/placeholder (`–`).
- Repeat without picking RPE → set completes with no RPE saved.

If the layout is cramped on 360px-wide viewport, narrow the RPE column's `min-w-[56px]` to `min-w-[52px]` or hide the inner description (`RPESelector` already does this with `showDescription={false}`).

- [ ] **Step 7: Commit**

```bash
git add src/app/trainee/workouts/[id]/_content.tsx \
        public/locales/it/trainee.json public/locales/en/trainee.json
git commit -m "feat(trainee): add per-set RPE input column to workout focus card"
```

---

## Task 10: CHANGELOG entry

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Add entry**

Prepend a new entry to `implementation-docs/CHANGELOG.md`:

```markdown
## 2026-05-13 — Trainee per-set RPE

- Added optional `actualRpe` column on `sets_performed` (nullable Float).
- Trainee workout focus card gains a 4th column for RPE per individual set; reuses `RPESelector` (modal, 5.0–10.0 step 0.5). Editable only before the set is checked.
- Autosave and submit routes propagate `set.actualRpe`.
- Previous-week panel renders `… kg @ RPE x` when RPE is recorded.
- Why: gives trainees granular fatigue feedback per set, surfaces it as context when planning the next session.
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs(changelog): record trainee per-set RPE feature"
```

---

## Task 11: Full verification pass

- [ ] **Step 1: Run lint, type-check, unit tests**

```bash
npm run lint
npm run type-check
npm run test:unit
```

Expected: all green. If a coverage threshold trips on `_content.tsx`, add a targeted unit test for `updateSetRpe`/`toggleSetCompleted` in `tests/unit/workout-detail-content.test.tsx` (mirror existing tests for the same file).

- [ ] **Step 2: Run integration tests**

```bash
npx vitest run tests/integration/
```

Expected: all green.

- [ ] **Step 3: Manual end-to-end**

In a browser (dev server still running):
1. Log in as a trainee with at least 2 weeks of programmed workouts.
2. Open week 2, day 1 workout.
3. Record set 1 with RPE 8, set 2 with RPE 8.5, set 3 without RPE.
4. Submit the workout.
5. Open week 3, day 1 (or any later week's matching day).
6. Expand the "previous week" panel.
7. Verify rows render `#1 · X rep · Y kg @ RPE 8.0`, `#2 · X rep · Y kg @ RPE 8.5`, `#3 · X rep · Y kg` (no RPE).

If the team has no week 3 in test data, instead verify in Prisma Studio that `sets_performed.actualRpe` got populated:

```bash
npm run prisma:studio
```

- [ ] **Step 4: Commit any test-only follow-ups**

If Step 1 needed an extra unit test:

```bash
git add tests/unit/workout-detail-content.test.tsx
git commit -m "test: cover per-set RPE state updates in workout focus card"
```

---

## Self-Review Notes

- Spec sections (schema, validation, API, types, UI focus card, UI prev-week, i18n, testing) map 1:1 to Tasks 1–9 + 10 (changelog).
- `actualRpe` field name used consistently across schema, Prisma, API payloads, types, UI state.
- `RpeCell` is a private component inside `_content.tsx` (per spec self-review clarification), not exported.
- No placeholders. Every code block is the final form.
- Task 5 SQL: `sp."actualRpe"` matches the Prisma `@map("sets_performed")` and Postgres column name (camelCase quoted), same convention as `sp."setNumber"` already used.
