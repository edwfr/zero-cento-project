# Deferred Exercise Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the immediate server DELETE call on trash-icon click with a local "pending delete" that is applied (together with other changes) when the trainer clicks "Salva workout".

**Architecture:** Add a `pendingDeletesByWorkout` state map (`Record<string, string[]>`) to `_content.tsx`. `getWorkoutRows` filters out pending-delete IDs so they disappear from the UI immediately. `deleteRow()` for persisted rows now just appends the ID to this map instead of calling the API. `saveWorkoutRows()` first sends parallel DELETE requests for all pending IDs, then proceeds with the existing bulk PUT for remaining exercises.

`hasWorkoutUnsavedChanges` already detects the discrepancy automatically: it compares `currentRows` (from `getWorkoutRows`, which filters pending deletes) vs `workout.workoutExercises` (server state) — any length difference returns `true`, so the save button becomes enabled as soon as an exercise is marked for deletion.

**Tech Stack:** React `useState`/`useCallback`, Next.js App Router API routes, Prisma.

---

## File Map

| File | Change |
|------|--------|
| `src/app/trainer/programs/[id]/edit/_content.tsx` | Add state, modify `getWorkoutRows`, `deleteRow`, `saveWorkoutRows` |
| `tests/integration/workout-exercise-delete.test.ts` | New — test DELETE route used during deferred save |
| `implementation-docs/CHANGELOG.md` | Required entry |

---

### Task 1: Write the failing integration test for deferred-save DELETE sequence

**Files:**
- Create: `tests/integration/workout-exercise-delete.test.ts`

The existing integration test pattern (`tests/integration/exercises.test.ts`) mocks `@/lib/auth` and `@/lib/prisma`, imports the route handler, and calls it directly.

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    requireTrainerProgramOwnership: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: {
            findFirst: vi.fn(),
        },
        workoutExercise: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            delete: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { DELETE } from '@/app/api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]/route'
import { requireRole, requireTrainerProgramOwnership } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const PROGRAM_ID = '11111111-1111-1111-1111-111111111111'
const WORKOUT_ID  = '22222222-2222-2222-2222-222222222222'
const EXERCISE_ID = '33333333-3333-3333-3333-333333333333'

const withParams = (id: string, workoutId: string, exerciseId: string) => ({
    params: Promise.resolve({ id, workoutId, exerciseId }),
})

describe('DELETE /api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession as any)
        vi.mocked(requireTrainerProgramOwnership).mockResolvedValue(undefined as any)
    })

    it('returns 403 when program is not in DRAFT status', async () => {
        vi.mocked(prisma.trainingProgram.findFirst).mockResolvedValue({
            id: PROGRAM_ID,
            status: 'PUBLISHED',
        } as any)

        const req = new NextRequest(`http://localhost/api/programs/${PROGRAM_ID}/workouts/${WORKOUT_ID}/exercises/${EXERCISE_ID}`, {
            method: 'DELETE',
        })
        const res = await DELETE(req, withParams(PROGRAM_ID, WORKOUT_ID, EXERCISE_ID))
        expect(res.status).toBe(403)
    })

    it('returns 404 when exercise does not belong to workout', async () => {
        vi.mocked(prisma.trainingProgram.findFirst).mockResolvedValue({
            id: PROGRAM_ID,
            status: 'DRAFT',
        } as any)
        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(null)

        const req = new NextRequest(`http://localhost/api/programs/${PROGRAM_ID}/workouts/${WORKOUT_ID}/exercises/${EXERCISE_ID}`, {
            method: 'DELETE',
        })
        const res = await DELETE(req, withParams(PROGRAM_ID, WORKOUT_ID, EXERCISE_ID))
        expect(res.status).toBe(404)
    })

    it('deletes the exercise and reorders remaining exercises', async () => {
        vi.mocked(prisma.trainingProgram.findFirst).mockResolvedValue({
            id: PROGRAM_ID,
            status: 'DRAFT',
        } as any)
        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue({
            id: EXERCISE_ID,
            workoutId: WORKOUT_ID,
            order: 2,
        } as any)
        vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma))
        vi.mocked(prisma.workoutExercise.delete).mockResolvedValue({} as any)
        vi.mocked(prisma.workoutExercise.findMany).mockResolvedValue([
            { id: 'aaaa', order: 1 },
            { id: 'bbbb', order: 3 },
        ] as any)
        vi.mocked(prisma.workoutExercise.update).mockResolvedValue({} as any)

        const req = new NextRequest(`http://localhost/api/programs/${PROGRAM_ID}/workouts/${WORKOUT_ID}/exercises/${EXERCISE_ID}`, {
            method: 'DELETE',
        })
        const res = await DELETE(req, withParams(PROGRAM_ID, WORKOUT_ID, EXERCISE_ID))
        expect(res.status).toBe(200)
        expect(prisma.workoutExercise.delete).toHaveBeenCalledWith({
            where: { id: EXERCISE_ID },
        })
        // Reorder: remaining exercises get sequential order
        expect(prisma.workoutExercise.update).toHaveBeenCalledTimes(2)
    })
})
```

- [ ] **Step 2: Run and verify it fails (DELETE route exists but test file is new)**

```bash
cd /mnt/c/dev-projects/zero-cento-project
npx vitest run tests/integration/workout-exercise-delete.test.ts
```

Expected: FAIL — import error or test failures because mocks aren't fully aligned yet. If they pass already (route already works correctly), that's also fine — proceed.

- [ ] **Step 3: Fix any import or mock issues until all tests pass**

Check that `requireTrainerProgramOwnership` is the correct import name by inspecting:
```bash
grep -n "requireTrainer" src/app/api/programs/\[id\]/workouts/\[workoutId\]/exercises/\[exerciseId\]/route.ts | head -5
```

Adjust the `vi.mock('@/lib/auth', ...)` mock to export whatever functions the route actually imports.

- [ ] **Step 4: Run until green**

```bash
npx vitest run tests/integration/workout-exercise-delete.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/integration/workout-exercise-delete.test.ts
git commit -m "test: add integration tests for workout exercise DELETE route"
```

---

### Task 2: Add `pendingDeletesByWorkout` state

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:468`

- [ ] **Step 1: Add state declaration after `draftRowIdsByWorkout` (line 468)**

Find:
```typescript
    const [draftRowIdsByWorkout, setDraftRowIdsByWorkout] = useState<Record<string, string[]>>({})
```

Replace with:
```typescript
    const [draftRowIdsByWorkout, setDraftRowIdsByWorkout] = useState<Record<string, string[]>>({})
    const [pendingDeletesByWorkout, setPendingDeletesByWorkout] = useState<Record<string, string[]>>({})
```

- [ ] **Step 2: Type-check**

```bash
cd /mnt/c/dev-projects/zero-cento-project
npm run type-check 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx
git commit -m "feat: add pendingDeletesByWorkout state for deferred exercise deletion"
```

---

### Task 3: Filter pending deletes from `getWorkoutRows`

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:1223-1239`

When an exercise is in `pendingDeletesByWorkout`, it should be hidden from the UI immediately. `getWorkoutRows` builds the displayed rows — filter pending IDs out of the persisted rows.

- [ ] **Step 1: Modify `getWorkoutRows` (currently lines 1223-1239)**

Find:
```typescript
    const getWorkoutRows = useCallback(
        (workout: Workout) => {
            const persistedRows = workout.workoutExercises
                .map((workoutExercise) =>
                    rowStateById[workoutExercise.id] || buildEditableRow(workout.id, workoutExercise)
                )
                .sort((left, right) => left.order - right.order)

            const draftRows = (draftRowIdsByWorkout[workout.id] || [])
                .map((draftRowId) => rowStateById[draftRowId])
                .filter((row): row is EditableWorkoutExerciseRow => Boolean(row))
                .sort((left, right) => left.order - right.order)

            return [...persistedRows, ...draftRows]
        },
        [draftRowIdsByWorkout, rowStateById]
    )
```

Replace with:
```typescript
    const getWorkoutRows = useCallback(
        (workout: Workout) => {
            const pendingDeleteIds = new Set(pendingDeletesByWorkout[workout.id] ?? [])

            const persistedRows = workout.workoutExercises
                .filter((workoutExercise) => !pendingDeleteIds.has(workoutExercise.id))
                .map((workoutExercise) =>
                    rowStateById[workoutExercise.id] || buildEditableRow(workout.id, workoutExercise)
                )
                .sort((left, right) => left.order - right.order)

            const draftRows = (draftRowIdsByWorkout[workout.id] || [])
                .map((draftRowId) => rowStateById[draftRowId])
                .filter((row): row is EditableWorkoutExerciseRow => Boolean(row))
                .sort((left, right) => left.order - right.order)

            return [...persistedRows, ...draftRows]
        },
        [draftRowIdsByWorkout, pendingDeletesByWorkout, rowStateById]
    )
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check 2>&1 | head -30
```

Expected: no new errors. The `hasWorkoutUnsavedChanges` callback now automatically detects pending deletes: it calls `getWorkoutRows` for `currentRows`, which is shorter than `workout.workoutExercises`, so `currentRows.length !== persistedRows.length` → returns `true` → save button enabled. No changes needed there.

- [ ] **Step 3: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx
git commit -m "feat: filter pending deletes from getWorkoutRows so they hide immediately"
```

---

### Task 4: Change `deleteRow()` to do local-only deletion for persisted rows

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:1884-1923`

Instead of calling the DELETE API immediately, mark the exercise as pending delete and close the modal. The API call happens later at save time.

- [ ] **Step 1: Replace the persisted-row branch in `deleteRow` (lines 1884-1923)**

Find:
```typescript
    const deleteRow = async () => {
        if (!confirmDeleteRow) {
            return
        }

        const { rowId, workoutId, isDraft } = confirmDeleteRow

        if (isDraft) {
            removeDraftRow(rowId, workoutId)
            setConfirmDeleteRow(null)
            return
        }

        try {
            setDeletingRowId(rowId)

            const res = await fetch(
                `/api/programs/${programId}/workouts/${workoutId}/exercises/${rowId}`,
                {
                    method: 'DELETE',
                }
            )

            if (!res.ok) {
                const data = await res.json()
                throw new Error(getApiErrorMessage(data, t('editProgram.rowDeleteError'), t))
            }

            await fetchProgram({ showLoading: false })
            showToast(t('editProgram.rowDeletedSuccess'), 'success')
            setConfirmDeleteRow(null)
        } catch (err: unknown) {
            showToast(
                err instanceof Error ? err.message : t('editProgram.rowDeleteGenericError'),
                'error'
            )
        } finally {
            setDeletingRowId(null)
        }
    }
```

Replace with:
```typescript
    const deleteRow = () => {
        if (!confirmDeleteRow) {
            return
        }

        const { rowId, workoutId, isDraft } = confirmDeleteRow

        if (isDraft) {
            removeDraftRow(rowId, workoutId)
            setConfirmDeleteRow(null)
            return
        }

        // Mark as pending delete — actual API call happens at save time
        setPendingDeletesByWorkout((current) => ({
            ...current,
            [workoutId]: [...(current[workoutId] ?? []), rowId],
        }))
        setConfirmDeleteRow(null)
    }
```

Note: `deleteRow` is no longer `async`. Update the call site at line ~3396-3398:

Find:
```typescript
                    onConfirm={() => {
                        void deleteRow()
                    }}
```

Replace with:
```typescript
                    onConfirm={deleteRow}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check 2>&1 | head -30
```

Expected: no errors. TypeScript will flag if any awaited value is no longer a Promise.

- [ ] **Step 3: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx
git commit -m "feat: defer persisted exercise delete to save-workout instead of immediate API call"
```

---

### Task 5: Apply pending deletes inside `saveWorkoutRows()`

**Files:**
- Modify: `src/app/trainer/programs/[id]/edit/_content.tsx:1704-1856`

During save, first DELETE all pending exercises in parallel, then proceed with the existing bulk PUT for remaining rows.

- [ ] **Step 1: Replace `saveWorkoutRows` (lines 1704-1856) with the updated version**

Find the function opening and the early-exit check:
```typescript
    const saveWorkoutRows = async (workout: Workout): Promise<boolean> => {
        if (readOnly) {
            return false
        }

        const workoutRows = [...getWorkoutRows(workout)].sort((left, right) => left.order - right.order)

        if (workoutRows.length === 0) {
            showToast(t('editProgram.tableNoWorkoutExercises'), 'warning')
            return false
        }
```

Replace with:
```typescript
    const saveWorkoutRows = async (workout: Workout): Promise<boolean> => {
        if (readOnly) {
            return false
        }

        const workoutRows = [...getWorkoutRows(workout)].sort((left, right) => left.order - right.order)
        const pendingDeleteIds = pendingDeletesByWorkout[workout.id] ?? []

        if (workoutRows.length === 0 && pendingDeleteIds.length === 0) {
            showToast(t('editProgram.tableNoWorkoutExercises'), 'warning')
            return false
        }
```

Then, inside the `try` block, right after `setSavingWorkoutId(workout.id)`, insert the delete step. Find:
```typescript
        try {
            setSavingWorkoutId(workout.id)
            const savedDraftRowIds: string[] = []

            const bulkPayload = {
```

Replace with:
```typescript
        try {
            setSavingWorkoutId(workout.id)

            if (pendingDeleteIds.length > 0) {
                const deleteResults = await Promise.all(
                    pendingDeleteIds.map((exerciseId) =>
                        fetch(
                            `/api/programs/${programId}/workouts/${workout.id}/exercises/${exerciseId}`,
                            { method: 'DELETE' }
                        )
                    )
                )
                const failedResult = deleteResults.find((r) => !r.ok)
                if (failedResult) {
                    const errData = await failedResult.json()
                    throw new Error(getApiErrorMessage(errData, t('editProgram.rowDeleteError'), t))
                }
                setPendingDeletesByWorkout((current) => {
                    const { [workout.id]: _removed, ...rest } = current
                    return rest
                })
            }

            if (workoutRows.length === 0) {
                await fetchProgram({ showLoading: false })
                showToast(t('editProgram.workoutRowsSavedSuccess'), 'success')
                setExpandedWorkoutIds((current) => ({ ...current, [workout.id]: false }))
                return true
            }

            const savedDraftRowIds: string[] = []

            const bulkPayload = {
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:unit 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/trainer/programs/\[id\]/edit/_content.tsx
git commit -m "feat: execute pending exercise deletions as part of save-workout flow"
```

---

### Task 6: Run integration tests and verify

- [ ] **Step 1: Run the new integration tests**

```bash
npx vitest run tests/integration/workout-exercise-delete.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 2: Run full test suite**

```bash
npm run test:unit 2>&1 | tail -20
```

Expected: all tests pass, coverage thresholds met.

- [ ] **Step 3: Manual smoke test**

Start the dev server:
```bash
npm run dev
```

1. Open a trainer program in edit mode (step 3 - Esercizi)
2. Click the trash icon on a persisted exercise → confirmation modal opens
3. Confirm → exercise disappears **immediately**, no spinner, no network call
4. The "Salva workout" button becomes enabled (unsaved changes detected)
5. Click "Salva workout" → the DELETE call fires, then the bulk PUT fires, workout saves successfully
6. Reload the page → the exercise is gone (server state matches)

Also verify:
- Clicking trash on a **draft** exercise still removes it immediately (unchanged behavior)
- The "Aggiungi esercizio" button is NOT blocked while deletion is pending (it was previously disabled when `deletingRowId` was set)

- [ ] **Step 4: Commit**

No code changes — this is just a verification step. If manual testing reveals issues, fix and commit before proceeding.

---

### Task 7: Update CHANGELOG

**Files:**
- Modify: `implementation-docs/CHANGELOG.md`

- [ ] **Step 1: Add changelog entry at the top**

Add under the most recent date section (or create a new `## [Unreleased]` / today's date section):

```markdown
### 2026-05-03
- **Deferred exercise deletion (trainer program edit):** Clicking the trash icon on a persisted exercise no longer triggers an immediate server DELETE call. Instead, the exercise is hidden locally and deleted server-side when the trainer clicks "Salva workout". This eliminates the several-second delay on each trash click. Pending deletes are tracked in `pendingDeletesByWorkout` state; `getWorkoutRows` filters them out; `saveWorkoutRows` sends parallel DELETE requests before the bulk PUT.
```

- [ ] **Step 2: Commit**

```bash
git add implementation-docs/CHANGELOG.md
git commit -m "docs: changelog entry for deferred exercise deletion"
```

---

## Self-Review

**Spec coverage:**
- ✅ Trash click → local hide (no API call) → Task 4
- ✅ Save workout → applies deletions → Task 5
- ✅ Exercise hidden from UI immediately → Task 3 (`getWorkoutRows` filter)
- ✅ Save button enabled when pending deletes exist → implicit via `hasWorkoutUnsavedChanges` length check
- ✅ Draft exercise deletion still works (unchanged path in `deleteRow`) → Task 4
- ✅ All-exercises-deleted edge case handled (bail out after deletes if `workoutRows.length === 0`) → Task 5

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:**
- `pendingDeletesByWorkout`: `Record<string, string[]>` — used consistently in state, `getWorkoutRows`, `deleteRow`, `saveWorkoutRows`
- `setPendingDeletesByWorkout`: used in `deleteRow` (add) and `saveWorkoutRows` (clear) — same setter signature both places
- `pendingDeleteIds`: `string[]` — derived via `pendingDeletesByWorkout[workout.id] ?? []` — correct type for `.map` and `.length` checks
