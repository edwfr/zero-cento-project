# Skeleton Exercise Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist `isSkeletonExercise` flag on `WorkoutExercise` so that exercises added manually in step 3 do not corrupt the step 2 skeleton view.

**Architecture:** Add `isSkeletonExercise Boolean @default(false)` to the `WorkoutExercise` model. Thread the flag through the Zod schema, both API routes (POST create, copy endpoints), and the frontend wizard. `buildStructureRowsForWorkout` filters by the flag with a backwards-compatible fallback for programs created before this change (where all rows have `false`). Copy APIs (`copy-first-week`, `copy-week`) propagate the flag as-is.

**Tech Stack:** Prisma (Postgres), Next.js App Router API routes, React / TypeScript, Zod, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `isSkeletonExercise` column |
| `prisma/migrations/<ts>_add_skeleton_exercise_flag/migration.sql` | Create | DDL: `ALTER TABLE workout_exercises ADD COLUMN` |
| `src/schemas/workout-exercise.ts` | Modify | Add `isSkeletonExercise` to base Zod schema |
| `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts` | Modify | Pass flag to Prisma `create` |
| `src/app/api/programs/[id]/copy-first-week/route.ts` | Modify | Copy flag in `createMany` |
| `src/app/api/programs/[id]/copy-week/route.ts` | Modify | Copy flag in `createMany` |
| `src/app/trainer/programs/[id]/edit/structure-utils.ts` | Modify | Accept + filter by `isSkeletonExercise` with fallback |
| `src/app/trainer/programs/[id]/edit/_content.tsx` | Modify | Interface, draft rows, payload builder |
| `tests/unit/structure-utils.test.ts` | Modify | Cover new filter logic |
| `implementation-docs/CHANGELOG.md` | Modify | Log the change |

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_skeleton_exercise_flag/migration.sql`

- [ ] **Step 1: Add field to WorkoutExercise model**

In `prisma/schema.prisma`, inside `model WorkoutExercise { ... }`, add after `isWarmup`:

```prisma
isSkeletonExercise Boolean @default(false)
```

Full model block for reference (show only changed lines):

```prisma
model WorkoutExercise {
  id         String     @id @default(uuid())
  workoutId  String
  exerciseId String
  variant    String?
  sets       Int
  reps       String
  targetRpe  Float?
  weightType WeightType
  weight     Float?
  effectiveWeight Float?
  restTime   RestTime
  isWarmup   Boolean    @default(false)
  isSkeletonExercise Boolean @default(false)   // <-- ADD THIS LINE
  notes      String?
  order      Int
  // ... relations unchanged
}
```

- [ ] **Step 2: Create migration directory and SQL file**

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_skeleton_exercise_flag
```

Then write the SQL file at `prisma/migrations/<timestamp>_add_skeleton_exercise_flag/migration.sql`:

```sql
-- AddColumn: isSkeletonExercise on workout_exercises
ALTER TABLE "workout_exercises" ADD COLUMN "is_skeleton_exercise" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Regenerate Prisma client**

```bash
npm run prisma:generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 4: Run migration in dev**

```bash
npm run prisma:migrate
```

Expected: Migration applied, `is_skeleton_exercise` column added to `workout_exercises`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add isSkeletonExercise flag to WorkoutExercise"
```

---

## Task 2: Zod schema

**Files:**
- Modify: `src/schemas/workout-exercise.ts`

- [ ] **Step 1: Write failing test**

In `tests/unit/schemas.test.ts` (file already exists), add inside the relevant describe block or add a new one:

```typescript
describe('workoutExerciseSchema - isSkeletonExercise', () => {
    const baseValid = {
        exerciseId: '00000000-0000-0000-0000-000000000001',
        sets: 3,
        reps: '8',
        weightType: 'absolute' as const,
        restTime: 'm2' as const,
        order: 1,
    }

    it('accepts isSkeletonExercise true', () => {
        const result = workoutExerciseSchema.safeParse({ ...baseValid, isSkeletonExercise: true })
        expect(result.success).toBe(true)
        expect(result.data?.isSkeletonExercise).toBe(true)
    })

    it('accepts isSkeletonExercise false', () => {
        const result = workoutExerciseSchema.safeParse({ ...baseValid, isSkeletonExercise: false })
        expect(result.success).toBe(true)
        expect(result.data?.isSkeletonExercise).toBe(false)
    })

    it('defaults isSkeletonExercise to false when omitted', () => {
        const result = workoutExerciseSchema.safeParse(baseValid)
        expect(result.success).toBe(true)
        expect(result.data?.isSkeletonExercise).toBe(false)
    })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run tests/unit/schemas.test.ts
```

Expected: test failures on the 3 new cases (field doesn't exist yet).

- [ ] **Step 3: Add field to `workoutExerciseBaseSchema`**

In `src/schemas/workout-exercise.ts`, inside `workoutExerciseBaseSchema`, add after `isWarmup`:

```typescript
isSkeletonExercise: z.boolean().default(false).optional(),
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run tests/unit/schemas.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/workout-exercise.ts tests/unit/schemas.test.ts
git commit -m "feat(schema): add isSkeletonExercise to workoutExerciseSchema"
```

---

## Task 3: API — POST exercise route

**Files:**
- Modify: `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts`

The goal: when `POST /api/programs/[id]/workouts/[workoutId]/exercises` is called with `isSkeletonExercise: true`, Prisma persists the flag.

- [ ] **Step 1: Write failing integration test**

In `tests/integration/programs.test.ts`, add a test that creates a workout exercise with `isSkeletonExercise: true` and verifies the DB row has the flag set.

```typescript
it('POST exercise saves isSkeletonExercise flag', async () => {
    // This test requires a real DB. If integration tests are skipped in CI without DB,
    // rely on the unit schema test and manual verification.
    // Locate an existing POST exercise test and assert the new field.
    // Example skeleton (adapt to the test helper patterns in this file):
    const res = await POST_exercise(programId, workoutId, {
        exerciseId: testExerciseId,
        sets: 3,
        reps: '8',
        weightType: 'absolute',
        restTime: 'm2',
        order: 1,
        isSkeletonExercise: true,
    })
    expect(res.status).toBe(201)
    const row = await prisma.workoutExercise.findFirst({ where: { workoutId } })
    expect(row?.isSkeletonExercise).toBe(true)
})
```

> Note: look at the existing test patterns in `tests/integration/programs.test.ts` to find the correct helper functions. If the test infrastructure doesn't support this specific assertion cleanly, add it as a TODO comment and rely on the schema test + type-check.

- [ ] **Step 2: Destructure `isSkeletonExercise` from `validation.data`**

In `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts`, in the POST handler, update the destructure at line ~27:

```typescript
const {
    exerciseId,
    variant,
    order,
    sets,
    reps,
    notes,
    targetRpe,
    weightType,
    weight,
    effectiveWeight,
    restTime,
    isWarmup,
    isSkeletonExercise,   // <-- ADD
} = validation.data
```

- [ ] **Step 3: Pass flag to Prisma create**

In the same file, in the `prisma.workoutExercise.create` call (line ~103), add the field:

```typescript
const workoutExercise = await prisma.workoutExercise.create({
    data: {
        workoutId,
        exerciseId,
        variant: variant || null,
        order: finalOrder,
        sets: sets || 1,
        reps: typeof reps === 'number' ? reps.toString() : reps || '8',
        notes: notes || null,
        targetRpe: targetRpe ?? null,
        weightType: weightType || 'absolute',
        weight: weight ?? null,
        effectiveWeight: effectiveWeight ?? null,
        restTime: restTime || 'm2',
        isWarmup: isWarmup || false,
        isSkeletonExercise: isSkeletonExercise ?? false,   // <-- ADD
    },
    // include unchanged
})
```

- [ ] **Step 4: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts
git commit -m "feat(api): persist isSkeletonExercise when creating workout exercise"
```

---

## Task 4: API — Copy routes

**Files:**
- Modify: `src/app/api/programs/[id]/copy-first-week/route.ts`
- Modify: `src/app/api/programs/[id]/copy-week/route.ts`

Both use `createMany` with an explicit field list. Adding `isSkeletonExercise` ensures the flag is preserved when copying weeks.

- [ ] **Step 1: Update `copy-first-week/route.ts`**

In the `createMany` data mapping (line ~104), add `isSkeletonExercise`:

```typescript
await tx.workoutExercise.createMany({
    data: sourceWorkout.workoutExercises.map((exercise) => ({
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
        isSkeletonExercise: exercise.isSkeletonExercise,   // <-- ADD
        notes: exercise.notes,
        order: exercise.order,
    })),
})
```

- [ ] **Step 2: Update `copy-week/route.ts`**

Same change in `copy-week/route.ts` (line ~112):

```typescript
await tx.workoutExercise.createMany({
    data: sourceWorkout.workoutExercises.map((exercise) => ({
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
        isSkeletonExercise: exercise.isSkeletonExercise,   // <-- ADD
        notes: exercise.notes,
        order: exercise.order,
    })),
})
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/programs/[id]/copy-first-week/route.ts \
        src/app/api/programs/[id]/copy-week/route.ts
git commit -m "feat(api): propagate isSkeletonExercise flag in copy-week routes"
```

---

## Task 5: `structure-utils.ts` — filter by flag

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/structure-utils.ts`
- Modify: `tests/unit/structure-utils.test.ts`

**Key invariant:** If no exercises in the source list have `isSkeletonExercise = true`, fall back to using ALL exercises (backwards compatibility for programs created before this flag existed).

- [ ] **Step 1: Write failing tests**

Replace the contents of `tests/unit/structure-utils.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest'
import { buildStructureRowsForWorkout } from '@/app/trainer/programs/[id]/edit/structure-utils'

describe('buildStructureRowsForWorkout', () => {
    it('returns 4 empty rows when sourceExercises is empty', () => {
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

    it('maps from sourceExercises when non-empty', () => {
        const source = [
            { id: 'we-1', exercise: { id: 'ex-1' }, isSkeletonExercise: false },
            { id: 'we-2', exercise: { id: 'ex-2' }, isSkeletonExercise: false },
        ]
        const rows = buildStructureRowsForWorkout(1, source)
        // fallback: no skeleton flags → use all
        expect(rows).toHaveLength(2)
        expect(rows[0]).toEqual({ id: 'structure-1-we-1-0', exerciseId: 'ex-1' })
        expect(rows[1]).toEqual({ id: 'structure-1-we-2-1', exerciseId: 'ex-2' })
    })

    it('filters to skeleton-only exercises when at least one has isSkeletonExercise=true', () => {
        const source = [
            { id: 'we-1', exercise: { id: 'ex-1' }, isSkeletonExercise: true },
            { id: 'we-2', exercise: { id: 'ex-2' }, isSkeletonExercise: true },
            { id: 'we-3', exercise: { id: 'ex-3' }, isSkeletonExercise: false }, // manually added
        ]
        const rows = buildStructureRowsForWorkout(0, source)
        expect(rows).toHaveLength(2)
        expect(rows[0].exerciseId).toBe('ex-1')
        expect(rows[1].exerciseId).toBe('ex-2')
    })

    it('uses all exercises as fallback when none have isSkeletonExercise=true (backwards compat)', () => {
        const source = [
            { id: 'we-1', exercise: { id: 'ex-1' }, isSkeletonExercise: false },
            { id: 'we-2', exercise: { id: 'ex-2' }, isSkeletonExercise: false },
        ]
        const rows = buildStructureRowsForWorkout(0, source)
        expect(rows).toHaveLength(2)
    })

    it('returns unique ids across rows', () => {
        const rows = buildStructureRowsForWorkout(0, [])
        const ids = rows.map((r) => r.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run tests/unit/structure-utils.test.ts
```

Expected: new filter/fallback tests fail.

- [ ] **Step 3: Update `buildStructureRowsForWorkout`**

Replace the entire content of `src/app/trainer/programs/[id]/edit/structure-utils.ts`:

```typescript
export interface WorkoutStructureTemplateRow {
    id: string
    exerciseId: string
}

const DEFAULT_EXERCISE_ROW_COUNT = 4

export function buildStructureRowsForWorkout(
    workoutIndex: number,
    sourceExercises: Array<{ id: string; exercise: { id: string }; isSkeletonExercise: boolean }>
): WorkoutStructureTemplateRow[] {
    if (sourceExercises.length === 0) {
        return Array.from({ length: DEFAULT_EXERCISE_ROW_COUNT }, (_, i) => ({
            id: `structure-${workoutIndex}-default-${i}`,
            exerciseId: '',
        }))
    }

    const hasSkeletonFlag = sourceExercises.some((e) => e.isSkeletonExercise)
    const filtered = hasSkeletonFlag
        ? sourceExercises.filter((e) => e.isSkeletonExercise)
        : sourceExercises

    return filtered.map((we, rowIndex) => ({
        id: `structure-${workoutIndex}-${we.id}-${rowIndex}`,
        exerciseId: we.exercise.id,
    }))
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run tests/unit/structure-utils.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/structure-utils.ts \
        tests/unit/structure-utils.test.ts
git commit -m "feat(structure-utils): filter skeleton exercises by flag with backwards-compat fallback"
```

---

## Task 6: Frontend `_content.tsx` — types, draft rows, payload

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

This is the largest change. Four distinct sub-changes, done in order.

### 6a: Update `WorkoutExercise` interface and `buildEditableRow`

- [ ] **Step 1: Add `isSkeletonExercise` to `WorkoutExercise` interface (line ~70)**

```typescript
interface WorkoutExercise {
    id: string
    order: number
    variant: string | null
    sets: number
    reps: string
    targetRpe: number | null
    weightType: WeightType
    weight: number | null
    effectiveWeight: number | null
    restTime: RestTime
    isWarmup: boolean
    isSkeletonExercise: boolean   // <-- ADD
    notes: string | null
    exercise: ExerciseReference
}
```

- [ ] **Step 2: Add `isSkeletonExercise` to `EditableWorkoutExerciseRow` interface (line ~135)**

```typescript
interface EditableWorkoutExerciseRow {
    id: string
    workoutId: string
    exerciseId: string
    variant: string
    sets: string
    reps: string
    targetRpe: string
    weight: string
    isWarmup: boolean
    isSkeletonExercise: boolean   // <-- ADD
    order: number
    restTime: RestTime
    notes: string | null
    isDraft: boolean
}
```

- [ ] **Step 3: Update `buildEditableRow` (line ~329)**

```typescript
function buildEditableRow(
    workoutId: string,
    workoutExercise: WorkoutExercise,
    isDraft = false
): EditableWorkoutExerciseRow {
    return {
        id: workoutExercise.id,
        workoutId,
        exerciseId: workoutExercise.exercise.id,
        variant: workoutExercise.variant ?? '',
        sets: String(workoutExercise.sets),
        reps: workoutExercise.reps,
        targetRpe:
            typeof workoutExercise.targetRpe === 'number' ? String(workoutExercise.targetRpe) : '',
        weight: formatWeightInputFromStoredValues(
            workoutExercise.weightType,
            workoutExercise.weight
        ),
        isWarmup: workoutExercise.isWarmup,
        isSkeletonExercise: workoutExercise.isSkeletonExercise,   // <-- ADD
        order: workoutExercise.order,
        restTime: workoutExercise.restTime,
        notes: workoutExercise.notes,
        isDraft,
    }
}
```

### 6b: Set `isSkeletonExercise: false` on manual add row (~line 1307)

- [ ] **Step 4: Update manual `addRow` handler**

In the `addRow` function (the one triggered by the "Add Row" button in step 3, around line 1307):

```typescript
setRowStateById((currentRows) => ({
    ...currentRows,
    [draftRowId]: {
        id: draftRowId,
        workoutId,
        exerciseId: '',
        variant: '',
        sets: '',
        reps: '',
        targetRpe: '',
        weight: '',
        isWarmup: false,
        isSkeletonExercise: false,   // <-- ADD (explicit: manually added)
        order: nextOrder,
        restTime: 'm2',
        notes: null,
        isDraft: true,
    },
}))
```

### 6c: Set `isSkeletonExercise: true` on skeleton-applied draft rows (~line 1819)

- [ ] **Step 5: Update `applyStructureToAllWeeks` draft row creation**

Inside `applyStructureToAllWeeks`, in the `draftRow` object literal (around line 1819):

```typescript
const draftRow: EditableWorkoutExerciseRow = {
    id: draftRowId,
    workoutId: workout.id,
    exerciseId: structureRow.exerciseId,
    variant: '',
    sets: '',
    reps: '',
    targetRpe: '',
    weight: '',
    isWarmup: false,
    isSkeletonExercise: true,   // <-- ADD (skeleton-applied row)
    order: nextOrder,
    restTime: 'm2',
    notes: null,
    isDraft: true,
}
```

### 6d: Include `isSkeletonExercise` in the API payload builder (~line 1499)

- [ ] **Step 6: Update `buildWorkoutExercisePayload`**

```typescript
const buildWorkoutExercisePayload = (
    row: EditableWorkoutExerciseRow,
    parsedWeight: ParsedWeightInputResult
) => {
    const parsedSets = Number.parseInt(row.sets, 10)
    const parsedRpe = row.targetRpe.trim() === '' ? null : Number(row.targetRpe)

    return {
        exerciseId: row.exerciseId,
        variant: row.variant.trim() || null,
        order: row.order,
        sets: parsedSets,
        reps: row.reps.trim(),
        targetRpe: parsedRpe,
        weightType: parsedWeight.weightType,
        weight: parsedWeight.weight,
        effectiveWeight: parsedWeight.effectiveWeight,
        restTime: row.restTime,
        isWarmup: row.isWarmup,
        isSkeletonExercise: row.isSkeletonExercise,   // <-- ADD
        notes: row.notes,
    }
}
```

- [ ] **Step 7: Type-check the whole file**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "feat(wizard): track isSkeletonExercise on editable rows and API payload"
```

---

## Task 7: Wire `isSkeletonExercise` into structure initialization

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

The effect at line ~757 builds `structureRowsByWorkoutIndex` from `firstWeek.workouts[i].workoutExercises`. Since `buildStructureRowsForWorkout` now expects the `isSkeletonExercise` field in the source array, and `WorkoutExercise` interface now includes it, this should work automatically — but verify the call sites are correct.

- [ ] **Step 1: Verify `buildStructureRowsForWorkout` call in the useEffect (line ~774)**

The call currently is:

```typescript
nextStructureRowsByWorkoutIndex[workoutIndex] = buildStructureRowsForWorkout(
    workoutIndex,
    sourceRows
)
```

Where `sourceRows = sourceWorkout?.workoutExercises ?? []`. Since `sourceWorkout.workoutExercises` is typed as `WorkoutExercise[]` and `WorkoutExercise` now includes `isSkeletonExercise: boolean`, this call is already compatible. No code change needed — just confirm the type-check passes.

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 2: Verify the full unit test suite passes**

```bash
npm run test:unit
```

Expected: all tests pass including the new structure-utils tests.

- [ ] **Step 3: Commit**

```bash
git add src/app/trainer/programs/[id]/edit/_content.tsx
git commit -m "fix(wizard): structure init now correctly filters skeleton exercises by flag"
```

> If Step 1 reveals the type does NOT flow through correctly (e.g. `workoutExercise` is typed as `any` in the useEffect), cast explicitly:
> ```typescript
> const sourceRows: Array<{ id: string; exercise: { id: string }; isSkeletonExercise: boolean }> =
>     sourceWorkout?.workoutExercises ?? []
> ```

---

## Task 8: Full test pass + build verification

- [ ] **Step 1: Run all unit tests**

```bash
npm run test:unit
```

Expected: all tests pass, no regressions.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```

Expected: no errors.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: successful build, no type errors.

---

## Task 9: Update CHANGELOG

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Add entry**

Add before the `## Prossime entry` comment:

```markdown
### [24 Aprile 2026] — isSkeletonExercise flag su WorkoutExercise

**File modificati:**
- `prisma/schema.prisma` — aggiunto campo `isSkeletonExercise Boolean @default(false)`
- `prisma/migrations/<ts>_add_skeleton_exercise_flag/migration.sql` — DDL
- `src/schemas/workout-exercise.ts` — aggiunto campo Zod
- `src/app/api/programs/[id]/workouts/[workoutId]/exercises/route.ts` — persiste il flag in creazione
- `src/app/api/programs/[id]/copy-first-week/route.ts` — propaga il flag in copia
- `src/app/api/programs/[id]/copy-week/route.ts` — propaga il flag in copia
- `src/app/trainer/programs/[id]/edit/structure-utils.ts` — filtra per flag con fallback retrocompatibile
- `src/app/trainer/programs/[id]/edit/_content.tsx` — interfacce, payload, righe scheletro vs manuali
- `tests/unit/structure-utils.test.ts` — copertura filtro/fallback

**Note:** Il flag è `false` di default: i programmi esistenti (tutti i record con `false`) usano il fallback "usa tutti gli esercizi" così non subiscono regressioni. I nuovi programmi creati dopo questa modifica tracciano correttamente scheletro vs aggiunta manuale.
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog entry for isSkeletonExercise flag"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Skeleton info saved at DB level | Task 1 (Prisma migration) |
| Flag set when applying skeleton | Task 6c |
| Flag NOT set when adding manually in step 3 | Task 6b |
| Skeleton view in step 2 not corrupted by manual additions | Task 5 (structure-utils filter) |
| Copy operations preserve flag | Task 4 |
| Backwards compatibility for existing programs | Task 5 (fallback logic) |
| API accepts and persists flag | Task 3 |
| Documentation updated | Task 9 |

**Placeholder scan:** No TBD or TODO in code blocks. All integration test note is explicit about the test pattern dependency.

**Type consistency:**
- `isSkeletonExercise: boolean` in `WorkoutExercise` interface → flows into `buildEditableRow` → `EditableWorkoutExerciseRow` → `buildWorkoutExercisePayload` → API POST body → Zod schema → Prisma create. Consistent throughout.
- `buildStructureRowsForWorkout` new param type `{ id: string; exercise: { id: string }; isSkeletonExercise: boolean }` — matched by `WorkoutExercise` after Task 6a.
