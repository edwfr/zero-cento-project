# Default Structure Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a trainer arrives at the structure step (step 2) of the new-program wizard, each workout column shows 4 empty exercise rows by default instead of the "no rows" empty-state.

**Architecture:** Extract the row-initialization logic into a pure function `buildStructureRowsForWorkout` in a new utils file, unit-test it, then use it in the existing `setStructureRowsByWorkoutIndex` initializer inside `EditProgramContent`. For programs that already have exercises saved (existing programs), the function continues to map from the saved data as before.

**Tech Stack:** TypeScript, Vitest (jsdom), React state (no new dependencies)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/trainer/programs/[id]/edit/structure-utils.ts` | Pure function + shared type |
| Modify | `src/app/trainer/programs/[id]/edit/_content.tsx` | Use shared type + call helper |
| Create | `tests/unit/lib/structure-utils.test.ts` | Unit tests for the helper |
| Modify | `implementation-docs/CHANGELOG.md` | Changelog entry |

---

## Task 1: Write failing unit tests for `buildStructureRowsForWorkout`

**Files:**
- Create: `tests/unit/lib/structure-utils.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// tests/unit/lib/structure-utils.test.ts
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
            { id: 'we-1', exercise: { id: 'ex-1' } },
            { id: 'we-2', exercise: { id: 'ex-2' } },
        ]
        const rows = buildStructureRowsForWorkout(1, source)
        expect(rows).toHaveLength(2)
        expect(rows[0]).toEqual({ id: 'structure-1-we-1-0', exerciseId: 'ex-1' })
        expect(rows[1]).toEqual({ id: 'structure-1-we-2-1', exerciseId: 'ex-2' })
    })

    it('returns unique ids across rows', () => {
        const rows = buildStructureRowsForWorkout(0, [])
        const ids = rows.map((r) => r.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run tests/unit/lib/structure-utils.test.ts
```

Expected: `FAIL` — `Cannot find module '@/app/trainer/programs/[id]/edit/structure-utils'`

---

## Task 2: Create `structure-utils.ts`

**Files:**
- Create: `src/app/trainer/programs/[id]/edit/structure-utils.ts`

- [ ] **Step 3: Write the utils file**

```typescript
// src/app/trainer/programs/[id]/edit/structure-utils.ts
export interface WorkoutStructureTemplateRow {
    id: string
    exerciseId: string
}

const DEFAULT_EXERCISE_ROW_COUNT = 4

export function buildStructureRowsForWorkout(
    workoutIndex: number,
    sourceExercises: Array<{ id: string; exercise: { id: string } }>
): WorkoutStructureTemplateRow[] {
    if (sourceExercises.length > 0) {
        return sourceExercises.map((we, rowIndex) => ({
            id: `structure-${workoutIndex}-${we.id}-${rowIndex}`,
            exerciseId: we.exercise.id,
        }))
    }
    return Array.from({ length: DEFAULT_EXERCISE_ROW_COUNT }, (_, i) => ({
        id: `structure-${workoutIndex}-default-${i}`,
        exerciseId: '',
    }))
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/lib/structure-utils.test.ts
```

Expected: `PASS` — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add tests/unit/lib/structure-utils.test.ts src/app/trainer/programs/\[id\]/edit/structure-utils.ts
git commit -m "test: add unit tests for buildStructureRowsForWorkout; implement helper"
```

---

## Task 3: Wire `structure-utils.ts` into `_content.tsx`

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx`

The changes are:
1. Remove the local `WorkoutStructureTemplateRow` interface (it now lives in `structure-utils.ts`)
2. Add the import
3. Replace the inline mapping at the `setStructureRowsByWorkoutIndex` initializer with a call to `buildStructureRowsForWorkout`

- [ ] **Step 6: Update imports**

At the top of `_content.tsx`, add after the existing local imports:

```typescript
import {
    buildStructureRowsForWorkout,
    type WorkoutStructureTemplateRow,
} from './structure-utils'
```

- [ ] **Step 7: Remove the duplicate interface**

Delete these lines from `_content.tsx` (currently at ~line 146):

```typescript
interface WorkoutStructureTemplateRow {
    id: string
    exerciseId: string
}
```

- [ ] **Step 8: Replace the inline mapping with the helper**

Find the block inside `setStructureRowsByWorkoutIndex` (currently around line 771–780):

```typescript
        const sourceWorkout = firstWeek?.workouts[workoutIndex]
        const sourceRows = sourceWorkout?.workoutExercises ?? []
        hasChanges = true

        nextStructureRowsByWorkoutIndex[workoutIndex] = sourceRows.map(
            (workoutExercise, rowIndex) => ({
                id: `structure-${workoutIndex}-${workoutExercise.id}-${rowIndex}`,
                exerciseId: workoutExercise.exercise.id,
            })
        )
```

Replace with:

```typescript
        const sourceWorkout = firstWeek?.workouts[workoutIndex]
        const sourceRows = sourceWorkout?.workoutExercises ?? []
        hasChanges = true

        nextStructureRowsByWorkoutIndex[workoutIndex] = buildStructureRowsForWorkout(
            workoutIndex,
            sourceRows
        )
```

- [ ] **Step 9: Run type-check**

```bash
npm run type-check
```

Expected: no errors

- [ ] **Step 10: Run unit tests**

```bash
npm run test:unit
```

Expected: all tests pass

- [ ] **Step 11: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx
git commit -m "feat(wizard): default to 4 empty exercise rows per workout in structure step"
```

---

## Task 4: Update CHANGELOG

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 12: Add changelog entry**

Prepend to `implementation-docs/CHANGELOG.md`:

```markdown
## [Unreleased]

### Added
- Structure step (wizard step 2) now pre-fills 4 empty exercise rows per workout for new programs, removing the need to click "add row" 4 times manually.
```

- [ ] **Step 13: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog entry for default structure rows feature"
```

---

## Self-Review

**Spec coverage:**
- ✅ Step 2 of wizard shows 4 default empty rows per day (workout)
- ✅ Existing programs with saved exercises still load their exercises (non-empty `sourceExercises` path in helper)
- ✅ Trainer can still add/remove rows after the defaults appear

**Placeholder scan:** None present.

**Type consistency:**
- `WorkoutStructureTemplateRow` defined once in `structure-utils.ts`, imported in both `_content.tsx` and test
- `buildStructureRowsForWorkout` signature matches usage in `setStructureRowsByWorkoutIndex`

**Edge cases handled:**
- New program (empty workouts) → 4 defaults ✅
- Existing program (workouts with exercises) → maps existing ✅
- Subsequent program refreshes → `existingRows` truthy guard in the loop preserves trainer's modifications ✅
- Trainer removes all 4 defaults before applying → existing `structureRows.length === 0` validation at apply-time still shows error ✅
